import type { Prisma } from "../../generated/prisma/client.ts";

// PAY-3: an approved refund cancels the lesson, so its review no longer counts publicly.
// The review row is kept; every public rating, average, list and ranking uses this filter.
export const countedReview = {
  booking: { status: { not: "CANCELLED" } },
} as const satisfies Prisma.ReviewWhereInput;
