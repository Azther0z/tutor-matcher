import type { Request, Response } from "express";
import { z } from "zod";
import { tutorSearchQuerySchema } from "./discovery.schema.ts";
import {
  getTutorSummary,
  listLearningAreas,
  searchTutorSubjects,
  TutorNotFoundError,
} from "./discovery.service.ts";

export async function getTutorSearch(req: Request, res: Response) {
  res.status(200).json(await searchTutorSubjects(tutorSearchQuerySchema.parse(req.query)));
}

export async function getLearningAreas(_req: Request, res: Response) {
  res.status(200).json({ learningAreas: await listLearningAreas() });
}

export async function getTutorById(req: Request, res: Response) {
  const parsedTutorId = z.string().uuid().safeParse(req.params.id);

  if (!parsedTutorId.success) {
    res.status(404).json({ message: "Tutor not found" });
    return;
  }

  try {
    const tutor = await getTutorSummary(parsedTutorId.data);
    res.status(200).json(tutor);
  } catch (error) {
    if (error instanceof TutorNotFoundError) {
      res.status(404).json({ message: error.message });
      return;
    }

    throw error;
  }
}
