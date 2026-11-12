import type { Request, Response } from "express";
import { TutorWorkflowError } from "../profile/profile.service.ts";
import { listTutorRequests, reviewTutorRequest } from "./admin.service.ts";
import {
  accountActionSchema,
  reviewParamsSchema,
  tutorReviewSchema,
  userParamsSchema,
  userSearchQuerySchema,
} from "./admin.schema.ts";
import {
  getManagedUser,
  searchUsers,
  takeAccountAction,
  UserManagementError,
} from "./user-management.service.ts";
import { UnsupportedDocumentFormatError } from "./document-format.ts";

export async function listRequests(req: Request, res: Response) {
  try {
    res.json(await listTutorRequests(req.user!.sub));
  } catch (error) {
    if (error instanceof TutorWorkflowError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
    throw error;
  }
}
export async function reviewRequest(req: Request, res: Response) {
  try {
    const { id } = reviewParamsSchema.parse(req.params);
    res.json(await reviewTutorRequest(req.user!.sub, id, tutorReviewSchema.parse(req.body)));
  } catch (error) {
    if (error instanceof TutorWorkflowError) {
      res.status(error.statusCode).json({
        message: error.message,
        ...(error instanceof UnsupportedDocumentFormatError ? { documents: error.documents } : {}),
      });
      return;
    }
    throw error;
  }
}

function sendUserManagementError(error: unknown, res: Response) {
  if (!(error instanceof UserManagementError)) throw error;
  res.status(error.statusCode).json({ message: error.message });
}

export async function listUsers(req: Request, res: Response) {
  try {
    res.json(await searchUsers(req.user!.sub, userSearchQuerySchema.parse(req.query)));
  } catch (error) {
    sendUserManagementError(error, res);
  }
}

export async function getUser(req: Request, res: Response) {
  try {
    const { id } = userParamsSchema.parse(req.params);
    res.json(await getManagedUser(req.user!.sub, id));
  } catch (error) {
    sendUserManagementError(error, res);
  }
}

export async function actOnUser(req: Request, res: Response) {
  try {
    const { id } = userParamsSchema.parse(req.params);
    const input = accountActionSchema.parse(req.body);
    res.status(201).json(await takeAccountAction(req.user!.sub, id, input));
  } catch (error) {
    sendUserManagementError(error, res);
  }
}
