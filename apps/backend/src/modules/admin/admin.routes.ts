import { Router } from "express";
import { validate } from "../../middleware/validate.ts";
import { listRequests, reviewRequest } from "./admin.controller.ts";
import { reviewParamsSchema, tutorReviewSchema } from "./admin.schema.ts";
export const adminRouter = Router();
adminRouter.get("/tutor-requests", listRequests);
adminRouter.post(
  "/tutor-requests/:id/review",
  validate(reviewParamsSchema, "params"),
  validate(tutorReviewSchema),
  reviewRequest
);
