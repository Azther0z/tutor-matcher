import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";

const userFindUniqueOrThrow = jest.fn<(args: unknown) => Promise<unknown>>();
const userUpdate = jest.fn<(args: unknown) => Promise<unknown>>();
const userGet = jest.fn<(args: unknown) => Promise<unknown>>();
const tutorCreate = jest.fn<(args: unknown) => Promise<unknown>>();
const tutorUpdate = jest.fn<(args: unknown) => Promise<unknown>>();
const transaction = jest.fn<(callback: (tx: unknown) => Promise<unknown>) => Promise<unknown>>();

const tx = {
  user: { findUniqueOrThrow: userFindUniqueOrThrow, update: userUpdate },
  tutor: { create: tutorCreate, update: tutorUpdate },
};

jest.unstable_mockModule("../../lib/db.ts", () => ({
  prisma: { $transaction: transaction, user: { findUniqueOrThrow: userGet } },
}));

const { app } = await import("../../app.ts");
const { signAuthToken } = await import("../../lib/jwt.ts");

const profile = {
  tutor: {
    avatarUrl: "https://example.com/avatar.jpg",
    bio: "I teach calculus.",
    introVideoUrl: "https://example.com/intro.mp4",
    governmentId: "ID-123",
  },
};

// Shape prisma returns from `userSelect`. `isTutor` is derived from `tutorId` by
// the service, so a non-null `tutorId` here yields `isTutor: true` in responses.
const userRow = {
  id: 1,
  email: "tutor@example.com",
  firstName: "Ada",
  lastName: "Lovelace",
  bio: "Mathematics tutor",
  tutorId: 8,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

function tokenFor(userId: number) {
  return signAuthToken({ sub: userId, email: "tutor@example.com", isAdmin: false });
}

describe("GET /api/profiles/me", () => {
  beforeEach(() => {
    userGet.mockReset();
  });

  it("requires authentication", async () => {
    await request(app).get("/api/profiles/me").expect(401);
    expect(userGet).not.toHaveBeenCalled();
  });

  it("returns the current user with a derived isTutor flag", async () => {
    userGet.mockResolvedValue(userRow);

    const res = await request(app)
      .get("/api/profiles/me")
      .set("Authorization", `Bearer ${tokenFor(1)}`)
      .expect(200);

    expect(userGet).toHaveBeenCalledWith({ where: { id: 1 }, select: expect.any(Object) });
    expect(res.body).toMatchObject({ id: 1, email: "tutor@example.com", isTutor: true });
    expect(res.body).not.toHaveProperty("password");
    expect(res.body).not.toHaveProperty("tutorId");
  });

  it("reports isTutor false when the account has no linked Tutor", async () => {
    userGet.mockResolvedValue({ ...userRow, tutorId: null });

    const res = await request(app)
      .get("/api/profiles/me")
      .set("Authorization", `Bearer ${tokenFor(1)}`)
      .expect(200);

    expect(res.body.isTutor).toBe(false);
  });
});

describe("PUT /api/profiles/me", () => {
  beforeEach(() => {
    userFindUniqueOrThrow.mockReset();
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

  it("makes the account a Tutor by creating and linking a Tutor profile on first save", async () => {
    userFindUniqueOrThrow.mockResolvedValueOnce({ tutorId: null });
    tutorCreate.mockResolvedValue({ id: 8, ...profile.tutor });
    userUpdate.mockResolvedValue(userRow);

    const res = await request(app)
      .put("/api/profiles/me")
      .set("Authorization", `Bearer ${tokenFor(1)}`)
      .send(profile)
      .expect(200);

    expect(tutorCreate).toHaveBeenCalledWith({ data: expect.objectContaining(profile.tutor) });
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { tutor: { connect: { id: 8 } } },
      select: expect.any(Object),
    });
    expect(res.body.user.isTutor).toBe(true);
    expect(res.body.user).not.toHaveProperty("password");
    expect(res.body.user).not.toHaveProperty("tutorId");
    expect(res.body.tutor).toMatchObject(profile.tutor);
  });

  it("updates an existing linked Tutor profile without touching the user record", async () => {
    userFindUniqueOrThrow.mockResolvedValue(userRow);
    tutorUpdate.mockResolvedValue({ id: 8, ...profile.tutor });

    await request(app)
      .put("/api/profiles/me")
      .set("Authorization", `Bearer ${tokenFor(1)}`)
      .send(profile)
      .expect(200);

    expect(tutorUpdate).toHaveBeenCalledWith({ where: { id: 8 }, data: profile.tutor });
    expect(tutorCreate).not.toHaveBeenCalled();
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("ignores personal fields sent in the body", async () => {
    userFindUniqueOrThrow.mockResolvedValueOnce({ tutorId: null });
    tutorCreate.mockResolvedValue({ id: 8, ...profile.tutor });
    userUpdate.mockResolvedValue(userRow);

    await request(app)
      .put("/api/profiles/me")
      .set("Authorization", `Bearer ${tokenFor(1)}`)
      .send({ ...profile, user: { firstName: "Hacker", lastName: "McHack", bio: "nope" } })
      .expect(200);

    expect(tutorCreate).toHaveBeenCalledWith({ data: expect.objectContaining(profile.tutor) });
    const userUpdateData = (userUpdate.mock.calls[0]![0] as { data: Record<string, unknown> }).data;
    expect(userUpdateData).not.toHaveProperty("firstName");
    expect(userUpdateData).not.toHaveProperty("lastName");
  });
});
