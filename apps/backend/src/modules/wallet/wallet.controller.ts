import type { Request, Response } from "express";
import {
  walletTransactionParamsSchema,
  walletTransactionsQuerySchema,
  type ConfirmTopupInput,
} from "./wallet.schema.ts";
import {
  confirmTopup,
  getWallet,
  getWalletOverview,
  getWalletTransaction,
  listWalletTransactions,
  WalletDomainError,
} from "./wallet.service.ts";

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

export async function confirmPromptPayTopup(req: Request, res: Response) {
  try {
    res.status(201).json(await confirmTopup(req.user!.sub, req.body as ConfirmTopupInput));
  } catch (error) {
    sendError(error, res);
  }
}

export async function overview(req: Request, res: Response) {
  try {
    res.json(await getWalletOverview(req.user!.sub));
  } catch (error) {
    sendError(error, res);
  }
}

export async function transactions(req: Request, res: Response) {
  res.json(
    await listWalletTransactions(req.user!.sub, walletTransactionsQuerySchema.parse(req.query))
  );
}

export async function transaction(req: Request, res: Response) {
  try {
    const { id } = walletTransactionParamsSchema.parse(req.params);
    res.json(await getWalletTransaction(req.user!.sub, id));
  } catch (error) {
    sendError(error, res);
  }
}
