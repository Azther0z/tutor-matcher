import type { Request, Response } from "express";
import type { RequestPayoutInput } from "./payout.schema.ts";
import { PayoutDomainError, requestPayout } from "./payout.service.ts";

export async function create(req: Request, res: Response) {
  try {
    res.status(201).json(await requestPayout(req.user!.sub, req.body as RequestPayoutInput));
  } catch (error) {
    if (!(error instanceof PayoutDomainError)) throw error;
    res.status(error.status).json({ code: error.code, message: error.message });
  }
}
