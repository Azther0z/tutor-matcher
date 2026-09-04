import type { Request, Response } from "express";
import { getRecommendations } from "./discovery.service.ts";

export async function getRecommendationsController(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  const result = await getRecommendations(req.user.sub);
  res.status(200).json(result);
}
