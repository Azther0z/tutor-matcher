import type { Request, Response } from "express";
import { DashboardError, getTutorDashboard } from "./dashboard.service.ts";

export async function tutorDashboard(req: Request, res: Response) {
  try {
    res.json(await getTutorDashboard(req.user!.sub));
  } catch (error) {
    if (!(error instanceof DashboardError)) throw error;
    res.status(error.status).json({ message: error.message });
  }
}
