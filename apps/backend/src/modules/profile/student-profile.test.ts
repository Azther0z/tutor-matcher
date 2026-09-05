import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";

const learningAreaCount = jest.fn<(args: unknown) => Promise<number>>();
const learningAreaFindMany = jest.fn<(args: unknown) => Promise<unknown[]>>();
const studentFindUnique = jest.fn<(args: unknown) => Promise<unknown>>();
const studentUpsert = jest.fn<(args: unknown) => Promise<unknown>>();
const transaction = jest.fn<(callback: (tx: unknown) => Promise<unknown>) => Promise<unknown>>();

const tx = {
  student: { upsert: studentUpsert },
};

jest.unstable_mockModule("../../lib/db.ts", () => ({
  prisma: {
    learningArea: { count: learningAreaCount, findMany: learningAreaFindMany },
    student: { findUnique: studentFindUnique },
    $transaction: transaction,
  },
}));

const { app } = await import("../../app.ts");
const { signAuthToken } = await import("../../lib/jwt.ts");

const profile = {
  educationLevel: "UPPER_SECONDARY_SCHOOL",
  learningAreaIds: [1, 2],
  goals: ["EXAM_PREPARATION", "IMPROVE_PERFORMANCE"],
  preferredLearningPeriod: "EVENING",
  preferredDurationMinutes: 60,
};

const savedStudent = {
  id: 4,
  userId: 1,
  educationLevel: profile.educationLevel,
  goals: profile.goals,
  preferredLearningPeriod: profile.preferredLearningPeriod,
  preferredDurationMinutes: profile.preferredDurationMinutes,
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  learningAreas: [
    { learningArea: { id: 1, name: "Mathematics" } },
    { learningArea: { id: 2, name: "English" } },
  ],
};

function tokenFor(userId = 1) {
  return signAuthToken({ sub: userId, email: "student@example.com", isAdmin: false });
}

describe("Student profile API", () => {
  beforeEach(() => {
    learningAreaCount.mockReset();
    learningAreaFindMany.mockReset();
    studentFindUnique.mockReset();
    studentUpsert.mockReset();
    transaction.mockReset();
    transaction.mockImplementation(async (callback) => callback(tx));
    learningAreaCount.mockResolvedValue(2);
  });

  it("requires authentication", async () => {
    await request(app).put("/api/profiles/me/student").send(profile).expect(401);
    expect(studentUpsert).not.toHaveBeenCalled();
  });

  it("rejects incomplete profile data", async () => {
    await request(app)
      .put("/api/profiles/me/student")
      .set("Authorization", `Bearer ${tokenFor()}`)
      .send({ ...profile, goals: [] })
      .expect(400);

    expect(learningAreaCount).not.toHaveBeenCalled();
  });

  it("rejects duplicate learning-area selections", async () => {
    await request(app)
      .put("/api/profiles/me/student")
      .set("Authorization", `Bearer ${tokenFor()}`)
      .send({ ...profile, learningAreaIds: [1, 1] })
      .expect(400);

    expect(learningAreaCount).not.toHaveBeenCalled();
  });

  it("rejects learning-area IDs that do not exist", async () => {
    learningAreaCount.mockResolvedValue(1);

    await request(app)
      .put("/api/profiles/me/student")
      .set("Authorization", `Bearer ${tokenFor()}`)
      .send(profile)
      .expect(400);

    expect(studentUpsert).not.toHaveBeenCalled();
  });

  it("saves a complete Student profile", async () => {
    studentUpsert.mockResolvedValue(savedStudent);

    const response = await request(app)
      .put("/api/profiles/me/student")
      .set("Authorization", `Bearer ${tokenFor()}`)
      .send(profile)
      .expect(200);

    expect(studentUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 1 },
        create: expect.objectContaining({
          userId: 1,
          educationLevel: profile.educationLevel,
          goals: profile.goals,
          preferredLearningPeriod: profile.preferredLearningPeriod,
          preferredDurationMinutes: profile.preferredDurationMinutes,
        }),
      })
    );
    expect(response.body).toMatchObject({
      id: 4,
      userId: 1,
      learningAreas: [
        { id: 1, name: "Mathematics" },
        { id: 2, name: "English" },
      ],
    });
  });

  it("returns learning-area suggestions", async () => {
    learningAreaFindMany.mockResolvedValue([{ id: 1, name: "Mathematics" }]);

    const response = await request(app)
      .get("/api/profiles/learning-areas")
      .set("Authorization", `Bearer ${tokenFor()}`)
      .query({ search: "math" })
      .expect(200);

    expect(response.body).toEqual([{ id: 1, name: "Mathematics" }]);
    expect(learningAreaFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { name: { contains: "math", mode: "insensitive" } },
        take: 20,
      })
    );
  });

  it("returns 404 when onboarding has not been completed", async () => {
    studentFindUnique.mockResolvedValue(null);

    await request(app)
      .get("/api/profiles/me/student")
      .set("Authorization", `Bearer ${tokenFor()}`)
      .expect(404);
  });
});
