import type { Request, Response } from "express";
import { TutorWorkflowError } from "../profile/profile.service.ts";
import { listTutorRequests, reviewTutorRequest } from "./admin.service.ts";
import { reviewParamsSchema, tutorReviewSchema } from "./admin.schema.ts";
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
