import type { Request, Response } from "express";
import { z } from "zod";
import { subjectPageQuerySchema, tutorSearchQuerySchema } from "./discovery.schema.ts";
import {
  getPriceRange,
  getTutorProfile,
  getTutorSubjectPage,
  getTutorSummary,
  listLearningAreas,
  searchTutorSubjects,
  SubjectUnavailableError,
  TutorNotFoundError,
  TutorUnavailableError,
} from "./discovery.service.ts";

const SEARCH_MAX_AGE_MS = 60 * 60 * 1000;

export async function getTutorSearch(req: Request, res: Response) {
  res.vary("Authorization");
  const query = tutorSearchQuerySchema.parse(req.query);
  const now = Date.now();
  const requestedTime = query.asOf ? Date.parse(query.asOf) : now;
  // Keep pagination stable briefly, but refresh bookmarked links and future timestamps.
  const referenceTime =
    requestedTime <= now && now - requestedTime <= SEARCH_MAX_AGE_MS ? requestedTime : now;
  const result = await searchTutorSubjects(query, new Date(referenceTime), req.user?.sub);
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

export async function getPublicTutorProfile(req: Request, res: Response) {
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

export async function getPublicSubjectPage(req: Request, res: Response) {
  const ids = z
    .object({ id: z.string().uuid(), subjectId: z.string().uuid() })
    .safeParse(req.params);

  if (!ids.success) {
    res.status(404).json({ message: "This subject is unavailable" });
    return;
  }

  const { date } = subjectPageQuerySchema.parse(req.query);
  try {
    res.status(200).json(await getTutorSubjectPage(ids.data.id, ids.data.subjectId, date));
  } catch (error) {
    if (error instanceof SubjectUnavailableError) {
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
