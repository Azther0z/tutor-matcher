import type { NextFunction, Request, Response } from "express";
import "../types/express.ts";
import { verifyAuthToken } from "../lib/jwt.ts";
import { findAccountRestriction, restrictionResponse } from "../modules/admin/account-actions.ts";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  let user: Request["user"];
  try {
    user = verifyAuthToken(token);
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
    return;
  }

  // SAFE-1: a suspended or banned account loses access now, not when its token expires.
  const restriction = await findAccountRestriction(user!.sub);
  if (restriction) {
    res.status(403).json(restrictionResponse(restriction));
    return;
  }

  req.user = user;
  next();
}

// Public discovery can use a verified identity for personalization without requiring sign-in.
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header) {
    next();
    return;
  }

  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    next();
    return;
  }

  try {
    req.user = verifyAuthToken(token);
    next();
  } catch {
    next();
  }
}
