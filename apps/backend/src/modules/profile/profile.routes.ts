import { Router } from "express";
import { validate } from "../../middleware/validate.ts";
import { getStudentProfileController, saveStudentProfileController } from "./profile.controller.ts";
import { studentProfileRequestSchema } from "./profile.schema.ts";

export const profileRouter = Router();

profileRouter.get("/student", getStudentProfileController);
profileRouter.put("/student", validate(studentProfileRequestSchema), saveStudentProfileController);
