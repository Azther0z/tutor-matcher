import { Router } from "express";
import { validate } from "../../middleware/validate.ts";
import {
  deactivateAccountForCurrentUser,
  getAccountForCurrentUser,
  getLearningAreaSuggestions,
  getStudentProfileForCurrentUser,
  saveStudentProfileForCurrentUser,
  updateAccountForCurrentUser,
  updateProfile,
} from "./profile.controller.ts";
import {
  accountDeactivateSchema,
  accountUpdateSchema,
  learningAreaSearchSchema,
  profileRequestSchema,
  studentProfileRequestSchema,
} from "./profile.schema.ts";

export const profileRouter = Router();

profileRouter.put("/me", validate(profileRequestSchema), updateProfile);
profileRouter.get(
  "/learning-areas",
  validate(learningAreaSearchSchema, "query"),
  getLearningAreaSuggestions
);
profileRouter.get("/me/student", getStudentProfileForCurrentUser);
profileRouter.put(
  "/me/student",
  validate(studentProfileRequestSchema),
  saveStudentProfileForCurrentUser
);
profileRouter.get("/me/account", getAccountForCurrentUser);
profileRouter.put("/me/account", validate(accountUpdateSchema), updateAccountForCurrentUser);
profileRouter.post(
  "/me/account/deactivate",
  validate(accountDeactivateSchema),
  deactivateAccountForCurrentUser
);
