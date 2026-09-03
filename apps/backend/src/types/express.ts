// Module augmentation for Express's Request. Imported for its side effect from
// src/middleware/auth.ts so every toolchain (tsc, ts-jest, ts-node) that
// compiles that file also sees this. Keep the shape in sync with
// AuthTokenPayload in src/lib/jwt.ts.
export {};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        sub: number;
        email: string;
        isAdmin: boolean;
      };
    }
  }
}
