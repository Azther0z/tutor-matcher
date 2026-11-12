import { prisma } from "../../lib/db.ts";
import type { ReviewFlagInput } from "./review-flag.schema.ts";
import { countedReview } from "./review-visibility.ts";

export class ReviewFlagError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "ReviewFlagError";
  }
}

// REV-3: any signed-in member may flag a public review's comment once. Reviews without a
// comment, refunded reviews and unknown ids are all "not found", so nothing about them leaks.
export async function flagReview(userId: string, reviewId: string, { reason }: ReviewFlagInput) {
  const review = await prisma.review.findFirst({
    where: { id: reviewId, text: { not: null }, ...countedReview },
    select: { userId: true },
  });
  if (!review) {
    throw new ReviewFlagError(
      404,
      "REVIEW_NOT_FOUND",
      "This review comment is no longer available."
    );
  }
  if (review.userId === userId) {
    throw new ReviewFlagError(403, "OWN_REVIEW", "You can't flag your own review.");
  }

  try {
    await prisma.reviewFlag.create({ data: { reviewId, reporterId: userId, reason } });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      throw new ReviewFlagError(409, "ALREADY_FLAGGED", "You have already flagged this review.");
    }
    throw error;
  }
  return { reviewId, flagged: true };
}
