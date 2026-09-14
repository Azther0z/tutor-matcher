import { Resend } from "resend";
import { env, type EmailDeliveryMode } from "./env.ts";

type PasswordResetEmail = {
  to: string;
  resetUrl: string;
  expiresInMinutes: number;
};

type EmailPayload = {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
};

type EmailClient = {
  emails: {
    send(payload: EmailPayload): Promise<{ error?: unknown } | unknown>;
  };
};

export class EmailConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailConfigurationError";
  }
}

export class EmailDeliveryError extends Error {
  constructor(message = "Could not send password reset email") {
    super(message);
    this.name = "EmailDeliveryError";
  }
}

function getEmailDeliveryMode(): EmailDeliveryMode {
  if (env.emailDeliveryMode === "log" || env.emailDeliveryMode === "resend") {
    return env.emailDeliveryMode;
  }

  throw new EmailConfigurationError('EMAIL_DELIVERY_MODE must be either "log" or "resend"');
}

function createResendClient(): EmailClient {
  if (!env.resendApiKey || !env.resendFromEmail || !env.frontendUrlConfigured) {
    throw new EmailConfigurationError(
      "RESEND_API_KEY, RESEND_FROM_EMAIL, and FRONTEND_URL are required when EMAIL_DELIVERY_MODE=resend"
    );
  }

  return new Resend(env.resendApiKey);
}

export async function sendPasswordResetEmail({
  to,
  resetUrl,
  expiresInMinutes,
}: PasswordResetEmail) {
  if (getEmailDeliveryMode() === "log") {
    console.info(`[password-reset] Reset link for ${to}: ${resetUrl}`);
    return;
  }

  const payload: EmailPayload = {
    from: env.resendFromEmail,
    to: [to],
    subject: "Reset your Tutor Matcher password",
    html: `<p>We received a request to reset your Tutor Matcher password.</p>
      <p><a href="${resetUrl}">Reset your password</a></p>
      <p>This link expires in ${expiresInMinutes} minutes and can only be used once.</p>
      <p>If you did not request this, you can safely ignore this email.</p>`,
    text: `Reset your Tutor Matcher password: ${resetUrl}\n\nThis link expires in ${expiresInMinutes} minutes and can only be used once. If you did not request this, you can safely ignore this email.`,
  };

  const client = createResendClient();
  let result: { error?: unknown } | unknown;
  try {
    result = await client.emails.send(payload);
  } catch {
    throw new EmailDeliveryError();
  }

  if (result && typeof result === "object" && "error" in result && result.error) {
    throw new EmailDeliveryError();
  }
}

export function buildPasswordResetUrl(token: string) {
  const url = new globalThis.URL("/reset-password", env.frontendUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

type BookingNotificationEmail = {
  to: string;
  subjectName: string;
  scheduledAt: Date;
};

type MessageNotificationEmail = {
  to: string;
  senderName: string;
  preview: string;
};

type PaymentNotificationEmail = {
  to: string;
  amount: number;
  description: string;
};

async function deliverEmail(payload: EmailPayload, deliveryErrorMessage: string) {
  const client = createResendClient();
  let result: { error?: unknown } | unknown;
  try {
    result = await client.emails.send(payload);
  } catch {
    throw new EmailDeliveryError(deliveryErrorMessage);
  }

  if (result && typeof result === "object" && "error" in result && result.error) {
    throw new EmailDeliveryError(deliveryErrorMessage);
  }
}

export async function sendBookingNotificationEmail({
  to,
  subjectName,
  scheduledAt,
}: BookingNotificationEmail) {
  const when = scheduledAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

  if (getEmailDeliveryMode() === "log") {
    console.info(`[notification:booking] ${to}: ${subjectName} at ${when}`);
    return;
  }

  await deliverEmail(
    {
      from: env.resendFromEmail,
      to: [to],
      subject: "Booking update on Tutor Matcher",
      html: `<p>Your booking for <strong>${subjectName}</strong> on ${when} has an update.</p>`,
      text: `Your booking for ${subjectName} on ${when} has an update.`,
    },
    "Could not send booking notification email"
  );
}

export async function sendMessageNotificationEmail({
  to,
  senderName,
  preview,
}: MessageNotificationEmail) {
  if (getEmailDeliveryMode() === "log") {
    console.info(`[notification:message] ${to}: new message from ${senderName}`);
    return;
  }

  await deliverEmail(
    {
      from: env.resendFromEmail,
      to: [to],
      subject: `New message from ${senderName}`,
      html: `<p>${senderName} sent you a message on Tutor Matcher:</p><p>${preview}</p>`,
      text: `${senderName} sent you a message on Tutor Matcher: ${preview}`,
    },
    "Could not send message notification email"
  );
}

export async function sendPaymentNotificationEmail({
  to,
  amount,
  description,
}: PaymentNotificationEmail) {
  const formattedAmount = amount.toFixed(2);

  if (getEmailDeliveryMode() === "log") {
    console.info(`[notification:payment] ${to}: ${description} (${formattedAmount})`);
    return;
  }

  await deliverEmail(
    {
      from: env.resendFromEmail,
      to: [to],
      subject: "Payment update on Tutor Matcher",
      html: `<p>${description}: <strong>${formattedAmount}</strong>.</p>`,
      text: `${description}: ${formattedAmount}.`,
    },
    "Could not send payment notification email"
  );
}
