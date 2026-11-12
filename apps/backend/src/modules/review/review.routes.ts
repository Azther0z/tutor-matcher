import { Router } from "express";
import { submitReview } from "./review.controller.ts";
import { validate } from "../../middleware/validate.ts";
import { submitReviewFlag } from "./review-flag.controller.ts";
import { reviewFlagParamsSchema, reviewFlagSchema } from "./review-flag.schema.ts";
import { submitReviewReply, updateReviewReply } from "./review-reply.controller.ts";
import {
  reviewReplyParamsSchema,
  reviewReplySchema,
  reviewReplyEditSchema,
} from "./review-reply.schema.ts";

export const reviewRouter = Router();
// REV-1: a Student publishes a review of their own completed lesson.
reviewRouter.post("/", submitReview);
reviewRouter.patch(
  "/:id/reply",
  validate(reviewReplyParamsSchema, "params"),
  validate(reviewReplyEditSchema),
  updateReviewReply
);

reviewRouter.post(
  "/:id/reply",
  validate(reviewReplyParamsSchema, "params"),
  validate(reviewReplySchema),
  submitReviewReply
);

// REV-3: a member flags a review's comment for Admin moderation.
reviewRouter.post(
  "/:id/flags",
  validate(reviewFlagParamsSchema, "params"),
  validate(reviewFlagSchema),
  submitReviewFlag
);
