import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";

const userFindUnique = jest.fn<(args: unknown) => Promise<unknown>>();
const userUpdate = jest.fn<(args: unknown) => Promise<unknown>>();

const sendBookingNotificationEmail = jest.fn<(args: unknown) => Promise<void>>();
const sendMessageNotificationEmail = jest.fn<(args: unknown) => Promise<void>>();
const sendPaymentNotificationEmail = jest.fn<(args: unknown) => Promise<void>>();

jest.unstable_mockModule("../../lib/db.ts", () => ({
  prisma: { user: { findUnique: userFindUnique, update: userUpdate } },
}));

jest.unstable_mockModule("../../lib/email.ts", () => ({
  // auth.service.ts also imports from this module; stand ins keep the app's
  // module graph loadable even though no test here exercises password reset.
  buildPasswordResetUrl: (token: string) => `http://localhost:3000/reset-password?token=${token}`,
  sendPasswordResetEmail: jest.fn(),
  sendBookingNotificationEmail,
  sendMessageNotificationEmail,
  sendPaymentNotificationEmail,
}));

const { app } = await import("../../app.ts");
const { signAuthToken } = await import("../../lib/jwt.ts");
const { notifyUser, UserNotFoundError } = await import("./notification.service.ts");

const userId = "11111111-1111-4111-8111-111111111111";

function tokenFor(id: string) {
  return signAuthToken({ sub: id, email: "member@example.com", isAdmin: false });
}

beforeEach(() => {
  userFindUnique.mockReset();
  userUpdate.mockReset();
  sendBookingNotificationEmail.mockReset();
  sendMessageNotificationEmail.mockReset();
  sendPaymentNotificationEmail.mockReset();
  sendBookingNotificationEmail.mockResolvedValue();
  sendMessageNotificationEmail.mockResolvedValue();
  sendPaymentNotificationEmail.mockResolvedValue();
});

describe("GET /api/notifications/preferences", () => {
  it("requires authentication", async () => {
    await request(app).get("/api/notifications/preferences").expect(401);
  });

  it("returns the member's current preferences", async () => {
    userFindUnique.mockResolvedValue({
      notifyOnBooking: true,
      notifyOnMessage: false,
      notifyOnPayment: true,
    });

    const res = await request(app)
      .get("/api/notifications/preferences")
      .set("Authorization", `Bearer ${tokenFor(userId)}`)
      .expect(200);

    expect(res.body).toEqual({
      notifyOnBooking: true,
      notifyOnMessage: false,
      notifyOnPayment: true,
    });
  });

  it("returns 404 when the account no longer exists", async () => {
    userFindUnique.mockResolvedValue(null);

    await request(app)
      .get("/api/notifications/preferences")
      .set("Authorization", `Bearer ${tokenFor(userId)}`)
      .expect(404);
  });
});

describe("PUT /api/notifications/preferences", () => {
  it("requires authentication", async () => {
    await request(app)
      .put("/api/notifications/preferences")
      .send({ notifyOnBooking: true, notifyOnMessage: true, notifyOnPayment: true })
      .expect(401);
  });

  it("rejects a request missing a preference field", async () => {
    await request(app)
      .put("/api/notifications/preferences")
      .set("Authorization", `Bearer ${tokenFor(userId)}`)
      .send({ notifyOnBooking: true, notifyOnMessage: true })
      .expect(400);

    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("updates and returns the member's preferences", async () => {
    userUpdate.mockResolvedValue({
      notifyOnBooking: false,
      notifyOnMessage: false,
      notifyOnPayment: true,
    });

    const res = await request(app)
      .put("/api/notifications/preferences")
      .set("Authorization", `Bearer ${tokenFor(userId)}`)
      .send({ notifyOnBooking: false, notifyOnMessage: false, notifyOnPayment: true })
      .expect(200);

    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: userId },
      data: { notifyOnBooking: false, notifyOnMessage: false, notifyOnPayment: true },
      select: { notifyOnBooking: true, notifyOnMessage: true, notifyOnPayment: true },
    });
    expect(res.body).toEqual({
      notifyOnBooking: false,
      notifyOnMessage: false,
      notifyOnPayment: true,
    });
  });

  it("returns 404 when the account no longer exists", async () => {
    userUpdate.mockRejectedValue(Object.assign(new Error("not found"), { code: "P2025" }));

    await request(app)
      .put("/api/notifications/preferences")
      .set("Authorization", `Bearer ${tokenFor(userId)}`)
      .send({ notifyOnBooking: true, notifyOnMessage: true, notifyOnPayment: true })
      .expect(404);
  });
});

