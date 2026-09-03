import { Router } from "express";
import { validate } from "../../middleware/validate.ts";
import { signupSchema } from "./auth.schema.ts";
import { signup } from "./auth.controller.ts";

export const authRouter = Router();

authRouter.post("/signup", validate(signupSchema), signup);
