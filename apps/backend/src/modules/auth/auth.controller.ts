import type { Request, Response } from "express";
import {
  signup as signupService,
  login as loginService,
  AccountDeactivatedError,
  SignupConflictError,
  InvalidCredentialsError,
} from "./auth.service.ts";
import type { LoginInput, SignupInput } from "./auth.schema.ts";
import { signAuthToken } from "../../lib/jwt.ts";

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

export async function login(req: Request, res: Response) {
  const input = req.body as LoginInput;

  try {
    const user = await loginService(input);
    const token = signAuthToken({ sub: user.id, email: user.email, isAdmin: user.isAdmin });
    res.status(200).json({ token, user });
  } catch (error) {
    if (error instanceof InvalidCredentialsError) {
      res.status(401).json({ message: error.message });
      return;
    }

    if (error instanceof AccountDeactivatedError) {
      res.status(403).json({ message: error.message });
      return;
    }

    throw error;
  }
}
