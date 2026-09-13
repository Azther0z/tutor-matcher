import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { GENERIC_PASSWORD_RESET_MESSAGE } from "../../lib/password-reset.ts";
import { requireAuth } from "../../middleware/auth.ts";
import { validate } from "../../middleware/validate.ts";
import {
  signupSchema,
  loginSchema,
  passwordResetRequestSchema,
  passwordResetValidateSchema,
  passwordResetConfirmSchema,
} from "./auth.schema.ts";
import {
  signup,
  login,
  getCurrentUser,
  requestPasswordReset,
  validatePasswordResetToken,
  confirmPasswordReset,
} from "./auth.controller.ts";

export const authRouter = Router();

export const passwordResetRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ message: GENERIC_PASSWORD_RESET_MESSAGE });
  },
});

authRouter.post("/signup", validate(signupSchema), signup);
authRouter.post("/login", validate(loginSchema), login);
authRouter.get("/me", requireAuth, getCurrentUser);
authRouter.post(
  "/password-reset/request",
  passwordResetRateLimiter,
  validate(passwordResetRequestSchema),
  requestPasswordReset
);
authRouter.get(
  "/password-reset/validate",
  validate(passwordResetValidateSchema, "query"),
  validatePasswordResetToken
);
authRouter.post(
  "/password-reset/confirm",
  validate(passwordResetConfirmSchema),
  confirmPasswordReset
);
