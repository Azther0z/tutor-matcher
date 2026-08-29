import type { Request, Response } from "express";

export function messagingNotImplemented(_req: Request, res: Response) {
  res.status(501).json({ message: "Messaging module is not implemented" });
}
