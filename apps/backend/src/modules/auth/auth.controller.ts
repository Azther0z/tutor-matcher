import type { Request, Response } from "express";
import { signup as signupService, SignupConflictError } from "./auth.service.ts";
import type { SignupInput } from "./auth.schema.ts";

export async function signup(req: Request, res: Response) {
  const input = req.body as SignupInput;

  try {
    const user = await signupService(input);
    res.status(201).json(user);
  } catch (error) {
    if (error instanceof SignupConflictError) {
      res.status(409).json({ message: error.message });
      return;
    }

    throw error;
  }
}
