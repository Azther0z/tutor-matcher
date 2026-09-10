import { prisma } from "../../lib/db.ts";
import type { ProfileRequest, StudentProfileRequest } from "./profile.schema.ts";

const userSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  bio: true,
  tutorId: true,
  createdAt: true,
} as const;

// There is no `isTutor` column; an account is a Tutor when it is linked to a
// Tutor record. Expose that as a derived `isTutor` flag and hide the raw id.
function toUserResponse<T extends { tutorId: number | null }>(user: T) {
  const { tutorId, ...rest } = user;
  return { ...rest, isTutor: tutorId !== null };
}

export async function getCurrentUser(userId: number) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: userSelect });
  return toUserResponse(user);
}

/**
 * Saves the Tutor listing for the current user. Anyone can call this: submitting
 * the form is what makes the account a Tutor, because it creates the Tutor
 * record and links it to the account.
 */
export async function updateTutorProfile(userId: number, input: ProfileRequest) {
  return prisma.$transaction(async (tx) => {
    const existingUser = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { tutorId: true },
    });

    const tutorData = {
      avatarUrl: input.tutor.avatarUrl,
      bio: input.tutor.bio,
      introVideoUrl: input.tutor.introVideoUrl,
      governmentId: input.tutor.governmentId,
    };

    const tutor = existingUser.tutorId
      ? await tx.tutor.update({ where: { id: existingUser.tutorId }, data: tutorData })
      : await tx.tutor.create({ data: tutorData });

    const user = existingUser.tutorId
      ? await tx.user.findUniqueOrThrow({ where: { id: userId }, select: userSelect })
      : await tx.user.update({
          where: { id: userId },
          data: { tutor: { connect: { id: tutor.id } } },
          select: userSelect,
        });

    return { user: toUserResponse(user), tutor };
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
