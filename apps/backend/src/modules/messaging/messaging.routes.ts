import { Router } from "express";
import { validate } from "../../middleware/validate.ts";
import { getMessagingInbox, postMessage } from "./messaging.controller.ts";
import { sendMessageSchema } from "./messaging.schema.ts";

export const messagingRouter = Router();

messagingRouter.post("/", validate(sendMessageSchema), postMessage);
messagingRouter.get("/inbox", getMessagingInbox);
