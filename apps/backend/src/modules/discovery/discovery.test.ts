import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";
import { signAuthToken } from "../../lib/jwt.ts";

const findUser = jest.fn<(args: unknown) => Promise<unknown>>();
const createUser = jest.fn<(args: unknown) => Promise<unknown>>();
const findStudentProfile = jest.fn<(args: unknown) => Promise<unknown>>();
const findTutors = jest.fn<(args: unknown) => Promise<unknown>>();

jest.unstable_mockModule("../../lib/db.ts", () => ({
  prisma: {
    user: { findUnique: findUser, create: createUser },
    studentProfile: { findUnique: findStudentProfile },
    tutor: { findMany: findTutors },
  },
}));

const { getRecommendations } = await import("./discovery.service.ts");
const { app } = await import("../../app.ts");

const token = signAuthToken({ sub: 42, email: "student@example.com", isAdmin: false });
const matchedSlot = new Date("2099-06-15T10:00:00.000Z");
const studentProfile = {
  id: 1,
  userId: 42,
  level: "Beginner",
  goals: "Prepare for algebra exams",
  preferredWeekdays: [matchedSlot.getUTCDay() || 7],
  preferredStartMinute: 540,
  preferredEndMinute: 660,
  timezone: "UTC",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  subjects: [{ id: 1, profileId: 1, name: "Mathematics" }],
};

function tutorFixture({
  id,
  subject,
  bio,
  rating,
  slot,
  bookingId = null,
}: {
  id: number;
  subject: string;
  bio: string;
  rating: number;
  slot: Date;
  bookingId?: number | null;
}) {
  return {
    id,
    avatarUrl: null,
    bio,
    user: { firstName: `Tutor${id}`, lastName: "Example" },
    subjects: [
      {
        id: id * 10,
        name: subject,
        description: "Exam preparation and problem solving",
        hourlyRate: 25,
        availabilitySubjects: [{ availability: { id: id * 100, startedAt: slot, bookingId } }],
        reviews: [{ ratingStars: rating }],
      },
    ],
  };
}

describe("discovery recommendations", () => {
  beforeEach(() => {
    findStudentProfile.mockReset();
    findTutors.mockReset();
  });

  it("ranks subject and schedule matches ahead of higher-rated non-matches", async () => {
    findStudentProfile.mockResolvedValue(studentProfile);
    findTutors.mockResolvedValue([
      tutorFixture({
        id: 1,
        subject: "Mathematics",
        bio: "Algebra tutor",
        rating: 4,
        slot: matchedSlot,
      }),
      tutorFixture({
        id: 2,
        subject: "Physics",
        bio: "Mechanics tutor",
        rating: 5,
        slot: new Date("2099-06-16T10:00:00.000Z"),
      }),
    ]);

    const result = await getRecommendations(42);

    expect(result.rankingMode).toBe("personalized");
    expect(result.recommendations.map((recommendation) => recommendation.tutorId)).toEqual([1, 2]);
    expect(result.recommendations[0]).toMatchObject({
      subjectMatch: true,
      matchedSlotCount: 1,
      availableSlotCount: 1,
    });
  });

  it("uses rating and availability as fallback without a profile", async () => {
    findStudentProfile.mockResolvedValue(null);
    findTutors.mockResolvedValue([
      tutorFixture({
        id: 1,
        subject: "Mathematics",
        bio: "Tutor",
        rating: 4,
        slot: matchedSlot,
      }),
      tutorFixture({
        id: 2,
        subject: "Physics",
        bio: "Tutor",
        rating: 5,
        slot: new Date("2099-06-16T10:00:00.000Z"),
      }),
    ]);

    const result = await getRecommendations(42);

    expect(result.rankingMode).toBe("fallback");
    expect(result.recommendations.map((recommendation) => recommendation.tutorId)).toEqual([2, 1]);
  });

  it("does not count booked or past slots", async () => {
    findStudentProfile.mockResolvedValue(null);
    findTutors.mockResolvedValue([
      {
        ...tutorFixture({
          id: 1,
          subject: "Mathematics",
          bio: "Tutor",
          rating: 5,
          slot: matchedSlot,
        }),
        subjects: [
          {
            ...tutorFixture({
              id: 1,
              subject: "Mathematics",
              bio: "Tutor",
              rating: 5,
              slot: matchedSlot,
            }).subjects[0],
            availabilitySubjects: [
              {
                availability: {
                  id: 101,
                  startedAt: new Date("2020-01-01T10:00:00.000Z"),
                  bookingId: null,
                },
              },
              { availability: { id: 102, startedAt: matchedSlot, bookingId: 7 } },
              {
                availability: {
                  id: 103,
                  startedAt: new Date("2099-06-16T10:00:00.000Z"),
                  bookingId: null,
                },
              },
            ],
          },
        ],
      },
    ]);

    const result = await getRecommendations(42);

    expect(result.recommendations[0]).toMatchObject({
      availableSlotCount: 1,
      nextAvailableAt: "2099-06-16T10:00:00.000Z",
    });
  });

  it("requires authentication at the HTTP endpoint", async () => {
    await request(app).get("/api/discovery/recommendations").expect(401);
    expect(findTutors).not.toHaveBeenCalled();
  });

  it("returns recommendations at the HTTP endpoint", async () => {
    findStudentProfile.mockResolvedValue(null);
    findTutors.mockResolvedValue([]);

    const response = await request(app)
      .get("/api/discovery/recommendations")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.body).toEqual({ rankingMode: "fallback", recommendations: [] });
  });
});
