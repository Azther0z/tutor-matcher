import { Router } from "express";
import { validate } from "../../middleware/validate.ts";
import { updateProfile } from "./profile.controller.ts";
import { profileRequestSchema } from "./profile.schema.ts";

export const profileRouter = Router();

profileRouter.put("/me", validate(profileRequestSchema), updateProfile);
