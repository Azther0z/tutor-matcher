import type { Request, Response } from "express";

export function profileNotImplemented(_req: Request, res: Response) {
  res.status(501).json({ message: "Profile module is not implemented" });
}
