import { Router } from "express";
import { submitReview } from "./review.controller.ts";
import { validate } from "../../middleware/validate.ts";
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
