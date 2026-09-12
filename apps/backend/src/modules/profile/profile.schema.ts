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
    bio: z.string().trim().min(1).max(2000),
    introVideoUrl: optionalUrl,
    governmentId: z.string().trim().min(1).max(255),
    certificationUrl: z.url(),
  }),
});

export type ProfileRequest = z.infer<typeof profileRequestSchema>;

// Tutor enrollment collects the public Tutor details plus the application's
// required documents — the account's name and personal bio are already set
// elsewhere (signup / settings). All three application requirements
// (government ID, teaching-certification document, bio) are required here and
// validated server-side; avatar and intro video are additional listing details.
export const tutorEnrollmentRequestSchema = z.object({
  avatarUrl: optionalUrl,
  bio: z.string().trim().min(1).max(2000),
  introVideoUrl: z.url(),
  governmentId: z.string().trim().min(1).max(255),
  certificationUrl: z.url(),
});

export type TutorEnrollmentRequest = z.infer<typeof tutorEnrollmentRequestSchema>;

export const studentProfileRequestSchema = z.object({
  educationLevel: z.enum(studentEducationLevels),
  learningAreaIds: z
    .array(z.string().uuid())
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

// Account settings (/settings/account) cover email and password only. Public
// listing fields live on the Tutor profile above.
export const accountUpdateSchema = z
  .object({
    email: z.email().optional(),
    // Re-authentication: changing sign-in credentials always costs the current
    // password, even though the request is already authenticated.
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8).max(100).optional(),
  })
  .refine((input) => input.email !== undefined || input.newPassword !== undefined, {
    message: "Provide a new email address or a new password",
  });

export type AccountUpdateRequest = z.infer<typeof accountUpdateSchema>;
