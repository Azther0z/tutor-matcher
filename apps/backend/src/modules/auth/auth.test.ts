import bcrypt from "bcryptjs";
import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import request from "supertest";

const userCreate = jest.fn<(args: unknown) => Promise<unknown>>();
const userFindUnique = jest.fn<(args: unknown) => Promise<unknown>>();
const userUpdate = jest.fn<(args: unknown) => Promise<unknown>>();
const tokenCreate = jest.fn<(args: unknown) => Promise<unknown>>();
const tokenDeleteMany = jest.fn<(args: unknown) => Promise<unknown>>();
const tokenFindUnique = jest.fn<(args: unknown) => Promise<unknown>>();
const tokenUpdateMany = jest.fn<(args: unknown) => Promise<unknown>>();

const userId = "11111111-1111-4111-8111-111111111111";
const otherUserId = "77777777-7777-4777-8777-777777777777";
const resetTokenId = "22222222-2222-4222-8222-222222222222";

const transactionClient = {
  user: { update: userUpdate },
  passwordResetToken: {
    create: tokenCreate,
    deleteMany: tokenDeleteMany,
    findUnique: tokenFindUnique,
    updateMany: tokenUpdateMany,
  },
};
type TransactionClient = typeof transactionClient;
const transactionMock = jest.fn(
  async (callback: (transaction: TransactionClient) => Promise<unknown>) =>
    callback(transactionClient)
);
const sendPasswordResetEmail = jest.fn<(args: unknown) => Promise<void>>();

const signupBody = {
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  password: "supersecret",
};

jest.unstable_mockModule("../../lib/db.ts", () => ({
  prisma: {
    user: { create: userCreate, findUnique: userFindUnique, update: userUpdate },
    passwordResetToken: { deleteMany: tokenDeleteMany, findUnique: tokenFindUnique },
    $transaction: transactionMock,
  },
}));

jest.unstable_mockModule("../../lib/email.ts", () => ({
  buildPasswordResetUrl: (token: string) => `http://localhost:3000/reset-password?token=${token}`,
  sendPasswordResetEmail,
}));

const { app } = await import("../../app.ts");
const { signAuthToken, verifyAuthToken } = await import("../../lib/jwt.ts");

beforeEach(() => {
  userCreate.mockReset();
  userFindUnique.mockReset();
  userUpdate.mockReset();
  tokenCreate.mockReset();
  tokenDeleteMany.mockReset();
  tokenFindUnique.mockReset();
  tokenUpdateMany.mockReset();
  transactionMock.mockClear();
  sendPasswordResetEmail.mockReset();
  userFindUnique.mockResolvedValue(null);
  tokenDeleteMany.mockResolvedValue({ count: 1 });
  sendPasswordResetEmail.mockResolvedValue();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("POST /api/auth/signup", () => {
  it("creates a user with a UUID and bcrypt password hash", async () => {
    userCreate.mockResolvedValue({
      id: userId,
      email: "ada@example.com",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const res = await request(app).post("/api/auth/signup").send(signupBody).expect(201);

    expect(res.body).toMatchObject({ id: userId, email: "ada@example.com" });
    expect(res.body).not.toHaveProperty("password");

    const createCall = userCreate.mock.calls[0]?.[0] as {
      data: {
        firstName: string;
        lastName: string;
        email: string;
        password: string;
        bio: string | null;
        isTutor?: boolean;
      };
    };
    expect(createCall.data).toMatchObject({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      bio: null,
    });
    expect(createCall.data.password).not.toBe("supersecret");
    await expect(bcrypt.compare("supersecret", createCall.data.password)).resolves.toBe(true);
    expect(createCall.data).not.toHaveProperty("isTutor");
  });

  it("stores an optional bio when one is provided", async () => {
    userCreate.mockResolvedValue({
      id: userId,
      email: "ada@example.com",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    await request(app)
      .post("/api/auth/signup")
      .send({ ...signupBody, bio: "Maths tutor" })
      .expect(201);

    expect(userCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ bio: "Maths tutor" }),
    });
  });

  it("rejects an invalid body with 400", async () => {
    await request(app)
      .post("/api/auth/signup")
      .send({ ...signupBody, email: "not-an-email", password: "short" })
      .expect(400);

    expect(userCreate).not.toHaveBeenCalled();
  });

  it("rejects a body without a name with 400", async () => {
    await request(app)
      .post("/api/auth/signup")
      .send({ email: "ada@example.com", password: "supersecret" })
      .expect(400);

    expect(userCreate).not.toHaveBeenCalled();
  });

  it("returns 409 when the email is already taken", async () => {
    userFindUnique.mockResolvedValue({ id: otherUserId });

    await request(app).post("/api/auth/signup").send(signupBody).expect(409);

    expect(userCreate).not.toHaveBeenCalled();
  });

  it("returns 409 when a concurrent signup wins the race", async () => {
    userCreate.mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }));

    await request(app).post("/api/auth/signup").send(signupBody).expect(409);
  });
});

