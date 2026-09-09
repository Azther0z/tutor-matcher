import { prisma } from "../../lib/db.ts";
import type { LoginInput, SignupInput } from "./auth.schema.ts";

export class SignupConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SignupConflictError";
  }
}

export class InvalidCredentialsError extends Error {
  constructor(message = "Invalid email or password") {
    super(message);
    this.name = "InvalidCredentialsError";
  }
}

export async function signup({ email, password }: SignupInput) {
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });

  if (existing) {
    throw new SignupConflictError("A user with this email already exists");
  }

  try {
    const user = await prisma.user.create({
      data: {
        email,
        password,
        // firstName / lastName are required by the schema but not collected at
        // signup yet; they are filled in later on the profile screen.
        firstName: "",
        lastName: "",
      },
    });

    return { id: user.id, email: user.email, createdAt: user.createdAt };
  } catch (error) {
    // Safety net for the race where two signups pass the check above
    // concurrently; the DB unique constraint on `email` still rejects one.
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      throw new SignupConflictError("A user with this email already exists");
    }

    throw error;
  }
}

export async function login({ email, password }: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email } });

  // NOTE: passwords are still stored in plaintext (see signup). Swap this for
  // a constant-time hash comparison once hashing is added to both flows.
  if (!user || user.password !== password) {
    throw new InvalidCredentialsError();
  }

  return { id: user.id, email: user.email, isAdmin: user.isAdmin };
}
