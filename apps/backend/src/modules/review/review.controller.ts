import type { Request, Response } from "express";
import { createReviewSchema } from "./review.schema.ts";
import { createReview, ReviewDomainError } from "./review.service.ts";

export async function submitReview(req: Request, res: Response) {
  // Parse here rather than in the generic middleware so the Student sees which rule failed.
  const parsed = createReviewSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      code: "REVIEW_INVALID",
      message: parsed.error.issues[0]?.message ?? "Check your review and try again.",
    });
    return;
  }
  try {
    res.status(201).json({ review: await createReview(req.user!.sub, parsed.data) });
  } catch (error) {
    if (!(error instanceof ReviewDomainError)) throw error;
    res.status(error.status).json({ code: error.code, message: error.message });
  }
}
