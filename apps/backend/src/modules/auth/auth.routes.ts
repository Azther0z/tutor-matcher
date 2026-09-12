import { Router } from "express";
import { requireAuth } from "../../middleware/auth.ts";
import { validate } from "../../middleware/validate.ts";
import { signupSchema, loginSchema } from "./auth.schema.ts";
import { getCurrentUser, signup, login } from "./auth.controller.ts";

export const authRouter = Router();

authRouter.post("/signup", validate(signupSchema), signup);
authRouter.post("/login", validate(loginSchema), login);
authRouter.get("/me", requireAuth, getCurrentUser);
