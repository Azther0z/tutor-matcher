import { Router } from "express";
import { tutorDashboard } from "./dashboard.controller.ts";

export const dashboardRouter = Router();
dashboardRouter.get("/tutor", tutorDashboard);
