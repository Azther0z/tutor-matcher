import { Router } from "express";
import { getTutorById } from "./discovery.controller.ts";

export const discoveryRouter = Router();

discoveryRouter.get("/tutors/:id", getTutorById);
