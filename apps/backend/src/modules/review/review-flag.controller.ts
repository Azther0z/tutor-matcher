import type { Request, Response } from "express";
import { reviewFlagParamsSchema, reviewFlagSchema } from "./review-flag.schema.ts";
import { flagReview, ReviewFlagError } from "./review-flag.service.ts";

export async function submitReviewFlag(req: Request, res: Response) {
  try {
    const { id } = reviewFlagParamsSchema.parse(req.params);
    res.status(201).json(await flagReview(req.user!.sub, id, reviewFlagSchema.parse(req.body)));
  } catch (error) {
    if (!(error instanceof ReviewFlagError)) throw error;
    res.status(error.status).json({ code: error.code, message: error.message });
  }
}
