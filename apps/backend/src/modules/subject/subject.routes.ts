import { Router } from "express";
import { validate } from "../../middleware/validate.ts";
import { subjectParamsSchema, subjectRequestSchema } from "./subject.schema.ts";
import { createSubject, listSubjects, SubjectError, updateSubject } from "./subject.service.ts";
import type { Response } from "express";

export const subjectRouter = Router();

function handleError(error: unknown, res: Response) {
  if (!(error instanceof SubjectError)) throw error;
  res.status(error.status).json({ message: error.message });
}

subjectRouter.get("/", async (req, res) => {
  try {
    res.json({ subjects: await listSubjects(req.user!.sub) });
  } catch (error) {
    handleError(error, res);
  }
});

subjectRouter.post("/", validate(subjectRequestSchema), async (req, res) => {
  try {
    const subject = await createSubject(req.user!.sub, subjectRequestSchema.parse(req.body));
    res.status(201).json({ subject });
  } catch (error) {
    handleError(error, res);
  }
});

subjectRouter.put(
  "/:subjectId",
  validate(subjectParamsSchema, "params"),
  validate(subjectRequestSchema),
  async (req, res) => {
    try {
      const { subjectId } = subjectParamsSchema.parse(req.params);
      const subject = await updateSubject(
        req.user!.sub,
        subjectId,
        subjectRequestSchema.parse(req.body)
      );
      res.json({ subject });
    } catch (error) {
      handleError(error, res);
    }
  }
);
