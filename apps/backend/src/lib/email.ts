import { Resend } from "resend";
import { env, type EmailDeliveryMode } from "./env.ts";

type PasswordResetEmail = {
  to: string;
  resetUrl: string;
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

export async function sendPasswordResetEmail({ to, resetUrl }: PasswordResetEmail) {
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
      <p>This link expires in 30 minutes and can only be used once.</p>
      <p>If you did not request this, you can safely ignore this email.</p>`,
    text: `Reset your Tutor Matcher password: ${resetUrl}\n\nThis link expires in 30 minutes and can only be used once. If you did not request this, you can safely ignore this email.`,
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
