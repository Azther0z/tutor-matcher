import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { validate } from "../../middleware/validate.ts";
import { optionalAuth } from "../../middleware/auth.ts";
import {
  getLearningAreas,
  getSearchPriceRange,
  getTutorById,
  getTutorProfileById,
  getTutorSearch,
} from "./discovery.controller.ts";
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
  optionalAuth,
  validate(tutorSearchQuerySchema, "query"),
  getTutorSearch
);
// DISC-3: the tutor profile page is public too, like the search that links to it.
publicDiscoveryRouter.get("/tutors/:id/profile", discoverySearchRateLimiter, getTutorProfileById);
publicDiscoveryRouter.get("/learning-areas", discoverySearchRateLimiter, getLearningAreas);
publicDiscoveryRouter.get("/price-range", discoverySearchRateLimiter, getSearchPriceRange);

export const discoveryRouter = Router();

discoveryRouter.get("/tutors/:id", getTutorById);
