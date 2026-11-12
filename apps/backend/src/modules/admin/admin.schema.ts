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

// SAFE-1: user management.
export const userSearchQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  role: z.enum(["all", "student", "tutor"]).default("all"),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});
export type UserSearchQuery = z.infer<typeof userSearchQuerySchema>;
export const userParamsSchema = z.object({ id: z.uuid() });
export const accountActionSchema = z
  .strictObject({
    type: z.enum(["SUSPEND", "BAN"]),
    reason: z.string().trim().min(1).max(500),
    days: z.union([z.literal(1), z.literal(7), z.literal(30)]).optional(),
  })
  .refine((input) => (input.type === "SUSPEND") === (input.days !== undefined), {
    message: "A suspension lasts 1, 7 or 30 days; a ban has no duration",
    path: ["days"],
  });
export type AccountActionRequest = z.infer<typeof accountActionSchema>;
