import type { Request, Response } from "express";
import { createPayoutAccountSchema } from "./payout-account.schema.ts";
import {
  createPayoutAccount,
  listPayoutAccounts,
  PayoutAccountDomainError,
  removePayoutAccount,
  setDefaultPayoutAccount,
} from "./payout-account.service.ts";
import { payoutBanks } from "./payout-banks.ts";

function sendError(error: unknown, res: Response) {
  if (!(error instanceof PayoutAccountDomainError)) throw error;
  return res.status(error.status).json({ code: error.code, message: error.message });
}

export async function list(req: Request, res: Response) {
  res.json(await listPayoutAccounts(req.user!.sub));
}

export function banks(_req: Request, res: Response) {
  res.json({ banks: payoutBanks });
}

export async function create(req: Request, res: Response) {
  try {
    // validate() checks the body without replacing it; parse again for the normalized values.
    const input = createPayoutAccountSchema.parse(req.body);
    res.status(201).json(await createPayoutAccount(req.user!.sub, input));
  } catch (error) {
    sendError(error, res);
  }
}

export async function setDefault(req: Request, res: Response) {
  try {
    res.json(await setDefaultPayoutAccount(req.user!.sub, req.params.id as string));
  } catch (error) {
    sendError(error, res);
  }
}

export async function remove(req: Request, res: Response) {
  try {
    res.json(await removePayoutAccount(req.user!.sub, req.params.id as string));
  } catch (error) {
    sendError(error, res);
  }
}
