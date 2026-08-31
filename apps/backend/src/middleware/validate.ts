import type { RequestHandler } from "express";
import type { z } from "zod";

type RequestPart = "body" | "params" | "query";

export function validate(schema: z.ZodType, part: RequestPart = "body"): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req[part]);

    if (!result.success) {
      res.status(400).json({ message: "Invalid request", issues: result.error.issues });
      return;
    }

    next();
  };
}
