import { Router } from "express";
import { validate } from "../../middleware/validate.ts";
import { subjectRouter } from "../subject/subject.routes.ts";
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
  createDraftForCurrentUser,
  updateDraftForCurrentUser,
  discardDraftForCurrentUser,
  submitSelectedDraftForCurrentUser,
  submitDraftForCurrentUser,
  withdrawRequestForCurrentUser,
  copyCancelledSubmissionForCurrentUser,
  setPublicationForCurrentUser,
} from "./profile.controller.ts";
import {
  accountUpdateSchema,
  learningAreaSearchSchema,
  profileRequestSchema,
  studentProfileRequestSchema,
  tutorEnrollmentRequestSchema,
  tutorDraftRequestSchema,
  tutorDraftParamsSchema,
  tutorSubmitRequestSchema,
  tutorPublicationRequestSchema,
} from "./profile.schema.ts";

export const profileRouter = Router();

profileRouter.use("/me/tutor/subjects", subjectRouter);

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

profileRouter.post(
  "/me/tutor/drafts",
  validate(tutorDraftRequestSchema),
  createDraftForCurrentUser
);
profileRouter.put(
  "/me/tutor/drafts/:draftId",
  validate(tutorDraftParamsSchema, "params"),
  validate(tutorDraftRequestSchema),
  updateDraftForCurrentUser
);
profileRouter.delete(
  "/me/tutor/drafts/:draftId",
  validate(tutorDraftParamsSchema, "params"),
  discardDraftForCurrentUser
);
profileRouter.post(
  "/me/tutor/drafts/:draftId/submit",
  validate(tutorDraftParamsSchema, "params"),
  validate(tutorSubmitRequestSchema),
  submitSelectedDraftForCurrentUser
);

profileRouter.post(
  "/me/tutor/submissions/:draftId/copy",
  validate(tutorDraftParamsSchema, "params"),
  copyCancelledSubmissionForCurrentUser
);