describe("POST /api/auth/login", () => {
  it("accepts a bcrypt password and returns a UUID-based auth token", async () => {
    userFindUnique.mockResolvedValue({
      id: userId,
      email: "ada@example.com",
      password: await bcrypt.hash("supersecret", 4),
      firstName: "Ada",
      lastName: "Lovelace",
      isAdmin: false,
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "ada@example.com", password: "supersecret" })
      .expect(200);

    expect(res.body.user).toEqual({
      id: userId,
      email: "ada@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      isAdmin: false,
    });
    expect(typeof res.body.token).toBe("string");
    expect(verifyAuthToken(res.body.token)).toEqual({
      sub: userId,
      email: "ada@example.com",
      isAdmin: false,
    });
    expect(res.body.user).not.toHaveProperty("password");
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("continues to accept a legacy plaintext password", async () => {
    userFindUnique.mockResolvedValue({
      id: userId,
      email: "ada@example.com",
      password: "supersecret",
      firstName: "Ada",
      lastName: "Lovelace",
      isAdmin: false,
    });

    await request(app)
      .post("/api/auth/login")
      .send({ email: "ada@example.com", password: "supersecret" })
      .expect(200);

    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid body", async () => {
    await request(app)
      .post("/api/auth/login")
      .send({ email: "not-an-email", password: "" })
      .expect(400);

    expect(userFindUnique).not.toHaveBeenCalled();
  });

  it("returns 401 when the email is unknown", async () => {
    await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "supersecret" })
      .expect(401);
  });

  it("returns 401 when the password is wrong", async () => {
    userFindUnique.mockResolvedValue({
      id: userId,
      email: "ada@example.com",
      password: "supersecret",
      isAdmin: false,
    });

    await request(app)
      .post("/api/auth/login")
      .send({ email: "ada@example.com", password: "wrongpass" })
      .expect(401);
  });
});

describe("GET /api/auth/me", () => {
  it("returns the current user for a valid token", async () => {
    userFindUnique.mockResolvedValue({
      id: userId,
      email: "ada@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      isAdmin: false,
    });

    const token = signAuthToken({ sub: userId, email: "ada@example.com", isAdmin: false });
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(res.body).toEqual({
      id: userId,
      email: "ada@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      isAdmin: false,
    });
  });

  it("requires authentication", async () => {
    await request(app).get("/api/auth/me").expect(401);
    expect(userFindUnique).not.toHaveBeenCalled();
  });
});

