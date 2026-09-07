import { z } from "zod";

export const signupSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.email(),
  password: z.string().min(8).max(100),
  bio: z.string().trim().max(2000).nullable().optional(),
});

export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const passwordResetRequestSchema = z.object({
  email: z.email(),
});

export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema>;

export const passwordResetValidateSchema = z.object({
  token: z.string().min(1),
});

export const passwordResetConfirmSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(100),
});

export type PasswordResetConfirmInput = z.infer<typeof passwordResetConfirmSchema>;
