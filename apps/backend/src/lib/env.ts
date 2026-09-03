import "dotenv/config";

const jwtSecret = process.env.JWT_SECRET ?? "";

if (!jwtSecret) {
  console.warn("JWT_SECRET is not set; falling back to an insecure development secret.");
}

export const env = {
  port: Number(process.env.PORT ?? 8000),
  databaseUrl: process.env.DATABASE_URL ?? "",
  jwtSecret: jwtSecret || "dev-insecure-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
};
