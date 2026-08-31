import type { Request, Response } from "express";

export function classroomNotImplemented(_req: Request, res: Response) {
  res.status(501).json({ message: "Classroom module is not implemented" });
}
