import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";

const userFindUnique = jest.fn<(args: unknown) => Promise<unknown>>();
const messageCreate = jest.fn<(args: unknown) => Promise<unknown>>();
const messageFindMany = jest.fn<(args: unknown) => Promise<unknown[]>>();

jest.unstable_mockModule("../../lib/db.ts", () => ({
  prisma: {
    user: { findUnique: userFindUnique },
    message: { create: messageCreate, findMany: messageFindMany },
  },
}));

const { app } = await import("../../app.ts");
const { signAuthToken } = await import("../../lib/jwt.ts");

function tokenFor(userId = 1) {
  return signAuthToken({ sub: userId, email: "student@example.com", isAdmin: false });
}

describe("Messaging API", () => {
  beforeEach(() => {
    userFindUnique.mockReset();
    messageCreate.mockReset();
    messageFindMany.mockReset();
  });

  it("requires authentication to send a message", async () => {
    await request(app).post("/api/messages").send({ toUserId: 2, message: "Hi!" }).expect(401);

    expect(messageCreate).not.toHaveBeenCalled();
  });

  it("rejects an empty message without notifying the Tutor", async () => {
    await request(app)
      .post("/api/messages")
      .set("Authorization", `Bearer ${tokenFor()}`)
      .send({ toUserId: 2, message: "" })
      .expect(400);

    expect(userFindUnique).not.toHaveBeenCalled();
    expect(messageCreate).not.toHaveBeenCalled();
  });

  it("rejects a message to a recipient who is not a Tutor", async () => {
    userFindUnique.mockResolvedValue({ id: 2, isTutor: false });

    await request(app)
      .post("/api/messages")
      .set("Authorization", `Bearer ${tokenFor()}`)
      .send({ toUserId: 2, message: "Hi!" })
      .expect(404);

    expect(messageCreate).not.toHaveBeenCalled();
  });

  it("delivers a valid message to the Tutor's inbox", async () => {
    userFindUnique.mockResolvedValue({ id: 2, isTutor: true });
    messageCreate.mockResolvedValue({
      id: 10,
      fromUserId: 1,
      toUserId: 2,
      message: "Hi, are you free on weekends?",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const response = await request(app)
      .post("/api/messages")
      .set("Authorization", `Bearer ${tokenFor()}`)
      .send({ toUserId: 2, message: "Hi, are you free on weekends?" })
      .expect(201);

    expect(messageCreate).toHaveBeenCalledWith({
      data: { fromUserId: 1, toUserId: 2, message: "Hi, are you free on weekends?" },
    });
    expect(response.body).toMatchObject({ id: 10, fromUserId: 1, toUserId: 2 });
  });

  it("requires authentication to read the inbox", async () => {
    await request(app).get("/api/messages/inbox").expect(401);
    expect(messageFindMany).not.toHaveBeenCalled();
  });

  it("returns the current user's received messages, newest first", async () => {
    messageFindMany.mockResolvedValue([
      { id: 10, fromUserId: 1, toUserId: 2, message: "Hi!", createdAt: new Date() },
    ]);

    const response = await request(app)
      .get("/api/messages/inbox")
      .set("Authorization", `Bearer ${tokenFor(2)}`)
      .expect(200);

    expect(messageFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { toUserId: 2 },
        orderBy: { createdAt: "desc" },
      })
    );
    expect(response.body).toHaveLength(1);
  });
});
