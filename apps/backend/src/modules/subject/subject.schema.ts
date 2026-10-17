import { z } from "zod";

export const subjectRequestSchema = z.strictObject({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(2000),
  hourlyRate: z
    .string()
    .trim()
    .regex(/^\d{1,8}(?:\.\d{1,2})?$/, "Use a THB amount with at most two decimals")
    .refine((value) => Number(value) > 0, "Hourly rate must be greater than zero"),
  format: z.literal("ONLINE"),
  // DISC-1: one to three learning areas, so a subject can't appear under every filter.
  learningAreaIds: z
    .array(z.uuid())
    .min(1)
    .max(3)
    .refine((ids) => new Set(ids).size === ids.length, "Learning areas must be unique"),
});

export const subjectParamsSchema = z.object({ subjectId: z.uuid() });
export type SubjectRequest = z.infer<typeof subjectRequestSchema>;
