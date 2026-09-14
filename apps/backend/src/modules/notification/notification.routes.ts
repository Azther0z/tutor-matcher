import { Router } from "express";
import { validate } from "../../middleware/validate.ts";
import {
  getNotificationPreferencesForCurrentUser,
  updateNotificationPreferencesForCurrentUser,
} from "./notification.controller.ts";
import { notificationPreferencesUpdateSchema } from "./notification.schema.ts";

export const notificationRouter = Router();

notificationRouter.get("/preferences", getNotificationPreferencesForCurrentUser);
notificationRouter.put(
  "/preferences",
  validate(notificationPreferencesUpdateSchema),
  updateNotificationPreferencesForCurrentUser
);
