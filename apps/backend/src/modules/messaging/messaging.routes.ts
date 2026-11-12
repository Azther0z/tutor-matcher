import { Router } from "express";
import { validate } from "../../middleware/validate.ts";
import {
  getMessagingConversations,
  getMessagingInbox,
  getMessagingThread,
  postMessage,
} from "./messaging.controller.ts";
import { sendMessageSchema } from "./messaging.schema.ts";

export const messagingRouter = Router();

messagingRouter.post("/", validate(sendMessageSchema), postMessage);
messagingRouter.get("/inbox", getMessagingInbox);
messagingRouter.get("/conversations", getMessagingConversations);
messagingRouter.get("/thread/:userId", getMessagingThread);
