import { Router } from "express";
import { validate } from "../../middleware/validate.ts";
import {
  getLearningAreaSuggestions,
  getStudentProfileForCurrentUser,
  saveStudentProfileForCurrentUser,
  updateProfile,
} from "./profile.controller.ts";
import {
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
