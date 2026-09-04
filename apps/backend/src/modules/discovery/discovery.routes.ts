import { Router } from "express";
import { getRecommendationsController } from "./discovery.controller.ts";

export const discoveryRouter = Router();

discoveryRouter.get("/recommendations", getRecommendationsController);
