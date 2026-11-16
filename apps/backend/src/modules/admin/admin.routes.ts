import { Router } from "express";
import { validate } from "../../middleware/validate.ts";
import { reviewTopupRequest, topupsForReview } from "../wallet/wallet.controller.ts";
import {
  topupIdParamsSchema,
  topupListQuerySchema,
  topupReviewSchema,
} from "../wallet/wallet.schema.ts";
import { refundsForReview, reviewRefundRequest } from "../refund/refund.controller.ts";
import {
  refundIdParamsSchema,
  refundListQuerySchema,
  refundReviewSchema,
} from "../refund/refund.schema.ts";
import {
  flaggedReviewsForAdmin,
  moderateFlaggedReview,
} from "../review/review-moderation.controller.ts";
import {
  reviewFlagListQuerySchema,
  reviewModerationParamsSchema,
  reviewModerationSchema,
} from "../review/review-moderation.schema.ts";
import { actOnUser, getUser, listRequests, listUsers, reviewRequest } from "./admin.controller.ts";
import {
  accountActionSchema,
  reviewParamsSchema,
  tutorReviewSchema,
  userParamsSchema,
  userSearchQuerySchema,
} from "./admin.schema.ts";
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
// PAY-3: admins decide refund requests for unsatisfactory lessons.
adminRouter.get("/refunds", validate(refundListQuerySchema, "query"), refundsForReview);
adminRouter.post(
  "/refunds/:id/review",
  validate(refundIdParamsSchema, "params"),
  validate(refundReviewSchema),
  reviewRefundRequest
);
// SAFE-1: search accounts and suspend or ban them.
adminRouter.get("/users", validate(userSearchQuerySchema, "query"), listUsers);
adminRouter.get("/users/:id", validate(userParamsSchema, "params"), getUser);
adminRouter.post(
  "/users/:id/actions",
  validate(userParamsSchema, "params"),
  validate(accountActionSchema),
  actOnUser
);
// REV-4: admins keep or remove reviews that members flagged.
adminRouter.get(
  "/review-flags",
  validate(reviewFlagListQuerySchema, "query"),
  flaggedReviewsForAdmin
);
adminRouter.post(
  "/reviews/:id/moderation",
  validate(reviewModerationParamsSchema, "params"),
  validate(reviewModerationSchema),
  moderateFlaggedReview
);
