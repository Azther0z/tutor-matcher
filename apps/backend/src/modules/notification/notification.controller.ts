import type { Request, Response } from "express";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  UserNotFoundError,
} from "./notification.service.ts";
import type { NotificationPreferencesUpdate } from "./notification.schema.ts";

export async function getNotificationPreferencesForCurrentUser(req: Request, res: Response) {
  try {
    const preferences = await getNotificationPreferences(req.user!.sub);
    res.status(200).json(preferences);
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      res.status(404).json({ message: error.message });
      return;
    }

    throw error;
  }
}

export async function updateNotificationPreferencesForCurrentUser(req: Request, res: Response) {
  try {
    const preferences = await updateNotificationPreferences(
      req.user!.sub,
      req.body as NotificationPreferencesUpdate
    );
    res.status(200).json(preferences);
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      res.status(404).json({ message: error.message });
      return;
    }

    throw error;
  }
}
