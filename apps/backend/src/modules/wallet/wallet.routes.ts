import { Router } from "express";
import { validate } from "../../middleware/validate.ts";
import { confirmPromptPayTopup, summary } from "./wallet.controller.ts";
import { confirmTopupSchema } from "./wallet.schema.ts";

export const walletRouter = Router();

walletRouter.get("/", summary);
walletRouter.post("/topups/confirm", validate(confirmTopupSchema), confirmPromptPayTopup);
