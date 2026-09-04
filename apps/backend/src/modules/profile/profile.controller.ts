import type { Request, Response } from "express";
import { getStudentProfile, saveStudentProfile } from "./profile.service.ts";
import type { StudentProfileInput } from "./profile.schema.ts";

function authenticatedUserId(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Authentication required" });
    return null;
  }

  return req.user.sub;
}

export async function getStudentProfileController(req: Request, res: Response) {
  const userId = authenticatedUserId(req, res);
  if (userId === null) return;

  const profile = await getStudentProfile(userId);
  res.status(200).json({ profile });
}

export async function saveStudentProfileController(req: Request, res: Response) {
  const userId = authenticatedUserId(req, res);
  if (userId === null) return;

  const profile = await saveStudentProfile(userId, req.body as StudentProfileInput);
  res.status(200).json({ profile });
}
