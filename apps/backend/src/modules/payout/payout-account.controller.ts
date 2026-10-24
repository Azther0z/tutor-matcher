import type { Request, Response } from "express";
import { listPayoutAccounts } from "./payout-account.service.ts";

export async function list(req: Request, res: Response) {
  res.json(await listPayoutAccounts(req.user!.sub));
}
