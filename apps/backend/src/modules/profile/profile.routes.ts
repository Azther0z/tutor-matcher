import { Router } from "express";
import { validate } from "../../middleware/validate.ts";
import {
  enrollTutorForCurrentUser,
  getLearningAreaSuggestions,
  getStudentProfileForCurrentUser,
  getTutorApplicationForCurrentUser,
  saveStudentProfileForCurrentUser,
  updateProfile,
} from "./profile.controller.ts";
import {
  learningAreaSearchSchema,
  profileRequestSchema,
  studentProfileRequestSchema,
  tutorEnrollmentRequestSchema,
} from "./profile.schema.ts";

export const profileRouter = Router();

profileRouter.put("/me", validate(profileRequestSchema), updateProfile);
profileRouter.get("/me/tutor", getTutorApplicationForCurrentUser);
profileRouter.put("/me/tutor", validate(tutorEnrollmentRequestSchema), enrollTutorForCurrentUser);
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
