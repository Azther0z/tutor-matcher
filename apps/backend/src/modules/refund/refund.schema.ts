import { z } from "zod";

// PAY-3: the Student explains an unsatisfactory lesson so an admin can decide; a no-show needs no text.
export const createRefundRequestSchema = z
  .object({
    reason: z.enum(["TUTOR_NO_SHOW", "UNSATISFACTORY_LESSON"]),
    details: z.string().trim().max(1000).optional(),
  })
  .refine((input) => input.reason !== "UNSATISFACTORY_LESSON" || !!input.details, {
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
