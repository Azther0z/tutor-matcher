import type { NextFunction, Request, Response } from "express";

export function requireAuth(_req: Request, res: Response, _next: NextFunction) {
  res.status(501).json({ message: "Authentication middleware is not implemented" });
}
