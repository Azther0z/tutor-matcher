import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../../lib/db.ts";
import { buildPasswordResetUrl, sendPasswordResetEmail } from "../../lib/email.ts";
import {
  GENERIC_PASSWORD_RESET_MESSAGE,
  PASSWORD_RESET_TTL_MINUTES,
  PASSWORD_RESET_TTL_MS,
} from "../../lib/password-reset.ts";
import type {
  LoginInput,
  PasswordResetConfirmInput,
  PasswordResetRequestInput,
  SignupInput,
} from "./auth.schema.ts";

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

export class CurrentUserNotFoundError extends Error {
  constructor() {
    super("User not found");
    this.name = "CurrentUserNotFoundError";
  }
}

export class InvalidPasswordResetTokenError extends Error {
  constructor(message = "This password reset link is invalid or has expired") {
    super(message);
    this.name = "InvalidPasswordResetTokenError";
  }
}

export async function signup({ firstName, lastName, email, password, bio }: SignupInput) {
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });

  if (existing) {
    throw new SignupConflictError("A user with this email already exists");
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        password: passwordHash,
        bio: bio ?? null,
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

  const isBcryptPassword = /^\$2[aby]\$\d{2}\$/.test(user?.password ?? "");
  const passwordMatches = user
    ? isBcryptPassword
      ? await bcrypt.compare(password, user.password)
      : user.password === password
    : false;

  if (!user || !passwordMatches) {
    throw new InvalidCredentialsError();
  }

  if (!isBcryptPassword) {
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: passwordHash },
    });
  }

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    isAdmin: user.isAdmin,
  };
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      isAdmin: true,
    },
  });

  if (!user) throw new CurrentUserNotFoundError();
  return user;
}

function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isUsableResetToken(token: { usedAt: Date | null; expiresAt: Date }, now: Date) {
  return token.usedAt === null && token.expiresAt > now;
}

export async function requestPasswordReset({ email }: PasswordResetRequestInput) {
  const normalizedEmail = normalizeEmail(email);
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, email: true },
  });

  if (!user) {
    return { message: GENERIC_PASSWORD_RESET_MESSAGE };
  }

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashResetToken(rawToken);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

  const resetToken = await prisma.$transaction(async (transaction) =>
    transaction.passwordResetToken.upsert({
      where: { userId: user.id },
      update: { tokenHash, expiresAt, usedAt: null },
      create: { tokenHash, userId: user.id, expiresAt },
      select: { id: true, tokenHash: true },
    })
  );

  try {
    await sendPasswordResetEmail({
      to: user.email,
      resetUrl: buildPasswordResetUrl(rawToken),
      expiresInMinutes: PASSWORD_RESET_TTL_MINUTES,
    });
  } catch (error) {
    await prisma.passwordResetToken.deleteMany({
      where: { id: resetToken.id, tokenHash: resetToken.tokenHash },
    });
    throw error;
  }

  return { message: GENERIC_PASSWORD_RESET_MESSAGE };
}

export async function validatePasswordResetToken(token: string) {
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(token) },
    select: { usedAt: true, expiresAt: true },
  });

  if (!resetToken || !isUsableResetToken(resetToken, new Date())) {
    throw new InvalidPasswordResetTokenError();
  }

  return { valid: true };
}

export async function confirmPasswordReset({ token, password }: PasswordResetConfirmInput) {
  const tokenHash = hashResetToken(token);
  const now = new Date();

  await prisma.$transaction(async (transaction) => {
    const resetToken = await transaction.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, usedAt: true, expiresAt: true },
    });

    if (!resetToken || !isUsableResetToken(resetToken, now)) {
      throw new InvalidPasswordResetTokenError();
    }

    const consumed = await transaction.passwordResetToken.updateMany({
      where: { id: resetToken.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });

    if (consumed.count !== 1) {
      throw new InvalidPasswordResetTokenError();
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await transaction.user.update({
      where: { id: resetToken.userId },
      data: { password: passwordHash },
    });
  });

  return { message: "Your password has been reset successfully." };
}
