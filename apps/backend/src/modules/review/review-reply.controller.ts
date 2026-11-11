import type { Request, Response } from "express";
import {
  reviewReplyParamsSchema,
  reviewReplySchema,
  reviewReplyEditSchema,
} from "./review-reply.schema.ts";
import { replyToReview, editReviewReply, ReviewReplyError } from "./review-reply.service.ts";

export async function updateReviewReply(req: Request, res: Response) {
  try {
    const { id } = reviewReplyParamsSchema.parse(req.params);
    res.json(await editReviewReply(req.user!.sub, id, reviewReplyEditSchema.parse(req.body)));
  } catch (error) {
    if (!(error instanceof ReviewReplyError)) throw error;
    res.status(error.status).json({ code: error.code, message: error.message });
  }
}

export async function submitReviewReply(req: Request, res: Response) {
  try {
    const { id } = reviewReplyParamsSchema.parse(req.params);
    const result = await replyToReview(req.user!.sub, id, reviewReplySchema.parse(req.body));
    res.status(201).json(result);
  } catch (error) {
    if (!(error instanceof ReviewReplyError)) throw error;
    res.status(error.status).json({ code: error.code, message: error.message });
  }
}
