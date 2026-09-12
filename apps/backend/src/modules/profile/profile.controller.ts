import type { Request, Response } from "express";
import {
  AccountNotFoundError,
  EmailAlreadyInUseError,
  enrollTutor,
  getAccount,
  getStudentProfile,
  getTutorApplication,
  InvalidCurrentPasswordError,
  LearningAreaNotFoundError,
  ProfileForbiddenError,
  saveStudentProfile,
  searchLearningAreas,
  StudentProfileNotFoundError,
  TutorAlreadyApprovedError,
  updateAccount,
  updateTutorProfile,
  UserNotFoundError,
} from "./profile.service.ts";
import type {
  AccountUpdateRequest,
  ProfileRequest,
  TutorEnrollmentRequest,
} from "./profile.schema.ts";
import { learningAreaSearchSchema } from "./profile.schema.ts";
import { signAuthToken } from "../../lib/jwt.ts";

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

function handleAccountError(error: unknown, res: Response) {
  if (error instanceof AccountNotFoundError) {
    res.status(404).json({ message: error.message });
    return true;
  }

  if (error instanceof InvalidCurrentPasswordError) {
    res.status(403).json({ message: error.message });
    return true;
  }

  if (error instanceof EmailAlreadyInUseError) {
    res.status(409).json({ message: error.message });
    return true;
  }

  return false;
}

export async function getAccountForCurrentUser(req: Request, res: Response) {
  try {
    const account = await getAccount(req.user!.sub);
    res.status(200).json(account);
  } catch (error) {
    if (handleAccountError(error, res)) return;
    throw error;
  }
}

export async function updateAccountForCurrentUser(req: Request, res: Response) {
  try {
    const account = await updateAccount(req.user!.sub, req.body as AccountUpdateRequest);
    // The token carries the email, so a changed address would leave the caller
    // holding a stale one. Reissue so the new email is in effect immediately.
    const token = signAuthToken({
      sub: account.id,
      email: account.email,
      isAdmin: req.user!.isAdmin,
    });

    res.status(200).json({ account, token });
  } catch (error) {
    if (handleAccountError(error, res)) return;
    throw error;
  }
}
