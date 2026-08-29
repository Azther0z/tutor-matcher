import type { Request, Response } from "express";

export function discoveryNotImplemented(_req: Request, res: Response) {
  res.status(501).json({ message: "Discovery module is not implemented" });
}
