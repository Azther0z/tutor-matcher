import { z } from "zod";

export const signupSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(100),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  bio: z.string().trim().max(2000).nullable().optional(),
});

export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;
