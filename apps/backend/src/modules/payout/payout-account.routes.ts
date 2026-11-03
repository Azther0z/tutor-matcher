import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { validate } from "../../middleware/validate.ts";
import {
  banks,
  create,
  list,
  remove,
  requireTutor,
  setDefault,
} from "./payout-account.controller.ts";
import { createPayoutAccountSchema, payoutAccountIdParamsSchema } from "./payout-account.schema.ts";

export const payoutAccountRouter = Router();

// Removed accounts are kept, so adding and removing are limited per account against abuse.
export const payoutAccountRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  keyGenerator: (req) => req.user!.sub,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    code: "PAYOUT_ACCOUNT_RATE_LIMITED",
    message: "Too many payout account changes. Please try again in 15 minutes.",
  },
});

// PROF-7: a Tutor manages their own accounts; another user's id is not found.
// The Tutor check runs first so other users never reach the rate limiter.
payoutAccountRouter.use(requireTutor);
payoutAccountRouter.get("/", list);
payoutAccountRouter.get("/banks", banks);
payoutAccountRouter.post(
  "/",
  payoutAccountRateLimiter,
  validate(createPayoutAccountSchema),
  create
);
payoutAccountRouter.patch(
  "/:id/default",
  validate(payoutAccountIdParamsSchema, "params"),
  setDefault
);
payoutAccountRouter.delete(
  "/:id",
  payoutAccountRateLimiter,
  validate(payoutAccountIdParamsSchema, "params"),
  remove
);
