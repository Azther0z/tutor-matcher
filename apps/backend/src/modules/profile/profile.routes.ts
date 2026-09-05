import { Router } from "express";
import { validate } from "../../middleware/validate.ts";
import {
  deactivateAccountForCurrentUser,
  getAccountForCurrentUser,
  updateAccountForCurrentUser,
  updateProfile,
} from "./profile.controller.ts";
import {
  accountDeactivateSchema,
  accountUpdateSchema,
  profileRequestSchema,
} from "./profile.schema.ts";

export const profileRouter = Router();

profileRouter.put("/me", validate(profileRequestSchema), updateProfile);
profileRouter.get("/me/account", getAccountForCurrentUser);
profileRouter.put("/me/account", validate(accountUpdateSchema), updateAccountForCurrentUser);
profileRouter.post(
  "/me/account/deactivate",
  validate(accountDeactivateSchema),
  deactivateAccountForCurrentUser
);
