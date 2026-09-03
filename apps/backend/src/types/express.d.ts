import type { AuthTokenPayload } from "../lib/jwt.ts";

declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}

export {};
