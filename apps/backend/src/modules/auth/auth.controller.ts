import type { Request, Response } from "express";

export function authNotImplemented(_req: Request, res: Response) {
  res.status(501).json({ message: "Auth module is not implemented" });
}
