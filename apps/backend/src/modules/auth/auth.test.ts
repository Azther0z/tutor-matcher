import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";

const create = jest.fn<(args: unknown) => Promise<unknown>>();
const findUnique = jest.fn<(args: unknown) => Promise<unknown>>();
const userId = "11111111-1111-4111-8111-111111111111";
const otherUserId = "77777777-7777-4777-8777-777777777777";

const signupBody = {
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  password: "supersecret",
};

jest.unstable_mockModule("../../lib/db.ts", () => ({
  prisma: { user: { create, findUnique } },
}));

const { app } = await import("../../app.ts");
const { signAuthToken } = await import("../../lib/jwt.ts");
const { verifyAuthToken } = await import("../../lib/jwt.ts");

describe("POST /api/auth/signup", () => {
  beforeEach(() => {
    create.mockReset();
    findUnique.mockReset();
    findUnique.mockResolvedValue(null);
  });

  it("creates a user by default", async () => {
    create.mockResolvedValue({
      id: userId,
      email: "ada@example.com",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const res = await request(app).post("/api/auth/signup").send(signupBody).expect(201);

    expect(res.body).toMatchObject({ id: userId, email: "ada@example.com" });
    expect(res.body).not.toHaveProperty("password");
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.com",
        password: "supersecret",
        bio: null,
      }),
    });
  });

  it("stores an optional bio when one is provided", async () => {
    create.mockResolvedValue({
      id: userId,
      email: "ada@example.com",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    await request(app)
      .post("/api/auth/signup")
      .send({ ...signupBody, bio: "Maths tutor" })
      .expect(201);

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ bio: "Maths tutor" }),
    });
  });

  it("rejects an invalid body with 400", async () => {
    await request(app)
      .post("/api/auth/signup")
      .send({ ...signupBody, email: "not-an-email", password: "short" })
      .expect(400);

    expect(create).not.toHaveBeenCalled();
  });

  it("rejects a body without a name with 400", async () => {
    await request(app)
      .post("/api/auth/signup")
      .send({ email: "ada@example.com", password: "supersecret" })
      .expect(400);

    expect(create).not.toHaveBeenCalled();
  });

  it("returns 409 when the email is already taken", async () => {
    findUnique.mockResolvedValue({ id: otherUserId });

    await request(app).post("/api/auth/signup").send(signupBody).expect(409);

    expect(create).not.toHaveBeenCalled();
  });

  it("returns 409 when a concurrent signup wins the race (DB unique constraint)", async () => {
    create.mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }));

    await request(app).post("/api/auth/signup").send(signupBody).expect(409);
  });
});

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    findUnique.mockReset();
  });

  it("returns a token and the user when the credentials match", async () => {
    findUnique.mockResolvedValue({
      id: userId,
      email: "ada@example.com",
      password: "supersecret",
      isAdmin: false,
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "ada@example.com", password: "supersecret" })
      .expect(200);

    expect(res.body.user).toEqual({ id: userId, email: "ada@example.com", isAdmin: false });
    expect(typeof res.body.token).toBe("string");
    expect(verifyAuthToken(res.body.token)).toEqual({
      sub: userId,
      email: "ada@example.com",
      isAdmin: false,
    });
    expect(res.body.user).not.toHaveProperty("password");
  });

  it("returns 400 for an invalid body", async () => {
    await request(app)
      .post("/api/auth/login")
      .send({ email: "not-an-email", password: "" })
      .expect(400);

    expect(findUnique).not.toHaveBeenCalled();
  });

  it("returns 401 when the email is unknown", async () => {
    findUnique.mockResolvedValue(null);

    await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "supersecret" })
      .expect(401);
  });

  it("returns 401 when the password is wrong", async () => {
    findUnique.mockResolvedValue({
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

  it("returns 403 when the account has been deactivated", async () => {
    findUnique.mockResolvedValue({
      id: 1,
      email: "ada@example.com",
      password: "supersecret",
      isAdmin: false,
      deactivatedAt: new Date("2026-09-06T00:00:00.000Z"),
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "ada@example.com", password: "supersecret" })
      .expect(403);

    expect(res.body).not.toHaveProperty("token");
  });
});

describe("GET /api/auth/me", () => {
  beforeEach(() => {
    findUnique.mockReset();
  });

  it("returns the current user for a valid token", async () => {
    findUnique.mockResolvedValue({
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
    expect(findUnique).not.toHaveBeenCalled();
  });
});
