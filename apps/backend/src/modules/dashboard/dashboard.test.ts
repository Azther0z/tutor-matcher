import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import request from "supertest";

const mock = () => jest.fn<(...args: unknown[]) => Promise<unknown>>();
const user = { findUnique: mock() };
const booking = { groupBy: mock(), count: mock() };
const review = { aggregate: mock(), findMany: mock() };
const reviewFlag = { findMany: mock() };
jest.unstable_mockModule("../../lib/db.ts", () => ({
  prisma: { user, booking, review, reviewFlag },
}));
const { app } = await import("../../app.ts");
const { signAuthToken } = await import("../../lib/jwt.ts");
const { bangkokWeekWindow, getTutorDashboard } = await import("./dashboard.service.ts");
const userId = "11111111-1111-4111-8111-111111111111";
const tutorId = "22222222-2222-4222-8222-222222222222";
const token = signAuthToken({ sub: userId, email: "tutor@example.com", isAdmin: false });
const now = new Date("2026-11-12T04:00:00Z");

beforeEach(() => {
  jest.clearAllMocks();
  user.findUnique.mockResolvedValue({ tutorId });
  booking.groupBy.mockReset().mockResolvedValue([]);
  booking.count.mockResolvedValue(0);
  review.aggregate.mockResolvedValue({ _avg: { ratingStars: null }, _count: 0 });
  reviewFlag.findMany.mockReset().mockResolvedValue([]);
  review.findMany.mockResolvedValue([]);
});

describe("Tutor dashboard authorization", () => {
  it("requires authentication before reading any teaching data", async () => {
    await request(app).get("/api/dashboard/tutor").expect(401);
    expect(user.findUnique).not.toHaveBeenCalled();
    expect(booking.groupBy).not.toHaveBeenCalled();
  });

  it("rejects Students and pending applicants without querying bookings or reviews", async () => {
    user.findUnique.mockResolvedValue({ tutorId: null });
    const response = await request(app)
      .get("/api/dashboard/tutor")
      .set("Authorization", `Bearer ${token}`)
      .expect(403);
    expect(response.body.message).toMatch(/Only approved Tutors/);
    expect(booking.groupBy).not.toHaveBeenCalled();
    expect(review.findMany).not.toHaveBeenCalled();
  });

  it("resolves the Tutor from the authenticated account and scopes every query to it", async () => {
    await request(app)
      .get("/api/dashboard/tutor?tutorId=another-tutor")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(user.findUnique).toHaveBeenCalledWith({
      where: { id: userId },
      select: { tutorId: true },
    });
    for (const fn of [booking.groupBy, booking.count, review.aggregate, review.findMany]) {
      for (const [args] of fn.mock.calls) {
        expect(args).toEqual(
          expect.objectContaining({
            where: expect.objectContaining({ subject: { tutorId } }),
          })
        );
      }
    }
  });
});

