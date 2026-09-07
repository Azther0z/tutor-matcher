import { prisma } from "../../lib/db.ts";
import type { ProfileRequest, StudentProfileRequest } from "./profile.schema.ts";

export class ProfileForbiddenError extends Error {
  constructor(message = "Only Tutors can update a Tutor profile") {
    super(message);
    this.name = "ProfileForbiddenError";
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

export async function findStudentProfile(userId: number) {
  return prisma.student.findUnique({
    where: { userId },
    include: { learningAreas: { include: { learningArea: true } } },
  });
}

export async function getStudentProfile(userId: number) {
  const student = await findStudentProfile(userId);

  if (!student) {
    throw new StudentProfileNotFoundError();
  }

  return studentProfileResponse(student);
}

export async function saveStudentProfile(userId: number, input: StudentProfileRequest) {
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
