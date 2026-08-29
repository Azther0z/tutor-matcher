import type { Request, Response } from "express";

export function bookingNotImplemented(_req: Request, res: Response) {
  res.status(501).json({ message: "Booking module is not implemented" });
}
