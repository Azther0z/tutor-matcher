import type { Request, Response } from "express";
import { ProfileForbiddenError, updateTutorProfile } from "./profile.service.ts";
import type { ProfileRequest } from "./profile.schema.ts";

export async function updateProfile(req: Request, res: Response) {
  try {
    const profile = await updateTutorProfile(req.user!.sub, req.body as ProfileRequest);
    res.status(200).json(profile);
  } catch (error) {
    if (error instanceof ProfileForbiddenError) {
      res.status(403).json({ message: error.message });
      return;
    }

    throw error;
  }
}
