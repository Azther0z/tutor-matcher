import { prisma } from "../../lib/db.ts";
import {
  sendBookingNotificationEmail,
  sendMessageNotificationEmail,
  sendPaymentNotificationEmail,
} from "../../lib/email.ts";
import type { NotificationPreferencesUpdate } from "./notification.schema.ts";

export class UserNotFoundError extends Error {
  constructor(message = "User not found") {
    super(message);
    this.name = "UserNotFoundError";
  }
}

const notificationPreferencesSelect = {
  notifyOnBooking: true,
  notifyOnMessage: true,
  notifyOnPayment: true,
} as const;

export async function getNotificationPreferences(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: notificationPreferencesSelect,
  });

  if (!user) {
    throw new UserNotFoundError();
  }

  return user;
}

export async function updateNotificationPreferences(
  userId: string,
  input: NotificationPreferencesUpdate
) {
  try {
    return await prisma.user.update({
      where: { id: userId },
      data: input,
      select: notificationPreferencesSelect,
    });
  } catch (error) {
    if (error instanceof Error && (error as { code?: string }).code === "P2025") {
      throw new UserNotFoundError();
    }

    throw error;
  }
}

export type BookingNotificationDetails = { subjectName: string; scheduledAt: Date };
export type MessageNotificationDetails = { senderName: string; preview: string };
export type PaymentNotificationDetails = { amount: number; description: string };

type NotifyUserEvent =
  | { eventType: "booking"; details: BookingNotificationDetails }
  | { eventType: "message"; details: MessageNotificationDetails }
  | { eventType: "payment"; details: PaymentNotificationDetails };

// TODO: nothing calls this yet. Once real booking, messaging, and payment
// flows exist, have them call notifyUser() after the event they represent
// actually happens (a booking is confirmed, a message is sent, a payment
// completes) so the member is notified according to their preferences.
export async function notifyUser(userId: string, event: NotifyUserEvent) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, ...notificationPreferencesSelect },
  });

  if (!user) {
    throw new UserNotFoundError();
  }

  const preferenceByEvent = {
    booking: user.notifyOnBooking,
    message: user.notifyOnMessage,
    payment: user.notifyOnPayment,
  } as const;

  if (!preferenceByEvent[event.eventType]) {
    return;
  }

  try {
    switch (event.eventType) {
      case "booking":
        await sendBookingNotificationEmail({ to: user.email, ...event.details });
        break;
      case "message":
        await sendMessageNotificationEmail({ to: user.email, ...event.details });
        break;
      case "payment":
        await sendPaymentNotificationEmail({ to: user.email, ...event.details });
        break;
    }
  } catch {
    // Notification delivery is best-effort: a failed email must never fail
    // the caller's own operation (creating a booking, sending a message,
    // completing a payment).
  }
}
