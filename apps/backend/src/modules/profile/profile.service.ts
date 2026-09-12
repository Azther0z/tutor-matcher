import { prisma } from "../../lib/db.ts";
import type {
  AccountDeactivateRequest,
  AccountUpdateRequest,
  ProfileRequest,
  StudentProfileRequest,
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

export async function updateTutorProfile(userId: string, input: ProfileRequest) {
  return prisma.$transaction(async (tx) => {
    const existingUser = await tx.user.findUnique({
      where: { id: userId },
      select: { tutorId: true },
    });

    if (!existingUser) {
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
        createdAt: true,
      },
    });

    return { user, tutor };
  });
}

export class LearningAreaNotFoundError extends Error {
  constructor() {
    super("One or more learning areas do not exist");
    this.name = "LearningAreaNotFoundError";
  }
}

export class StudentProfileNotFoundError extends Error {
  constructor() {
    super("Student profile not found");
    this.name = "StudentProfileNotFoundError";
  }
}

function studentProfileResponse(student: Awaited<ReturnType<typeof findStudentProfile>>) {
  if (!student) {
    return null;
  }

  return {
    id: student.id,
    userId: student.userId,
    educationLevel: student.educationLevel,
    goals: student.goals,
    preferredLearningPeriod: student.preferredLearningPeriod,
    preferredDurationMinutes: student.preferredDurationMinutes,
    updatedAt: student.updatedAt,
    learningAreas: student.learningAreas.map(({ learningArea }) => learningArea),
  };
}

export async function findStudentProfile(userId: string) {
  return prisma.student.findUnique({
    where: { userId },
    include: { learningAreas: { include: { learningArea: true } } },
  });
}

export async function getStudentProfile(userId: string) {
  const student = await findStudentProfile(userId);

  if (!student) {
    throw new StudentProfileNotFoundError();
  }

  return studentProfileResponse(student);
}

export async function saveStudentProfile(userId: string, input: StudentProfileRequest) {
  const learningAreaCount = await prisma.learningArea.count({
    where: { id: { in: input.learningAreaIds } },
  });

  if (learningAreaCount !== input.learningAreaIds.length) {
    throw new LearningAreaNotFoundError();
  }

  const student = await prisma.$transaction(async (tx) => {
    const savedStudent = await tx.student.upsert({
      where: { userId },
      create: {
        userId,
        educationLevel: input.educationLevel,
        goals: input.goals,
        preferredLearningPeriod: input.preferredLearningPeriod,
        preferredDurationMinutes: input.preferredDurationMinutes,
        learningAreas: {
          create: input.learningAreaIds.map((learningAreaId) => ({
            learningArea: { connect: { id: learningAreaId } },
          })),
        },
      },
      update: {
        educationLevel: input.educationLevel,
        goals: input.goals,
        preferredLearningPeriod: input.preferredLearningPeriod,
        preferredDurationMinutes: input.preferredDurationMinutes,
        learningAreas: {
          deleteMany: {},
          create: input.learningAreaIds.map((learningAreaId) => ({
            learningArea: { connect: { id: learningAreaId } },
          })),
        },
      },
      include: { learningAreas: { include: { learningArea: true } } },
    });

    if (input.user) {
      await tx.user.update({
        where: { id: userId },
        data: {
          firstName: input.user.firstName,
          lastName: input.user.lastName,
        },
      });
    }

    return savedStudent;
  });

  return studentProfileResponse(student);
}

export async function searchLearningAreas(search?: string) {
  return prisma.learningArea.findMany({
    where: search ? { name: { contains: search, mode: "insensitive" } } : undefined,
    orderBy: { name: "asc" },
    take: 20,
  });
}

const accountSelect = {
  id: true,
  email: true,
  createdAt: true,
  deactivatedAt: true,
} as const;

// Loads the account for a credential change and re-authenticates it. A
// deactivated account is treated as gone: its token may still be unexpired, but
// it can no longer act on itself.
async function authenticateAccount(userId: string, currentPassword: string) {
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

export async function getAccount(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: accountSelect });

  if (!user || user.deactivatedAt) {
    throw new AccountNotFoundError();
  }

  return user;
}

export async function updateAccount(userId: string, input: AccountUpdateRequest) {
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

export async function deactivateAccount(userId: string, input: AccountDeactivateRequest) {
  await authenticateAccount(userId, input.currentPassword);

  return prisma.user.update({
    where: { id: userId },
    data: { deactivatedAt: new Date() },
    select: accountSelect,
  });
}
