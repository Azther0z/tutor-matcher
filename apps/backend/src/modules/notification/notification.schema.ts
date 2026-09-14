import { z } from "zod";

export const notificationPreferencesUpdateSchema = z.object({
  notifyOnBooking: z.boolean(),
  notifyOnMessage: z.boolean(),
  notifyOnPayment: z.boolean(),
});

export type NotificationPreferencesUpdate = z.infer<typeof notificationPreferencesUpdateSchema>;
