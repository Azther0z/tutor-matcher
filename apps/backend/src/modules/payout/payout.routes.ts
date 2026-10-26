import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { validate } from "../../middleware/validate.ts";
import { create } from "./payout.controller.ts";
import { requestPayoutSchema } from "./payout.schema.ts";

export const payoutRouter = Router();

export const payoutRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  // routes.ts authenticates payout requests before this account-scoped limiter.
  keyGenerator: (req) => req.user!.sub,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    code: "PAYOUT_RATE_LIMITED",
    message: "Too many payout attempts. Please try again in 15 minutes.",
  },
});

payoutRouter.post("/", payoutRateLimiter, validate(requestPayoutSchema), create);
