import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";

const create = jest.fn<(args: unknown) => Promise<unknown>>();
const findUnique = jest.fn<(args: unknown) => Promise<unknown>>();

jest.unstable_mockModule("../../lib/db.ts", () => ({
  prisma: { user: { create, findUnique } },
}));

const { app } = await import("../../app.ts");

describe("POST /api/auth/signup", () => {
  beforeEach(() => {
    create.mockReset();
    findUnique.mockReset();
    findUnique.mockResolvedValue(null);
  });

  it("creates a non-tutor user by default", async () => {
    create.mockResolvedValue({
      id: 1,
      email: "ada@example.com",
      isTutor: false,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const res = await request(app)
      .post("/api/auth/signup")
      .send({ email: "ada@example.com", password: "supersecret" })
      .expect(201);

    expect(res.body).toMatchObject({ id: 1, email: "ada@example.com", isTutor: false });
    expect(res.body).not.toHaveProperty("password");
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "ada@example.com",
        password: "supersecret",
        isTutor: false,
        balance: 10000,
      }),
    });
  });

  it("creates a tutor user when isTutor is true", async () => {
    create.mockResolvedValue({
      id: 2,
      email: "grace@example.com",
      isTutor: true,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const res = await request(app)
      .post("/api/auth/signup")
      .send({ email: "grace@example.com", password: "supersecret", isTutor: true })
      .expect(201);

    expect(res.body).toMatchObject({ id: 2, email: "grace@example.com", isTutor: true });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ isTutor: true }),
    });
  });

  it("rejects an invalid body with 400", async () => {
    await request(app)
      .post("/api/auth/signup")
      .send({ email: "not-an-email", password: "short" })
      .expect(400);

    expect(create).not.toHaveBeenCalled();
  });

  it("rejects a non-boolean isTutor with 400", async () => {
    await request(app)
      .post("/api/auth/signup")
      .send({ email: "ada@example.com", password: "supersecret", isTutor: "yes" })
      .expect(400);

    expect(create).not.toHaveBeenCalled();
  });

  it("returns 409 when the email is already taken", async () => {
    findUnique.mockResolvedValue({ id: 7 });

    await request(app)
      .post("/api/auth/signup")
      .send({ email: "ada@example.com", password: "supersecret" })
      .expect(409);

    expect(create).not.toHaveBeenCalled();
  });

  it("returns 409 when a concurrent signup wins the race (DB unique constraint)", async () => {
    create.mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }));

    await request(app)
      .post("/api/auth/signup")
      .send({ email: "ada@example.com", password: "supersecret" })
      .expect(409);
  });
});

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    findUnique.mockReset();
  });

  it("returns a token and the user when the credentials match", async () => {
    findUnique.mockResolvedValue({
      id: 1,
      email: "ada@example.com",
      password: "supersecret",
      isAdmin: false,
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "ada@example.com", password: "supersecret" })
      .expect(200);

    expect(res.body.user).toEqual({ id: 1, email: "ada@example.com", isAdmin: false });
    expect(typeof res.body.token).toBe("string");
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
      id: 1,
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
