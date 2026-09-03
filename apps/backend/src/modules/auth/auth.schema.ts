import { z } from "zod";

export const signupSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(100),
});

export type SignupInput = z.infer<typeof signupSchema>;
