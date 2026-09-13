import "dotenv/config";

const jwtSecret = process.env.JWT_SECRET ?? "";
const nodeEnv = process.env.NODE_ENV ?? "development";
const configuredEmailDeliveryMode = process.env.EMAIL_DELIVERY_MODE?.trim();

export type EmailDeliveryMode = "log" | "resend";

export function resolveEmailDeliveryMode(currentNodeEnv: string, configuredMode?: string): string {
  return configuredMode ?? (currentNodeEnv === "production" ? "resend" : "log");
}

if (!jwtSecret) {
  console.warn("JWT_SECRET is not set; falling back to an insecure development secret.");
}

export const env = {
  nodeEnv,
  port: Number(process.env.PORT ?? 8000),
  databaseUrl: process.env.DATABASE_URL ?? "",
  jwtSecret: jwtSecret || "dev-insecure-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  emailDeliveryMode: resolveEmailDeliveryMode(nodeEnv, configuredEmailDeliveryMode),
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  resendFromEmail: process.env.RESEND_FROM_EMAIL ?? "",
  frontendUrl: process.env.FRONTEND_URL?.trim() || "http://localhost:3000",
  frontendUrlConfigured: Boolean(process.env.FRONTEND_URL?.trim()),
};
