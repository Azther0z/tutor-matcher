import type { Request, Response } from "express";
import { z } from "zod";
import { getTutorSummary, TutorNotFoundError } from "./discovery.service.ts";

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
