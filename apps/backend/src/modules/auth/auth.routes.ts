import { Router } from "express";
import { validate } from "../../middleware/validate.ts";
import { signupSchema, loginSchema } from "./auth.schema.ts";
import { signup, login } from "./auth.controller.ts";

export const authRouter = Router();

authRouter.post("/signup", validate(signupSchema), signup);
authRouter.post("/login", validate(loginSchema), login);
