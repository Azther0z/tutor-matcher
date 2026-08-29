import type { Request, Response } from "express";

export function reviewNotImplemented(_req: Request, res: Response) {
  res.status(501).json({ message: "Review module is not implemented" });
}
