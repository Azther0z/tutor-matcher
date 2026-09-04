import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";

const findUnique = jest.fn<(args: unknown) => Promise<unknown>>();
const userUpdate = jest.fn<(args: unknown) => Promise<unknown>>();
const tutorCreate = jest.fn<(args: unknown) => Promise<unknown>>();
const tutorUpdate = jest.fn<(args: unknown) => Promise<unknown>>();
const transaction = jest.fn<(callback: (tx: unknown) => Promise<unknown>) => Promise<unknown>>();

const tx = {
  user: { findUnique, update: userUpdate },
  tutor: { create: tutorCreate, update: tutorUpdate },
};

jest.unstable_mockModule("../../lib/db.ts", () => ({
  prisma: { $transaction: transaction },
}));

const { app } = await import("../../app.ts");
const { signAuthToken } = await import("../../lib/jwt.ts");

const profile = {
  user: { firstName: "Ada", lastName: "Lovelace", bio: "Mathematics tutor" },
  tutor: {
    avatarUrl: "https://example.com/avatar.jpg",
    bio: "I teach calculus.",
    introVideoUrl: "https://example.com/intro.mp4",
    governmentId: "ID-123",
  },
};

function tokenFor(userId: number) {
  return signAuthToken({ sub: userId, email: "tutor@example.com", isAdmin: false });
}

describe("PUT /api/profiles/me", () => {
  beforeEach(() => {
    findUnique.mockReset();
    userUpdate.mockReset();
    tutorCreate.mockReset();
    tutorUpdate.mockReset();
    transaction.mockReset();
    transaction.mockImplementation(async (callback) => callback(tx));
  });

  it("requires authentication", async () => {
    await request(app).put("/api/profiles/me").send(profile).expect(401);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects invalid profile data", async () => {
    await request(app)
      .put("/api/profiles/me")
      .set("Authorization", `Bearer ${tokenFor(1)}`)
      .send({ ...profile, tutor: { ...profile.tutor, governmentId: "" } })
      .expect(400);

    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects a Student", async () => {
    findUnique.mockResolvedValue({ isTutor: false, tutorId: null });

    await request(app)
      .put("/api/profiles/me")
      .set("Authorization", `Bearer ${tokenFor(1)}`)
      .send(profile)
      .expect(403);

    expect(tutorCreate).not.toHaveBeenCalled();
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("creates and links a Tutor profile for a Tutor", async () => {
    findUnique.mockResolvedValue({ isTutor: true, tutorId: null });
    tutorCreate.mockResolvedValue({ id: 8, ...profile.tutor });
    userUpdate.mockResolvedValue({
      id: 1,
      email: "tutor@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      bio: "Mathematics tutor",
      isTutor: true,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const res = await request(app)
      .put("/api/profiles/me")
      .set("Authorization", `Bearer ${tokenFor(1)}`)
      .send(profile)
      .expect(200);

    expect(tutorCreate).toHaveBeenCalledWith({ data: expect.objectContaining(profile.tutor) });
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({ tutor: { connect: { id: 8 } } }),
      select: expect.any(Object),
    });
    expect(res.body.user).not.toHaveProperty("password");
    expect(res.body.tutor).toMatchObject(profile.tutor);
  });

  it("updates an existing linked Tutor profile", async () => {
    findUnique.mockResolvedValue({ isTutor: true, tutorId: 8 });
    tutorUpdate.mockResolvedValue({ id: 8, ...profile.tutor });
    userUpdate.mockResolvedValue({
      id: 1,
      email: "tutor@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      bio: "Mathematics tutor",
      isTutor: true,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    await request(app)
      .put("/api/profiles/me")
      .set("Authorization", `Bearer ${tokenFor(1)}`)
      .send(profile)
      .expect(200);

    expect(tutorUpdate).toHaveBeenCalledWith({ where: { id: 8 }, data: profile.tutor });
    expect(tutorCreate).not.toHaveBeenCalled();
  });
});
