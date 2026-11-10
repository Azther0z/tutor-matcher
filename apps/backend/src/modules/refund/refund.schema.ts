import { z } from "zod";

// PAY-3: the Student says what happened so an admin can decide. A no-show needs no text;
// an unsatisfactory lesson or another problem must be explained.
export const createRefundRequestSchema = z
  .object({
    reason: z.enum(["TUTOR_NO_SHOW", "UNSATISFACTORY_LESSON", "OTHER"]),
    details: z.string().trim().max(1000).optional(),
  })
  .refine((input) => input.reason === "TUTOR_NO_SHOW" || !!input.details, {
    message: "Tell us what went wrong with the lesson",
    path: ["details"],
  });

export const refundIdParamsSchema = z.object({ id: z.uuid() });

export const refundReviewSchema = z
  .object({
    decision: z.enum(["APPROVED", "REJECTED"]),
    rejectionReason: z.string().trim().max(500).optional(),
  })
  .refine((input) => input.decision !== "REJECTED" || !!input.rejectionReason, {
    message: "A rejection reason is required",
    path: ["rejectionReason"],
  });

export const refundListQuerySchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
});

export type CreateRefundRequestInput = z.infer<typeof createRefundRequestSchema>;
export type RefundReviewInput = z.infer<typeof refundReviewSchema>;
