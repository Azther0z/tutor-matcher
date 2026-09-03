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

  it("creates a user from email and password", async () => {
    create.mockResolvedValue({
      id: 1,
      email: "ada@example.com",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const res = await request(app)
      .post("/api/auth/signup")
      .send({ email: "ada@example.com", password: "supersecret" })
      .expect(201);

    expect(res.body).toMatchObject({ id: 1, email: "ada@example.com" });
    expect(res.body).not.toHaveProperty("password");
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ email: "ada@example.com", password: "supersecret" }),
    });
  });

  it("rejects an invalid body with 400", async () => {
    await request(app)
      .post("/api/auth/signup")
      .send({ email: "not-an-email", password: "short" })
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
