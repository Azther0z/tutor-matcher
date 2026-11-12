import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import request from "supertest";

type Fn = jest.Mock<(...args: unknown[]) => Promise<unknown>>;
const mock = (): Fn => jest.fn<(...args: unknown[]) => Promise<unknown>>();
const findBooking = mock();
const createReview = mock();
jest.unstable_mockModule("../../lib/db.ts", () => ({
  prisma: { booking: { findUnique: findBooking }, review: { create: createReview } },
}));
const { app } = await import("../../app.ts");
const { signAuthToken } = await import("../../lib/jwt.ts");

const studentId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const bookingId = "33333333-3333-4333-8333-333333333333";
const subjectId = "44444444-4444-4444-8444-444444444444";
const reviewId = "55555555-5555-4555-8555-555555555555";
const createdAt = new Date("2026-11-10T04:00:00.000Z");

const completedBooking = (overrides: object = {}) => ({
  userId: studentId,
  status: "COMPLETED",
  subjectId,
  review: null,
  ...overrides,
});
const submit = (body: object, sub = studentId) =>
  request(app)
    .post("/api/reviews")
    .set(
      "Authorization",
      `Bearer ${signAuthToken({ sub, email: `${sub}@example.com`, isAdmin: false })}`
    )
    .send({ bookingId, rating: 5, ...body });

beforeEach(() => {
  findBooking.mockReset();
  createReview.mockReset();
  createReview.mockImplementation(async (args) => {
    const { data } = args as {
      data: {
        bookingId: string;
        userId: string;
        subjectId: string;
        ratingStars: number;
        text: string | null;
      };
    };
    return { id: reviewId, createdAt, ...data };
  });
});

describe("REV-1 publish a review", () => {
  it("requires authentication", async () => {
    await request(app).post("/api/reviews").send({ bookingId, rating: 5 }).expect(401);
  });

  it("publishes a review of the Student's own completed lesson, scoped to its subject", async () => {
    findBooking.mockResolvedValueOnce(completedBooking());
    const response = await submit({ rating: 4, comment: "  Clear explanations  " }).expect(201);

    expect(response.body.review).toEqual({
      id: reviewId,
      bookingId,
      subjectId,
      rating: 4,
      comment: "Clear explanations",
      createdAt: createdAt.toISOString(),
    });
    // The subject comes from the booking, never from the request.
    expect(createReview).toHaveBeenCalledWith({
      data: { bookingId, userId: studentId, subjectId, ratingStars: 4, text: "Clear explanations" },
    });
  });

  it("stores no comment when it is left empty", async () => {
    findBooking.mockResolvedValueOnce(completedBooking());
    await submit({ rating: 1, comment: "   " }).expect(201);
    expect(createReview).toHaveBeenCalledWith({
      data: expect.objectContaining({ ratingStars: 1, text: null }),
    });
  });

  it.each([0, 6, 4.5, "5", null])("rejects the rating %p with a clear message", async (rating) => {
    const response = await submit({ rating }).expect(400);
    expect(response.body).toEqual({
      code: "REVIEW_INVALID",
      message: "Choose a rating from 1 to 5 stars.",
    });
    expect(findBooking).not.toHaveBeenCalled();
    expect(createReview).not.toHaveBeenCalled();
  });

  it("rejects a comment longer than 2,000 characters", async () => {
    const response = await submit({ comment: "x".repeat(2001) }).expect(400);
    expect(response.body.message).toBe("Keep your comment to 2,000 characters or fewer.");
  });

  it("rejects another Student's lesson", async () => {
    findBooking.mockResolvedValueOnce(completedBooking({ userId: otherId }));
    const response = await submit({}).expect(403);
    expect(response.body).toEqual({
      code: "REVIEW_NOT_YOUR_BOOKING",
      message: "You can only review your own lessons.",
    });
    expect(createReview).not.toHaveBeenCalled();
  });

  it.each(["PENDING_PAYMENT", "CONFIRMED", "CANCELLED"])(
    "rejects a %s lesson that is not completed",
    async (status) => {
      findBooking.mockResolvedValueOnce(completedBooking({ status }));
      const response = await submit({}).expect(409);
      expect(response.body.code).toBe("REVIEW_LESSON_NOT_COMPLETED");
      expect(createReview).not.toHaveBeenCalled();
    }
  );

  it("rejects a missing lesson", async () => {
    findBooking.mockResolvedValueOnce(null);
    expect((await submit({}).expect(404)).body.code).toBe("BOOKING_NOT_FOUND");
  });

  it("allows one review per lesson, including when two submissions race", async () => {
    findBooking.mockResolvedValueOnce(completedBooking({ review: { id: reviewId } }));
    expect((await submit({}).expect(409)).body.code).toBe("REVIEW_ALREADY_EXISTS");

    findBooking.mockResolvedValueOnce(completedBooking());
    createReview.mockRejectedValueOnce(Object.assign(new Error("unique"), { code: "P2002" }));
    expect((await submit({}).expect(409)).body).toEqual({
      code: "REVIEW_ALREADY_EXISTS",
      message: "You already reviewed this lesson.",
    });
  });
});
