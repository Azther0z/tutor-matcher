import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { validate } from "../../middleware/validate.ts";
import {
  confirmPromptPayTopup,
  overview,
  summary,
  transaction,
  transactions,
} from "./wallet.controller.ts";
import {
  confirmTopupSchema,
  walletTransactionParamsSchema,
  walletTransactionsQuerySchema,
} from "./wallet.schema.ts";

export const walletRouter = Router();

export const topupRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  // routes.ts authenticates wallet requests before this account-scoped limiter.
  keyGenerator: (req) => req.user!.sub,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    code: "TOPUP_RATE_LIMITED",
    message: "Too many top-up attempts. Please try again in 15 minutes.",
  },
});

walletRouter.get("/", summary);
walletRouter.get("/overview", overview);
walletRouter.get("/transactions", validate(walletTransactionsQuerySchema, "query"), transactions);
walletRouter.get(
  "/transactions/:id",
  validate(walletTransactionParamsSchema, "params"),
  transaction
);
walletRouter.post(
  "/topups/confirm",
  topupRateLimiter,
  validate(confirmTopupSchema),
  confirmPromptPayTopup
);
