import { prisma } from "../../lib/db.ts";
import {
  LearningAreaMissingError,
  StudentProfileMissingError,
  UserNotFoundError,
} from "./profile.errors.ts";
import type { StudentProfileRequest } from "./profile.schema.ts";

function studentProfileResponse(student: Awaited<ReturnType<typeof findStudentProfile>>) {
  if (!student) return null;
  return {
    id: student.id,
    userId: student.userId,
    firstName: student.user.firstName,
    lastName: student.user.lastName,
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
    include: {
      learningAreas: { include: { learningArea: true } },
      user: { select: { firstName: true, lastName: true } },
    },
  });
}

export async function getStudentProfile(userId: string) {
  const student = await findStudentProfile(userId);
  if (!student) throw new StudentProfileMissingError();
  return studentProfileResponse(student);
}

export async function saveStudentProfile(userId: string, input: StudentProfileRequest) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw new UserNotFoundError();

  const learningAreaCount = await prisma.learningArea.count({
    where: { id: { in: input.learningAreaIds } },
  });
  if (learningAreaCount !== input.learningAreaIds.length) {
    throw new LearningAreaMissingError();
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
      include: {
        learningAreas: { include: { learningArea: true } },
        user: { select: { firstName: true, lastName: true } },
      },
    });

    if (input.user) {
      await tx.user.update({
        where: { id: userId },
        data: { firstName: input.user.firstName, lastName: input.user.lastName },
      });
    }
    return savedStudent;
  });

  const responseStudent = input.user
    ? { ...student, user: { firstName: input.user.firstName, lastName: input.user.lastName } }
    : student;
  return studentProfileResponse(responseStudent);
}

export async function searchLearningAreas(search?: string) {
  return prisma.learningArea.findMany({
    where: search ? { name: { contains: search, mode: "insensitive" } } : undefined,
    orderBy: { name: "asc" },
    take: 20,
  });
}
