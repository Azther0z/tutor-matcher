import type { Request, Response } from "express";

export function walletNotImplemented(_req: Request, res: Response) {
  res.status(501).json({ message: "Wallet module is not implemented" });
}
