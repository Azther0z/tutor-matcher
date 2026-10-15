import { z } from "zod";
export const reviewParamsSchema = z.object({ id: z.uuid() });
export const tutorReviewSchema = z
  .object({
    decision: z.enum(["APPROVED", "REJECTED"]),
    rejectionReason: z.string().trim().max(2000).optional(),
  })
  .refine((input) => input.decision !== "REJECTED" || !!input.rejectionReason, {
    message: "A rejection reason is required",
    path: ["rejectionReason"],
  });
export type TutorReviewRequest = z.infer<typeof tutorReviewSchema>;
