import type { Request, Response } from "express";
import { getTutorSummary, TutorNotFoundError } from "./discovery.service.ts";

export async function getTutorById(req: Request, res: Response) {
  const tutorId = Number(req.params.id);

  if (!Number.isInteger(tutorId)) {
    res.status(404).json({ message: "Tutor not found" });
    return;
  }

  try {
    const tutor = await getTutorSummary(tutorId);
    res.status(200).json(tutor);
  } catch (error) {
    if (error instanceof TutorNotFoundError) {
      res.status(404).json({ message: error.message });
      return;
    }

    throw error;
  }
}
