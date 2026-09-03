import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { env } from "./env.ts";

export type AuthTokenPayload = {
  sub: number;
  email: string;
  isAdmin: boolean;
};

export function signAuthToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"],
  });
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  const decoded = jwt.verify(token, env.jwtSecret);

  if (
    typeof decoded !== "object" ||
    decoded === null ||
    typeof decoded.sub !== "number" ||
    typeof decoded.email !== "string" ||
    typeof decoded.isAdmin !== "boolean"
  ) {
    throw new Error("Malformed auth token payload");
  }

  return { sub: decoded.sub, email: decoded.email, isAdmin: decoded.isAdmin };
}
