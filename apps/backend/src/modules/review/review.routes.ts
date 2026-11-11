import { Router } from "express";
import { validate } from "../../middleware/validate.ts";
import { submitReviewReply, updateReviewReply } from "./review-reply.controller.ts";
import {
  reviewReplyParamsSchema,
  reviewReplySchema,
  reviewReplyEditSchema,
} from "./review-reply.schema.ts";

export const reviewRouter = Router();
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
