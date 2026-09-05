import { prisma } from "../../lib/db.ts";
import type {
  AccountDeactivateRequest,
  AccountUpdateRequest,
  ProfileRequest,
} from "./profile.schema.ts";

export class ProfileForbiddenError extends Error {
  constructor(message = "Only Tutors can update a Tutor profile") {
    super(message);
    this.name = "ProfileForbiddenError";
  }
}

export class AccountNotFoundError extends Error {
  constructor(message = "Account not found") {
    super(message);
    this.name = "AccountNotFoundError";
  }
}

export class InvalidCurrentPasswordError extends Error {
  constructor(message = "Current password is incorrect") {
    super(message);
    this.name = "InvalidCurrentPasswordError";
  }
}

export class EmailAlreadyInUseError extends Error {
  constructor(message = "A user with this email already exists") {
    super(message);
    this.name = "EmailAlreadyInUseError";
  }
}

export async function updateTutorProfile(userId: number, input: ProfileRequest) {
  return prisma.$transaction(async (tx) => {
    const existingUser = await tx.user.findUnique({
      where: { id: userId },
      select: { isTutor: true, tutorId: true },
    });

    if (!existingUser?.isTutor) {
      throw new ProfileForbiddenError();
    }

    const tutorData = {
      avatarUrl: input.tutor.avatarUrl,
      bio: input.tutor.bio,
      introVideoUrl: input.tutor.introVideoUrl,
      governmentId: input.tutor.governmentId,
    };

    const tutor = existingUser.tutorId
      ? await tx.tutor.update({ where: { id: existingUser.tutorId }, data: tutorData })
      : await tx.tutor.create({ data: tutorData });

    const user = await tx.user.update({
      where: { id: userId },
      data: {
        firstName: input.user.firstName,
        lastName: input.user.lastName,
        bio: input.user.bio,
        tutor: existingUser.tutorId ? undefined : { connect: { id: tutor.id } },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        bio: true,
        isTutor: true,
        createdAt: true,
      },
    });

    return { user, tutor };
  });
}

const accountSelect = {
  id: true,
  email: true,
  isTutor: true,
  createdAt: true,
  deactivatedAt: true,
} as const;

// Loads the account for a credential change and re-authenticates it. A
// deactivated account is treated as gone: its token may still be unexpired, but
// it can no longer act on itself.
async function authenticateAccount(userId: number, currentPassword: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { ...accountSelect, password: true },
  });

  if (!user || user.deactivatedAt) {
    throw new AccountNotFoundError();
  }

  // NOTE: passwords are still stored in plaintext (see auth.service). Swap this
  // for a constant-time hash comparison once hashing is added to both flows.
  if (user.password !== currentPassword) {
    throw new InvalidCurrentPasswordError();
  }

  return user;
}

export async function getAccount(userId: number) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: accountSelect });

  if (!user || user.deactivatedAt) {
    throw new AccountNotFoundError();
  }

  return user;
}

export async function updateAccount(userId: number, input: AccountUpdateRequest) {
  const user = await authenticateAccount(userId, input.currentPassword);
  const email = input.email?.trim();

  if (email && email !== user.email) {
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });

    if (existing && existing.id !== userId) {
      throw new EmailAlreadyInUseError();
    }
  }

  try {
    return await prisma.user.update({
      where: { id: userId },
      data: {
        email: email ?? undefined,
        password: input.newPassword ?? undefined,
      },
      select: accountSelect,
    });
  } catch (error) {
    // Safety net for the race where two email changes pass the check above
    // concurrently; the DB unique constraint on `email` still rejects one.
    if (error instanceof Error && (error as { code?: string }).code === "P2002") {
      throw new EmailAlreadyInUseError();
    }

    throw error;
  }
}

export async function deactivateAccount(userId: number, input: AccountDeactivateRequest) {
  await authenticateAccount(userId, input.currentPassword);

  return prisma.user.update({
    where: { id: userId },
    data: { deactivatedAt: new Date() },
    select: accountSelect,
  });
}
