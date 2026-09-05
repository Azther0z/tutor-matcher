import { z } from "zod";

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

// Account settings (/settings/account) cover email, password, and deactivation
// only. Public listing fields live on the Tutor profile above.
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

export const accountDeactivateSchema = z.object({
  currentPassword: z.string().min(1),
});

export type AccountDeactivateRequest = z.infer<typeof accountDeactivateSchema>;