describe("notifyUser", () => {
  it("sends a booking email when the preference is enabled", async () => {
    userFindUnique.mockResolvedValue({
      email: "member@example.com",
      notifyOnBooking: true,
      notifyOnMessage: true,
      notifyOnPayment: true,
    });

    await notifyUser(userId, {
      eventType: "booking",
      details: { subjectName: "Calculus", scheduledAt: new Date("2026-01-01T10:00:00.000Z") },
    });

    expect(sendBookingNotificationEmail).toHaveBeenCalledWith({
      to: "member@example.com",
      subjectName: "Calculus",
      scheduledAt: new Date("2026-01-01T10:00:00.000Z"),
    });
  });

  it("suppresses the booking email when the preference is disabled", async () => {
    userFindUnique.mockResolvedValue({
      email: "member@example.com",
      notifyOnBooking: false,
      notifyOnMessage: true,
      notifyOnPayment: true,
    });

    await notifyUser(userId, {
      eventType: "booking",
      details: { subjectName: "Calculus", scheduledAt: new Date() },
    });

    expect(sendBookingNotificationEmail).not.toHaveBeenCalled();
  });

  it("sends a message email when the preference is enabled", async () => {
    userFindUnique.mockResolvedValue({
      email: "member@example.com",
      notifyOnBooking: true,
      notifyOnMessage: true,
      notifyOnPayment: true,
    });

    await notifyUser(userId, {
      eventType: "message",
      details: { senderName: "Ada", preview: "Hi there" },
    });

    expect(sendMessageNotificationEmail).toHaveBeenCalledWith({
      to: "member@example.com",
      senderName: "Ada",
      preview: "Hi there",
    });
  });

  it("suppresses the message email when the preference is disabled", async () => {
    userFindUnique.mockResolvedValue({
      email: "member@example.com",
      notifyOnBooking: true,
      notifyOnMessage: false,
      notifyOnPayment: true,
    });

    await notifyUser(userId, {
      eventType: "message",
      details: { senderName: "Ada", preview: "Hi there" },
    });

    expect(sendMessageNotificationEmail).not.toHaveBeenCalled();
  });

  it("sends a payment email when the preference is enabled", async () => {
    userFindUnique.mockResolvedValue({
      email: "member@example.com",
      notifyOnBooking: true,
      notifyOnMessage: true,
      notifyOnPayment: true,
    });

    await notifyUser(userId, {
      eventType: "payment",
      details: { amount: 500, description: "Wallet top-up" },
    });

    expect(sendPaymentNotificationEmail).toHaveBeenCalledWith({
      to: "member@example.com",
      amount: 500,
      description: "Wallet top-up",
    });
  });

  it("suppresses the payment email when the preference is disabled", async () => {
    userFindUnique.mockResolvedValue({
      email: "member@example.com",
      notifyOnBooking: true,
      notifyOnMessage: true,
      notifyOnPayment: false,
    });

    await notifyUser(userId, {
      eventType: "payment",
      details: { amount: 500, description: "Wallet top-up" },
    });

    expect(sendPaymentNotificationEmail).not.toHaveBeenCalled();
  });

  it("throws when the member no longer exists", async () => {
    userFindUnique.mockResolvedValue(null);

    await expect(
      notifyUser(userId, {
        eventType: "message",
        details: { senderName: "Ada", preview: "Hi" },
      })
    ).rejects.toThrow(UserNotFoundError);
  });

  it("does not propagate an email delivery failure", async () => {
    userFindUnique.mockResolvedValue({
      email: "member@example.com",
      notifyOnBooking: true,
      notifyOnMessage: true,
      notifyOnPayment: true,
    });
    sendMessageNotificationEmail.mockRejectedValue(new Error("delivery failed"));

    await expect(
      notifyUser(userId, {
        eventType: "message",
        details: { senderName: "Ada", preview: "Hi there" },
      })
    ).resolves.toBeUndefined();
  });
});