describe("Tutor dashboard statistics", () => {
  it("returns zero statistics and an unrated state for a new Tutor", async () => {
    expect(await getTutorDashboard(userId, now)).toEqual({
      tutorId,
      classesThisWeek: 0,
      week: { start: "2026-11-08T17:00:00.000Z", end: "2026-11-15T17:00:00.000Z" },
      lessons: { completed: 0, confirmed: 0, pendingPayment: 0, cancelled: 0 },
      students: { total: 0, withCompletedLessons: 0, returning: 0, returningRate: null },
      reviews: { count: 0, averageRating: null, recent: [] },
    });
  });

  it("keeps confirmed and completed bookings distinct and counts unique and returning Students", async () => {
    booking.groupBy
      .mockResolvedValueOnce([
        { status: "CONFIRMED", _count: 8 },
        { status: "COMPLETED", _count: 7 },
        { status: "CANCELLED", _count: 3 },
        { status: "PENDING_PAYMENT", _count: 2 },
      ])
      .mockResolvedValueOnce([
        { userId: "a", _count: 6 },
        { userId: "b", _count: 5 },
        { userId: "c", _count: 3 },
        { userId: "d", _count: 1 },
      ])
      .mockResolvedValueOnce([
        { userId: "a", _count: 3 },
        { userId: "b", _count: 3 },
        { userId: "c", _count: 1 },
      ]);
    booking.count.mockResolvedValue(4);
    const result = await getTutorDashboard(userId, now);
    expect(result.lessons).toEqual({ completed: 7, confirmed: 8, pendingPayment: 2, cancelled: 3 });
    expect(result.students).toEqual({
      total: 4,
      withCompletedLessons: 3,
      returning: 2,
      returningRate: 67,
    });
    expect(booking.groupBy).toHaveBeenNthCalledWith(2, {
      by: ["userId"],
      where: { subject: { tutorId }, status: { in: ["CONFIRMED", "COMPLETED"] } },
      _count: true,
    });
    expect(booking.groupBy).toHaveBeenNthCalledWith(3, {
      by: ["userId"],
      where: { subject: { tutorId }, status: "COMPLETED" },
      _count: true,
    });
    expect(booking.count).toHaveBeenCalledWith({
      where: {
        subject: { tutorId },
        status: { in: ["CONFIRMED", "COMPLETED"] },
        startedAt: { gte: new Date("2026-11-08T17:00:00Z"), lt: new Date("2026-11-15T17:00:00Z") },
      },
    });
  });

  it("uses the full review aggregate rather than only the recent page and hides private identity", async () => {
    review.aggregate.mockResolvedValue({ _avg: { ratingStars: 4.6666667 }, _count: 12 });
    review.findMany.mockResolvedValue([
      {
        id: "review-1",
        ratingStars: 3,
        text: "Very clear explanation",
        createdAt: now,
        user: { firstName: "Mali", lastName: "Sukjai" },
        subject: { id: "subject-1", name: "Math" },
        replyText: "Thank you for your feedback",
        repliedAt: now,
        replyEditedAt: now,
      },
    ]);
    const result = await getTutorDashboard(userId, now);
    expect(result.reviews).toEqual({
      count: 12,
      averageRating: 4.7,
      recent: [
        {
          id: "review-1",
          flaggedByMe: false,
          ratingStars: 3,
          text: "Very clear explanation",
          createdAt: now.toISOString(),
          studentName: "Mali S.",
          subject: { id: "subject-1", name: "Math" },
          reply: {
            text: "Thank you for your feedback",
            repliedAt: now.toISOString(),
            editedAt: now.toISOString(),
          },
        },
      ],
    });
    expect(review.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5, orderBy: [{ createdAt: "desc" }, { id: "desc" }] })
    );
    expect(JSON.stringify(result)).not.toContain("Sukjai");
  });

  it("marks the recent reviews the Tutor already flagged", async () => {
    const recent = (id: string) => ({
      id,
      ratingStars: 1,
      text: "Rude comment",
      createdAt: now,
      user: { firstName: "Mali", lastName: "Sukjai" },
      subject: { id: "subject-1", name: "Math" },
      replyText: null,
      repliedAt: null,
      replyEditedAt: null,
    });
    review.findMany.mockResolvedValue([recent("review-1"), recent("review-2")]);
    reviewFlag.findMany.mockResolvedValue([{ reviewId: "review-2" }]);

    const result = await getTutorDashboard(userId, now);

    expect(result.reviews.recent.map(({ id, flaggedByMe }) => [id, flaggedByMe])).toEqual([
      ["review-1", false],
      ["review-2", true],
    ]);
    expect(reviewFlag.findMany).toHaveBeenCalledWith({
      where: { reporterId: userId, reviewId: { in: ["review-1", "review-2"] } },
      select: { reviewId: true },
    });
  });

  it("does not look up flags when there are no reviews", async () => {
    review.findMany.mockResolvedValue([]);
    await getTutorDashboard(userId, now);
    expect(reviewFlag.findMany).not.toHaveBeenCalled();
  });
});

it("switches the weekly window exactly at Monday midnight Bangkok time", () => {
  expect(bangkokWeekWindow(new Date("2026-11-08T16:59:59.999Z"))).toEqual({
    start: new Date("2026-11-01T17:00:00Z"),
    end: new Date("2026-11-08T17:00:00Z"),
  });
  expect(bangkokWeekWindow(new Date("2026-11-08T17:00:00.000Z"))).toEqual({
    start: new Date("2026-11-08T17:00:00Z"),
    end: new Date("2026-11-15T17:00:00Z"),
  });
});
