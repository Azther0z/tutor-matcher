import type { Request, Response } from "express";
import {
  cancelTopup,
  createTopup,
  listMyTopups,
  listTopupsForReview,
  reviewTopup,
} from "./topup.service.ts";
import {
  createTopupSchema,
  topupIdParamsSchema,
  topupListQuerySchema,
  topupReviewSchema,
} from "./wallet.schema.ts";
import { getWallet, WalletDomainError } from "./wallet.service.ts";

function sendError(error: unknown, res: Response) {
  if (!(error instanceof WalletDomainError)) throw error;
  return res.status(error.status).json({ code: error.code, message: error.message });
}

export async function summary(req: Request, res: Response) {
  try {
    res.json(await getWallet(req.user!.sub));
  } catch (error) {
    sendError(error, res);
  }
}

export async function myTopups(req: Request, res: Response) {
  res.json(await listMyTopups(req.user!.sub));
}

export async function submitTopup(req: Request, res: Response) {
  try {
    res.status(201).json(await createTopup(req.user!.sub, createTopupSchema.parse(req.body)));
  } catch (error) {
    sendError(error, res);
  }
}

export async function cancelMyTopup(req: Request, res: Response) {
  try {
    const { id } = topupIdParamsSchema.parse(req.params);
    res.json(await cancelTopup(req.user!.sub, id));
  } catch (error) {
    sendError(error, res);
  }
}

export async function topupsForReview(req: Request, res: Response) {
  try {
    const { status } = topupListQuerySchema.parse(req.query);
    res.json(await listTopupsForReview(req.user!.sub, status));
  } catch (error) {
    sendError(error, res);
  }
}

export async function reviewTopupRequest(req: Request, res: Response) {
  try {
    const { id } = topupIdParamsSchema.parse(req.params);
    res.json(await reviewTopup(req.user!.sub, id, topupReviewSchema.parse(req.body)));
  } catch (error) {
    sendError(error, res);
  }
}
