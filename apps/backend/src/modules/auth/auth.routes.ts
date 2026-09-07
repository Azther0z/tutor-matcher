import { Router } from "express";
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

authRouter.post("/signup", validate(signupSchema), signup);
authRouter.post("/login", validate(loginSchema), login);
authRouter.get("/me", requireAuth, getCurrentUser);
authRouter.post(
  "/password-reset/request",
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