describe("password reset", () => {
  it("returns the same generic response for registered and unknown emails", async () => {
    userFindUnique
      .mockResolvedValueOnce({ id: userId, email: "ada@example.com" })
      .mockResolvedValueOnce(null);
    tokenCreate.mockResolvedValue({ id: resetTokenId, tokenHash: "hashed-token" });

    const registered = await request(app)
      .post("/api/auth/password-reset/request")
      .send({ email: "ada@example.com" })
      .expect(200);
    const unknown = await request(app)
      .post("/api/auth/password-reset/request")
      .send({ email: "nobody@example.com" })
      .expect(200);

    expect(registered.body).toEqual(unknown.body);
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
  });

  it("stores only a SHA-256 token hash, invalidates old tokens, and emails the raw link", async () => {
    userFindUnique.mockResolvedValue({ id: userId, email: "ada@example.com" });
    tokenCreate.mockResolvedValue({ id: resetTokenId, tokenHash: "hashed-token" });

    await request(app)
      .post("/api/auth/password-reset/request")
      .send({ email: "ADA@example.com" })
      .expect(200);

    expect(tokenDeleteMany).toHaveBeenCalledWith({ where: { userId } });
    const createCall = tokenCreate.mock.calls[0]?.[0] as {
      data: { tokenHash: string; userId: string; expiresAt: Date };
    };
    expect(createCall.data.userId).toBe(userId);
    expect(createCall.data.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(createCall.data.expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * 60 * 1000);
    expect(createCall.data.expiresAt.getTime()).toBeLessThan(Date.now() + 31 * 60 * 1000);
    expect(sendPasswordResetEmail).toHaveBeenCalledWith({
      to: "ada@example.com",
      resetUrl: expect.stringMatching(/^http:\/\/localhost:3000\/reset-password\?token=/),
    });
  });

  it("deletes a newly-created token when email delivery fails", async () => {
    userFindUnique.mockResolvedValue({ id: userId, email: "ada@example.com" });
    tokenCreate.mockResolvedValue({ id: resetTokenId, tokenHash: "hashed-token" });
    sendPasswordResetEmail.mockRejectedValue(new Error("Resend unavailable"));
    jest.spyOn(console, "error").mockImplementation(() => undefined);

    await request(app)
      .post("/api/auth/password-reset/request")
      .send({ email: "ada@example.com" })
      .expect(500);

    expect(tokenDeleteMany).toHaveBeenLastCalledWith({ where: { id: resetTokenId } });
  });

  it("validates a live token and rejects expired or used tokens", async () => {
    tokenFindUnique
      .mockResolvedValueOnce({ usedAt: null, expiresAt: new Date(Date.now() + 60_000) })
      .mockResolvedValueOnce({ usedAt: null, expiresAt: new Date(Date.now() - 60_000) })
      .mockResolvedValueOnce({ usedAt: new Date(), expiresAt: new Date(Date.now() + 60_000) });

    await request(app)
      .get("/api/auth/password-reset/validate")
      .query({ token: "live-token" })
      .expect(200, { valid: true });
    await request(app)
      .get("/api/auth/password-reset/validate")
      .query({ token: "expired-token" })
      .expect(400);
    await request(app)
      .get("/api/auth/password-reset/validate")
      .query({ token: "used-token" })
      .expect(400);
  });

  it("atomically consumes a token and stores the new password as a bcrypt hash", async () => {
    tokenFindUnique.mockResolvedValue({
      id: resetTokenId,
      userId,
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    tokenUpdateMany.mockResolvedValue({ count: 1 });
    userUpdate.mockResolvedValue({ id: userId });

    await request(app)
      .post("/api/auth/password-reset/confirm")
      .send({ token: "live-token", password: "newpassword" })
      .expect(200, { message: "Your password has been reset successfully." });

    expect(tokenUpdateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: resetTokenId,
        usedAt: null,
        expiresAt: expect.any(Object),
      }),
      data: { usedAt: expect.any(Date) },
    });
    const updateCall = userUpdate.mock.calls[0]?.[0] as { data: { password: string } };
    expect(await bcrypt.compare("newpassword", updateCall.data.password)).toBe(true);
  });

  it("rejects a concurrent second use without changing the password", async () => {
    tokenFindUnique.mockResolvedValue({
      id: resetTokenId,
      userId,
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    tokenUpdateMany.mockResolvedValue({ count: 0 });

    await request(app)
      .post("/api/auth/password-reset/confirm")
      .send({ token: "live-token", password: "newpassword" })
      .expect(400);

    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("validates password length at the API boundary", async () => {
    await request(app)
      .post("/api/auth/password-reset/confirm")
      .send({ token: "live-token", password: "short" })
      .expect(400);

    expect(transactionMock).not.toHaveBeenCalled();
  });
});
