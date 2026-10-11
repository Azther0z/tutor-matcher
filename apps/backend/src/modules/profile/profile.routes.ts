import { Router } from "express";
import { validate } from "../../middleware/validate.ts";
import {
  enrollTutorForCurrentUser,
  getAccountForCurrentUser,
  getLearningAreaSuggestions,
  getStudentProfileForCurrentUser,
  getTutorApplicationForCurrentUser,
  saveStudentProfileForCurrentUser,
  updateAccountForCurrentUser,
  updateProfile,
  saveDraftForCurrentUser,
  submitDraftForCurrentUser,
  withdrawRequestForCurrentUser,
  setPublicationForCurrentUser,
} from "./profile.controller.ts";
import {
  accountUpdateSchema,
  learningAreaSearchSchema,
  profileRequestSchema,
  studentProfileRequestSchema,
  tutorEnrollmentRequestSchema,
  tutorDraftRequestSchema,
  tutorSubmitRequestSchema,
  tutorPublicationRequestSchema,
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
profileRouter.get("/me/account", getAccountForCurrentUser);
profileRouter.put("/me/account", validate(accountUpdateSchema), updateAccountForCurrentUser);

profileRouter.put("/me/tutor/draft", validate(tutorDraftRequestSchema), saveDraftForCurrentUser);
profileRouter.post(
  "/me/tutor/submit",
  validate(tutorSubmitRequestSchema),
  submitDraftForCurrentUser
);
profileRouter.post("/me/tutor/withdraw", withdrawRequestForCurrentUser);
profileRouter.patch(
  "/me/tutor/publication",
  validate(tutorPublicationRequestSchema),
  setPublicationForCurrentUser
);
