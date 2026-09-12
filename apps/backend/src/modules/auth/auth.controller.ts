import type { Request, Response } from "express";
import {
  signup as signupService,
  login as loginService,
  SignupConflictError,
  CurrentUserNotFoundError,
  InvalidCredentialsError,
  getCurrentUser as getCurrentUserService,
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

    throw error;
  }
}

export async function getCurrentUser(req: Request, res: Response) {
  try {
    const user = await getCurrentUserService(req.user!.sub);
    res.status(200).json(user);
  } catch (error) {
    if (error instanceof CurrentUserNotFoundError) {
      res.status(404).json({ message: error.message });
      return;
    }

    throw error;
  }
}
