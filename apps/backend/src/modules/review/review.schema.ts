import { z } from "zod";

const RATING_MESSAGE = "Choose a rating from 1 to 5 stars.";

// REV-1: a Student rates their own completed lesson 1-5 stars with an optional comment.
export const createReviewSchema = z.object({
  bookingId: z.uuid("Choose the lesson you want to review."),
  rating: z
    .number(RATING_MESSAGE)
    .int(RATING_MESSAGE)
    .min(1, RATING_MESSAGE)
    .max(5, RATING_MESSAGE),
  comment: z
    .string()
    .trim()
    .max(2000, "Keep your comment to 2,000 characters or fewer.")
    .optional(),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
