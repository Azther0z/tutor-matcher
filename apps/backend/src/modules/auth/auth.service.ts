import { prisma } from "../../lib/db.ts";
import type { SignupInput } from "./auth.schema.ts";

export class SignupConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SignupConflictError";
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
