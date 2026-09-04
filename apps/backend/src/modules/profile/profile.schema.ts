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
