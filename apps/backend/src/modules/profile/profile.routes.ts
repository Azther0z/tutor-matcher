import { Router } from "express";
import { validate } from "../../middleware/validate.ts";
import { subjectRouter } from "../subject/subject.routes.ts";
import { availabilityRouter } from "../availability/availability.routes.ts";
import {
  enrollCurrentTutor,
  getOwnAccount,
  getLearningAreaSuggestions,
  getOwnStudentProfile,
  getOwnTutorApplication,
  saveOwnStudentProfile,
  updateOwnAccount,
  updateProfile,
  saveOwnTutorDraft,
  createOwnTutorDraft,
  updateOwnTutorDraft,
  discardOwnTutorDraft,
  submitChosenTutorDraft,
  submitOwnTutorDraft,
  withdrawTutorProfile,
  copyOwnSubmission,
  setOwnTutorPublication,
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
profileRouter.use("/me/tutor/availability", availabilityRouter);

profileRouter.use("/me/tutor/subjects", subjectRouter);

profileRouter.put("/me", validate(profileRequestSchema), updateProfile);
profileRouter.get("/me/tutor", getOwnTutorApplication);
profileRouter.put("/me/tutor", validate(tutorEnrollmentRequestSchema), enrollCurrentTutor);
profileRouter.get(
  "/learning-areas",
  validate(learningAreaSearchSchema, "query"),
  getLearningAreaSuggestions
);
profileRouter.get("/me/student", getOwnStudentProfile);
profileRouter.put("/me/student", validate(studentProfileRequestSchema), saveOwnStudentProfile);
profileRouter.get("/me/account", getOwnAccount);
profileRouter.put("/me/account", validate(accountUpdateSchema), updateOwnAccount);

profileRouter.put("/me/tutor/draft", validate(tutorDraftRequestSchema), saveOwnTutorDraft);
profileRouter.post("/me/tutor/submit", validate(tutorSubmitRequestSchema), submitOwnTutorDraft);
profileRouter.post("/me/tutor/withdraw", withdrawTutorProfile);
profileRouter.patch(
  "/me/tutor/publication",
  validate(tutorPublicationRequestSchema),
  setOwnTutorPublication
);

profileRouter.post("/me/tutor/drafts", validate(tutorDraftRequestSchema), createOwnTutorDraft);
profileRouter.put(
  "/me/tutor/drafts/:draftId",
  validate(tutorDraftParamsSchema, "params"),
  validate(tutorDraftRequestSchema),
  updateOwnTutorDraft
);
profileRouter.delete(
  "/me/tutor/drafts/:draftId",
  validate(tutorDraftParamsSchema, "params"),
  discardOwnTutorDraft
);
profileRouter.post(
  "/me/tutor/drafts/:draftId/submit",
  validate(tutorDraftParamsSchema, "params"),
  validate(tutorSubmitRequestSchema),
  submitChosenTutorDraft
);

profileRouter.post(
  "/me/tutor/submissions/:draftId/copy",
  validate(tutorDraftParamsSchema, "params"),
  copyOwnSubmission
);
