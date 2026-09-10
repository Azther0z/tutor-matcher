import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";

const create = jest.fn<(args: unknown) => Promise<unknown>>();
const findUnique = jest.fn<(args: unknown) => Promise<unknown>>();
const userId = "11111111-1111-4111-8111-111111111111";
const otherUserId = "77777777-7777-4777-8777-777777777777";

jest.unstable_mockModule("../../lib/db.ts", () => ({
  prisma: { user: { create, findUnique } },
}));

const { app } = await import("../../app.ts");
const { verifyAuthToken } = await import("../../lib/jwt.ts");

describe("POST /api/auth/signup", () => {
  beforeEach(() => {
    create.mockReset();
    findUnique.mockReset();
    findUnique.mockResolvedValue(null);
  });

  it("creates a user", async () => {
    create.mockResolvedValue({
      id: userId,
      email: "ada@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const res = await request(app)
      .post("/api/auth/signup")
      .send({
        email: "ada@example.com",
        password: "supersecret",
        firstName: "Ada",
        lastName: "Lovelace",
      })
      .expect(201);

    expect(res.body).toMatchObject({
      id: 1,
      email: "ada@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
    });
    expect(res.body).not.toHaveProperty("password");
    expect(res.body).not.toHaveProperty("isTutor");
    expect(create).toHaveBeenCalledWith({
      data: {
        email: "ada@example.com",
        password: "supersecret",
        firstName: "Ada",
        lastName: "Lovelace",
        bio: null,
      },
    });
  });

  it("persists the optional bio when provided", async () => {
    create.mockResolvedValue({
      id: 3,
      email: "grace@example.com",
      firstName: "Grace",
      lastName: "Hopper",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    await request(app)
      .post("/api/auth/signup")
      .send({
        email: "grace@example.com",
        password: "supersecret",
        firstName: "Grace",
        lastName: "Hopper",
        bio: "Compiler pioneer.",
      })
      .expect(201);

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        firstName: "Grace",
        lastName: "Hopper",
        bio: "Compiler pioneer.",
      }),
    });
  });

  it("rejects a whitespace-only name with 400", async () => {
    await request(app)
      .post("/api/auth/signup")
      .send({
        email: "grace@example.com",
        password: "supersecret",
        firstName: "   ",
        lastName: "Hopper",
      })
      .expect(400);

    expect(create).not.toHaveBeenCalled();
  });

  it("ignores an isTutor field in the body", async () => {
    create.mockResolvedValue({
      id: 2,
      email: "grace@example.com",
      firstName: "Grace",
      lastName: "Hopper",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    await request(app)
      .post("/api/auth/signup")
      .send({
        email: "grace@example.com",
        password: "supersecret",
        firstName: "Grace",
        lastName: "Hopper",
        isTutor: true,
      })
      .expect(201);

    expect(create).toHaveBeenCalledWith({
      data: expect.not.objectContaining({ isTutor: expect.anything() }),
    });
  });

  it("rejects an invalid body with 400", async () => {
    await request(app)
      .post("/api/auth/signup")
      .send({ email: "not-an-email", password: "short" })
      .expect(400);

    expect(create).not.toHaveBeenCalled();
  });

  it("rejects a missing first or last name with 400", async () => {
    await request(app)
      .post("/api/auth/signup")
      .send({ email: "ada@example.com", password: "supersecret", firstName: "Ada" })
      .expect(400);

    await request(app)
      .post("/api/auth/signup")
      .send({ email: "ada@example.com", password: "supersecret", firstName: "  ", lastName: "  " })
      .expect(400);

    expect(create).not.toHaveBeenCalled();
  });

  it("returns 409 when the email is already taken", async () => {
    findUnique.mockResolvedValue({ id: otherUserId });

    await request(app)
      .post("/api/auth/signup")
      .send({
        email: "ada@example.com",
        password: "supersecret",
        firstName: "Ada",
        lastName: "Lovelace",
      })
      .expect(409);

    expect(create).not.toHaveBeenCalled();
  });

  it("returns 409 when a concurrent signup wins the race (DB unique constraint)", async () => {
    create.mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }));

    await request(app)
      .post("/api/auth/signup")
      .send({
        email: "ada@example.com",
        password: "supersecret",
        firstName: "Ada",
        lastName: "Lovelace",
      })
      .expect(409);
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
});
