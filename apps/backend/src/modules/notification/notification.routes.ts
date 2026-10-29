import { Router } from "express";
import { validate } from "../../middleware/validate.ts";
import { getNotificationPrefs, updateNotificationPrefs } from "./notification.controller.ts";
import { notificationPreferencesUpdateSchema } from "./notification.schema.ts";

export const notificationRouter = Router();

notificationRouter.get("/preferences", getNotificationPrefs);
notificationRouter.put(
  "/preferences",
  validate(notificationPreferencesUpdateSchema),
  updateNotificationPrefs
);
