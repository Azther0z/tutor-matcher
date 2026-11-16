import type { Request, Response } from "express";
import {
  reviewFlagListQuerySchema,
  reviewModerationParamsSchema,
  reviewModerationSchema,
} from "./review-moderation.schema.ts";
import {
  listFlaggedReviews,
  moderateReview,
  ReviewModerationError,
} from "./review-moderation.service.ts";

function sendError(error: unknown, res: Response) {
  if (!(error instanceof ReviewModerationError)) throw error;
  res.status(error.status).json({ code: error.code, message: error.message });
}

export async function flaggedReviewsForAdmin(req: Request, res: Response) {
  try {
    const { status } = reviewFlagListQuerySchema.parse(req.query);
    res.json(await listFlaggedReviews(req.user!.sub, status));
  } catch (error) {
    sendError(error, res);
  }
}

export async function moderateFlaggedReview(req: Request, res: Response) {
  try {
    const { id } = reviewModerationParamsSchema.parse(req.params);
    res.json(await moderateReview(req.user!.sub, id, reviewModerationSchema.parse(req.body)));
  } catch (error) {
    sendError(error, res);
  }
}
