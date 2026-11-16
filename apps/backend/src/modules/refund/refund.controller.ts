import type { Request, Response } from "express";
import {
  createRefundRequestSchema,
  refundIdParamsSchema,
  refundListQuerySchema,
  refundReviewSchema,
} from "./refund.schema.ts";
import {
  createRefundRequest,
  listRefundsForReview,
  RefundDomainError,
  reviewRefund,
} from "./refund.service.ts";

function sendError(error: unknown, res: Response) {
  if (!(error instanceof RefundDomainError)) throw error;
  return res.status(error.status).json({ code: error.code, message: error.message });
}

export async function requestRefund(req: Request, res: Response) {
  try {
    const { id } = refundIdParamsSchema.parse(req.params);
    const booking = await createRefundRequest(
      req.user!.sub,
      id,
      createRefundRequestSchema.parse(req.body)
    );
    res.status(201).json({ booking });
  } catch (error) {
    sendError(error, res);
  }
}

export async function refundsForReview(req: Request, res: Response) {
  try {
    const { status } = refundListQuerySchema.parse(req.query);
    res.json(await listRefundsForReview(req.user!.sub, status));
  } catch (error) {
    sendError(error, res);
  }
}

export async function reviewRefundRequest(req: Request, res: Response) {
  try {
    const { id } = refundIdParamsSchema.parse(req.params);
    res.json(await reviewRefund(req.user!.sub, id, refundReviewSchema.parse(req.body)));
  } catch (error) {
    sendError(error, res);
  }
}
