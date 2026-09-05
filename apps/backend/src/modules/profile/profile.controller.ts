import type { Request, Response } from "express";
import { ProfileForbiddenError, updateTutorProfile } from "./profile.service.ts";
import type { ProfileRequest } from "./profile.schema.ts";
import { learningAreaSearchSchema } from "./profile.schema.ts";
import {
  getStudentProfile,
  LearningAreaNotFoundError,
  saveStudentProfile,
  searchLearningAreas,
  StudentProfileNotFoundError,
} from "./profile.service.ts";

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

export async function getStudentProfileForCurrentUser(req: Request, res: Response) {
  try {
    const profile = await getStudentProfile(req.user!.sub);
    res.status(200).json(profile);
  } catch (error) {
    if (error instanceof StudentProfileNotFoundError) {
      res.status(404).json({ message: error.message });
      return;
    }

    throw error;
  }
}

export async function saveStudentProfileForCurrentUser(req: Request, res: Response) {
  try {
    const profile = await saveStudentProfile(req.user!.sub, req.body);
    res.status(200).json(profile);
  } catch (error) {
    if (error instanceof LearningAreaNotFoundError) {
      res.status(400).json({ message: error.message });
      return;
    }

    throw error;
  }
}

export async function getLearningAreaSuggestions(req: Request, res: Response) {
  const { search } = learningAreaSearchSchema.parse(req.query);
  const learningAreas = await searchLearningAreas(search);
  res.status(200).json(learningAreas);
}
