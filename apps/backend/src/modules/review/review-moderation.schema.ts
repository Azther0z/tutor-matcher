import { z } from "zod";

export const reviewModerationParamsSchema = z.object({ id: z.uuid() });

// REV-4: Keep needs no reason; Remove must say why, and the author is told.
export const reviewModerationSchema = z
  .strictObject({
    decision: z.enum(["KEEP", "REMOVE"]),
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .refine((input) => input.decision === "KEEP" || !!input.reason, {
    message: "A reason is required to remove a review",
    path: ["reason"],
  });

export const reviewFlagListQuerySchema = z.object({
  status: z.enum(["PENDING", "DECIDED"]).default("PENDING"),
});

export type ReviewModerationInput = z.infer<typeof reviewModerationSchema>;
export type ReviewFlagListStatus = z.infer<typeof reviewFlagListQuerySchema>["status"];
