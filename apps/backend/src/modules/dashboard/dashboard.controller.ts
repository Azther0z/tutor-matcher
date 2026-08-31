import type { Request, Response } from "express";

export function dashboardNotImplemented(_req: Request, res: Response) {
  res.status(501).json({ message: "Dashboard module is not implemented" });
}
