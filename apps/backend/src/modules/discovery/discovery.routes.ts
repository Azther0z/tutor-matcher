import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { validate } from "../../middleware/validate.ts";
import { getLearningAreas, getTutorById, getTutorSearch } from "./discovery.controller.ts";
import { tutorSearchQuerySchema } from "./discovery.schema.ts";

// DISC-1: /search is public, so these routes are mounted before the login check.
export const publicDiscoveryRouter = Router();

export const discoverySearchRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many searches. Please try again in a minute." },
});

publicDiscoveryRouter.get(
  "/tutors",
  discoverySearchRateLimiter,
  validate(tutorSearchQuerySchema, "query"),
  getTutorSearch
);
publicDiscoveryRouter.get("/learning-areas", discoverySearchRateLimiter, getLearningAreas);

export const discoveryRouter = Router();

discoveryRouter.get("/tutors/:id", getTutorById);
