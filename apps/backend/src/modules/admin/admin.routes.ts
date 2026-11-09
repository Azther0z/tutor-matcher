import { Router } from "express";
import { validate } from "../../middleware/validate.ts";
import { listRequests, reviewRequest } from "./admin.controller.ts";
import { reviewParamsSchema, tutorReviewSchema } from "./admin.schema.ts";
import { reviewTopupRequest, topupsForReview } from "../wallet/wallet.controller.ts";
import {
  topupIdParamsSchema,
  topupListQuerySchema,
  topupReviewSchema,
} from "../wallet/wallet.schema.ts";
export const adminRouter = Router();
adminRouter.get("/tutor-requests", listRequests);
adminRouter.post(
  "/tutor-requests/:id/review",
  validate(reviewParamsSchema, "params"),
  validate(tutorReviewSchema),
  reviewRequest
);
// PAY-1: admins check transfer slips before a top-up is credited.
adminRouter.get("/topups", validate(topupListQuerySchema, "query"), topupsForReview);
adminRouter.post(
  "/topups/:id/review",
  validate(topupIdParamsSchema, "params"),
  validate(topupReviewSchema),
  reviewTopupRequest
);
