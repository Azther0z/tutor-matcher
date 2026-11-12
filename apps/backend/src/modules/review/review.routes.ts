import { Router } from "express";
import { submitReview } from "./review.controller.ts";

export const reviewRouter = Router();
// REV-1: a Student publishes a review of their own completed lesson.
reviewRouter.post("/", submitReview);
