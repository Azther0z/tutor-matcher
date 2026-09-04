import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";
import { signAuthToken } from "../../lib/jwt.ts";

const findUser = jest.fn<(args: unknown) => Promise<unknown>>();
const createUser = jest.fn<(args: unknown) => Promise<unknown>>();
const findStudentProfile = jest.fn<(args: unknown) => Promise<unknown>>();
const upsertStudentProfile = jest.fn<(args: unknown) => Promise<unknown>>();

jest.unstable_mockModule("../../lib/db.ts", () => ({
  prisma: {
    user: { findUnique: findUser, create: createUser },
    studentProfile: { findUnique: findStudentProfile, upsert: upsertStudentProfile },
  },
}));

const { app } = await import("../../app.ts");

const token = signAuthToken({ sub: 42, email: "student@example.com", isAdmin: false });
const savedProfile = {
  id: 1,
  userId: 42,
  level: "Beginner",
  goals: "Prepare for algebra exams",
  preferredWeekdays: [1, 3],
  preferredStartMinute: 540,
  preferredEndMinute: 660,
  timezone: "UTC",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  subjects: [{ id: 1, profileId: 1, name: "Mathematics" }],
};

describe("student profile API", () => {
  beforeEach(() => {
    findUser.mockReset();
    createUser.mockReset();
    findStudentProfile.mockReset();
    upsertStudentProfile.mockReset();
  });

  it("requires authentication to read preferences", async () => {
    await request(app).get("/api/profiles/student").expect(401);
    expect(findStudentProfile).not.toHaveBeenCalled();
  });

  it("returns the saved student profile", async () => {
    findStudentProfile.mockResolvedValue(savedProfile);

    const response = await request(app)
      .get("/api/profiles/student")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.body.profile).toMatchObject({
      userId: 42,
      level: "Beginner",
      subjects: [{ name: "Mathematics" }],
    });
  });

  it("saves complete student preferences", async () => {
    upsertStudentProfile.mockResolvedValue(savedProfile);

    const response = await request(app)
      .put("/api/profiles/student")
      .set("Authorization", `Bearer ${token}`)
      .send({
        subjects: ["Mathematics"],
        level: "Beginner",
        goals: "Prepare for algebra exams",
        preferredWeekdays: [1, 3],
        preferredStartMinute: 540,
        preferredEndMinute: 660,
        timezone: "UTC",
      })
      .expect(200);

    expect(response.body.profile).toMatchObject({
      level: "Beginner",
      goals: "Prepare for algebra exams",
    });
    expect(upsertStudentProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 42 },
        create: expect.objectContaining({ level: "Beginner", goals: "Prepare for algebra exams" }),
      })
    );
  });

  it("rejects incomplete preferences without writing", async () => {
    await request(app)
      .put("/api/profiles/student")
      .set("Authorization", `Bearer ${token}`)
      .send({ subjects: [], level: "Beginner", goals: "" })
      .expect(400);

    expect(upsertStudentProfile).not.toHaveBeenCalled();
  });

  it("rejects an invalid schedule", async () => {
    await request(app)
      .put("/api/profiles/student")
      .set("Authorization", `Bearer ${token}`)
      .send({
        subjects: ["Mathematics"],
        level: "Beginner",
        goals: "Prepare for exams",
        preferredStartMinute: 720,
        preferredEndMinute: 600,
      })
      .expect(400);

    expect(upsertStudentProfile).not.toHaveBeenCalled();
  });
});
