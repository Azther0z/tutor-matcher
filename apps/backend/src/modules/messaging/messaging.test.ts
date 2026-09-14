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

const USER_ID = "00000000-0000-4000-8000-000000000001";
const OTHER_USER_ID = "00000000-0000-4000-8000-000000000002";
const MESSAGE_ID = "00000000-0000-4000-8000-000000000010";

function tokenFor(userId = USER_ID) {
  return signAuthToken({ sub: userId, email: "student@example.com", isAdmin: false });
}

describe("Messaging API", () => {
  beforeEach(() => {
    userFindUnique.mockReset();
    messageCreate.mockReset();
    messageFindMany.mockReset();
  });

  it("requires authentication to send a message", async () => {
    await request(app)
      .post("/api/messages")
      .send({ toUserId: OTHER_USER_ID, message: "Hi!" })
      .expect(401);

    expect(messageCreate).not.toHaveBeenCalled();
  });

  it("rejects an empty message without notifying the Tutor", async () => {
    await request(app)
      .post("/api/messages")
      .set("Authorization", `Bearer ${tokenFor()}`)
      .send({ toUserId: OTHER_USER_ID, message: "" })
      .expect(400);

    expect(userFindUnique).not.toHaveBeenCalled();
    expect(messageCreate).not.toHaveBeenCalled();
  });

  it("rejects a message to a recipient that does not exist", async () => {
    userFindUnique.mockResolvedValue(null);

    await request(app)
      .post("/api/messages")
      .set("Authorization", `Bearer ${tokenFor()}`)
      .send({ toUserId: OTHER_USER_ID, message: "Hi!" })
      .expect(404);

    expect(messageCreate).not.toHaveBeenCalled();
  });

  it("allows a Tutor to reply to a Student who is not a Tutor", async () => {
    userFindUnique.mockResolvedValue({ id: OTHER_USER_ID });
    messageCreate.mockResolvedValue({
      id: 11,
      fromUserId: USER_ID,
      toUserId: OTHER_USER_ID,
      message: "Sure, Saturday works!",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    await request(app)
      .post("/api/messages")
      .set("Authorization", `Bearer ${tokenFor()}`)
      .send({ toUserId: OTHER_USER_ID, message: "Sure, Saturday works!" })
      .expect(201);

    expect(messageCreate).toHaveBeenCalledWith({
      data: { fromUserId: USER_ID, toUserId: OTHER_USER_ID, message: "Sure, Saturday works!" },
    });
  });

  it("delivers a valid message to the Tutor's inbox", async () => {
    userFindUnique.mockResolvedValue({
      id: OTHER_USER_ID,
      tutorId: "00000000-0000-4000-8000-000000000005",
    });
    messageCreate.mockResolvedValue({
      id: MESSAGE_ID,
      fromUserId: USER_ID,
      toUserId: OTHER_USER_ID,
      message: "Hi, are you free on weekends?",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const response = await request(app)
      .post("/api/messages")
      .set("Authorization", `Bearer ${tokenFor()}`)
      .send({ toUserId: OTHER_USER_ID, message: "Hi, are you free on weekends?" })
      .expect(201);

    expect(messageCreate).toHaveBeenCalledWith({
      data: {
        fromUserId: USER_ID,
        toUserId: OTHER_USER_ID,
        message: "Hi, are you free on weekends?",
      },
    });
    expect(response.body).toMatchObject({
      id: MESSAGE_ID,
      fromUserId: USER_ID,
      toUserId: OTHER_USER_ID,
    });
  });

  it("requires authentication to read the inbox", async () => {
    await request(app).get("/api/messages/inbox").expect(401);
    expect(messageFindMany).not.toHaveBeenCalled();
  });

  it("returns the current user's received messages, newest first", async () => {
    messageFindMany.mockResolvedValue([
      {
        id: "00000000-0000-4000-8000-000000000010",
        fromUserId: USER_ID,
        toUserId: OTHER_USER_ID,
        message: "Hi!",
        createdAt: new Date(),
      },
    ]);

    const response = await request(app)
      .get("/api/messages/inbox")
      .set("Authorization", `Bearer ${tokenFor(OTHER_USER_ID)}`)
      .expect(200);

    expect(messageFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { toUserId: OTHER_USER_ID },
        orderBy: { createdAt: "desc" },
      })
    );
    expect(response.body).toHaveLength(1);
  });

  it("requires authentication to read a thread", async () => {
    await request(app).get(`/api/messages/thread/${OTHER_USER_ID}`).expect(401);
    expect(messageFindMany).not.toHaveBeenCalled();
  });

  it("rejects a non-numeric thread user id", async () => {
    await request(app)
      .get("/api/messages/thread/not-a-uuid")
      .set("Authorization", `Bearer ${tokenFor()}`)
      .expect(400);

    expect(messageFindMany).not.toHaveBeenCalled();
  });

  it("returns the two-way thread with another user, oldest first", async () => {
    messageFindMany.mockResolvedValue([
      {
        id: "00000000-0000-4000-8000-000000000001",
        fromUserId: USER_ID,
        toUserId: OTHER_USER_ID,
        message: "Hi!",
        createdAt: new Date(),
      },
      {
        id: "00000000-0000-4000-8000-000000000002",
        fromUserId: OTHER_USER_ID,
        toUserId: USER_ID,
        message: "Hey there",
        createdAt: new Date(),
      },
    ]);

    const response = await request(app)
      .get(`/api/messages/thread/${OTHER_USER_ID}`)
      .set("Authorization", `Bearer ${tokenFor(USER_ID)}`)
      .expect(200);

    expect(messageFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { fromUserId: USER_ID, toUserId: OTHER_USER_ID },
            { fromUserId: OTHER_USER_ID, toUserId: USER_ID },
          ],
        },
        orderBy: { createdAt: "asc" },
      })
    );
    expect(response.body).toHaveLength(2);
  });
});
