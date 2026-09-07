import { z } from "zod";

const studentEducationLevels = [
  "PRIMARY_SCHOOL",
  "LOWER_SECONDARY_SCHOOL",
  "UPPER_SECONDARY_SCHOOL",
  "VOCATIONAL_CERTIFICATE",
  "HIGHER_VOCATIONAL_CERTIFICATE",
  "UNIVERSITY",
  "WORKING_ADULT",
] as const;

const preferredLearningPeriods = ["MORNING", "AFTERNOON", "EVENING", "FLEXIBLE"] as const;

const optionalUrl = z.url().nullable().optional();
const optionalText = z.string().trim().max(2000).nullable().optional();

export const profileRequestSchema = z.object({
  user: z.object({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    bio: optionalText,
  }),
  tutor: z.object({
    avatarUrl: optionalUrl,
    bio: optionalText,
    introVideoUrl: optionalUrl,
    governmentId: z.string().trim().min(1).max(255),
  }),
});

export type ProfileRequest = z.infer<typeof profileRequestSchema>;

export const studentProfileRequestSchema = z.object({
  educationLevel: z.enum(studentEducationLevels),
  learningAreaIds: z
    .array(z.number().int().positive())
    .min(1)
    .max(20)
    .refine((ids) => new Set(ids).size === ids.length, "Learning areas must be unique"),
  goals: z.array(z.string().trim().min(1).max(100)).min(1).max(10),
  preferredLearningPeriod: z.enum(preferredLearningPeriods),
  preferredDurationMinutes: z.union([z.literal(30), z.literal(60), z.literal(90)]),
});

export type StudentProfileRequest = z.infer<typeof studentProfileRequestSchema>;

export const learningAreaSearchSchema = z.object({
  search: z.string().trim().max(100).optional(),
});
