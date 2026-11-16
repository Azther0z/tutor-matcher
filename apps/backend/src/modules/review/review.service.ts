import { prisma } from "../../lib/db.ts";
import type { CreateReviewInput } from "./review.schema.ts";

// REV-1: a Student reviews the tutor and subject of their own completed lesson. The review is
// published at once and scoped to the booking's subject, which belongs to exactly one tutor.

export type ReviewErrorCode =
  | "BOOKING_NOT_FOUND"
  | "REVIEW_NOT_YOUR_BOOKING"
  | "REVIEW_LESSON_NOT_COMPLETED"
  | "REVIEW_ALREADY_EXISTS";

export class ReviewDomainError extends Error {
  constructor(
    public readonly code: ReviewErrorCode,
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "ReviewDomainError";
  }
}

const alreadyReviewed = () =>
  new ReviewDomainError("REVIEW_ALREADY_EXISTS", "You already reviewed this lesson.", 409);

export async function createReview(userId: string, input: CreateReviewInput) {
  const booking = await prisma.booking.findUnique({
    where: { id: input.bookingId },
    select: {
      userId: true,
      status: true,
      subjectId: true,
      review: { select: { id: true } },
    },
  });
  if (!booking) throw new ReviewDomainError("BOOKING_NOT_FOUND", "Lesson not found.", 404);
  if (booking.userId !== userId)
    throw new ReviewDomainError(
      "REVIEW_NOT_YOUR_BOOKING",
      "You can only review your own lessons.",
      403
    );
  if (booking.status !== "COMPLETED")
    throw new ReviewDomainError(
      "REVIEW_LESSON_NOT_COMPLETED",
      "You can review this lesson once your Tutor confirms it was completed.",
      409
    );
  if (booking.review) throw alreadyReviewed();

  try {
    const review = await prisma.review.create({
      data: {
        bookingId: input.bookingId,
        userId,
        subjectId: booking.subjectId,
        ratingStars: input.rating,
        text: input.comment || null,
      },
    });
    return {
      id: review.id,
      bookingId: review.bookingId,
      subjectId: review.subjectId,
      rating: review.ratingStars,
      comment: review.text,
      createdAt: review.createdAt.toISOString(),
    };
  } catch (error) {
    // The unique booking_id key settles two submissions for the same lesson.
    if ((error as { code?: string }).code === "P2002") throw alreadyReviewed();
    throw error;
  }
}
