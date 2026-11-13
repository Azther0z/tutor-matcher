import type { Prisma } from "../../generated/prisma/client.ts";

// PAY-3: an approved refund cancels the lesson, so its review no longer counts publicly.
// REV-4: neither does a review an Admin removed. Both keep the review row; every public
// rating, average, list and ranking uses this filter.
export const countedReview = {
  booking: { status: { not: "CANCELLED" } },
  removedAt: null,
} as const satisfies Prisma.ReviewWhereInput;
