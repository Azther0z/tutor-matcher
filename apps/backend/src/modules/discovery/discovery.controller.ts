import type { Request, Response } from "express";
import { z } from "zod";
import { tutorSearchQuerySchema } from "./discovery.schema.ts";
import {
  getPriceRange,
  getTutorProfile,
  getTutorSummary,
  listLearningAreas,
  searchTutorSubjects,
  TutorNotFoundError,
  TutorUnavailableError,
} from "./discovery.service.ts";

export async function getTutorSearch(req: Request, res: Response) {
  res.vary("Authorization");
  const result = await searchTutorSubjects(
    tutorSearchQuerySchema.parse(req.query),
    new Date(),
    req.user?.sub
  );
  if (result.recommendationMode === "personalized") {
    res.setHeader("Cache-Control", "private, no-store");
  }
  res.status(200).json(result);
}

export async function getSearchPriceRange(_req: Request, res: Response) {
  res.status(200).json({ priceRange: await getPriceRange() });
}

export async function getLearningAreas(_req: Request, res: Response) {
  res.status(200).json({ learningAreas: await listLearningAreas() });
}

export async function getTutorProfileById(req: Request, res: Response) {
  const parsedTutorId = z.string().uuid().safeParse(req.params.id);

  if (!parsedTutorId.success) {
    res.status(404).json({ message: "This tutor profile is unavailable" });
    return;
  }

  try {
    res.status(200).json(await getTutorProfile(parsedTutorId.data));
  } catch (error) {
    if (error instanceof TutorUnavailableError) {
      res.status(404).json({ message: error.message });
      return;
    }

    throw error;
  }
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
