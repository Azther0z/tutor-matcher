import type { Request, Response } from "express";
import {
  ProfileForbiddenError,
  TutorAlreadyApprovedError,
  enrollTutor,
  getTutorApplication,
  updateTutorProfile,
} from "./profile.service.ts";
import type { ProfileRequest, TutorEnrollmentRequest } from "./profile.schema.ts";
import { learningAreaSearchSchema } from "./profile.schema.ts";
import {
  getStudentProfile,
  LearningAreaNotFoundError,
  saveStudentProfile,
  searchLearningAreas,
  StudentProfileNotFoundError,
  UserNotFoundError,
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

export async function getTutorApplicationForCurrentUser(req: Request, res: Response) {
  try {
    const application = await getTutorApplication(req.user!.sub);
    res.status(200).json(application);
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      res.status(404).json({ message: error.message });
      return;
    }

    throw error;
  }
}

export async function enrollTutorForCurrentUser(req: Request, res: Response) {
  try {
    const result = await enrollTutor(req.user!.sub, req.body as TutorEnrollmentRequest);
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      res.status(404).json({ message: error.message });
      return;
    }

    if (error instanceof TutorAlreadyApprovedError) {
      res.status(409).json({ message: error.message });
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

    if (error instanceof UserNotFoundError) {
      res.status(404).json({ message: error.message });
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
