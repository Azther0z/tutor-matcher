import { prisma } from "../../lib/db.ts";
import type {
  ProfileRequest,
  StudentProfileRequest,
  TutorEnrollmentRequest,
} from "./profile.schema.ts";

export class ProfileForbiddenError extends Error {
  constructor(message = "Only Tutors can update a Tutor profile") {
    super(message);
    this.name = "ProfileForbiddenError";
  }
}

export class UserNotFoundError extends Error {
  constructor(message = "User not found") {
    super(message);
    this.name = "UserNotFoundError";
  }
}

export class TutorAlreadyApprovedError extends Error {
  constructor(message = "Your Tutor application has already been approved") {
    super(message);
    this.name = "TutorAlreadyApprovedError";
  }
}

// The enroll page only cares about three application phases; PUBLISHED and
// UNPUBLISHED both mean "an admin approved this account as a Tutor".
export type TutorApplicationStatus = "NONE" | "PENDING" | "APPROVED" | "REJECTED";

const tutorApplicationSelect = {
  id: true,
  avatarUrl: true,
  bio: true,
  introVideoUrl: true,
  governmentId: true,
  status: true,
  enrolledAt: true,
  // The enrollment application manages exactly one certification document —
  // enrollTutor() always updates that same row rather than adding another.
  certifications: { select: { id: true, fileUrl: true }, take: 1 },
} as const;

function applicationStatusFor(status: string): Exclude<TutorApplicationStatus, "NONE"> {
  if (status === "PENDING") return "PENDING";
  if (status === "REJECTED") return "REJECTED";
  return "APPROVED";
}

// A linked Tutor record does not by itself mean "approved" — enrollTutor()
// links one immediately on first submission, while it is still PENDING.
function isApprovedTutorStatus(status: string): boolean {
  return status === "PUBLISHED" || status === "UNPUBLISHED";
}

export async function getTutorApplication(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tutor: { select: tutorApplicationSelect } },
  });

  if (!user) {
    throw new UserNotFoundError();
  }

  if (!user.tutor) {
    return { status: "NONE" as const, tutor: null };
  }

  const { certifications, ...tutor } = user.tutor;

  return {
    status: applicationStatusFor(user.tutor.status),
    tutor: { ...tutor, certificationUrl: certifications[0]?.fileUrl ?? null },
  };
}

export async function enrollTutor(userId: string, input: TutorEnrollmentRequest) {
  return prisma.$transaction(async (tx) => {
    const existingUser = await tx.user.findUnique({
      where: { id: userId },
      select: {
        tutorId: true,
        tutor: { select: { status: true, certifications: { select: { id: true }, take: 1 } } },
      },
    });

    if (!existingUser) {
      throw new UserNotFoundError();
    }

    // A new applicant, a pending applicant, or a rejected applicant may (re-)submit.
    // Once an admin has approved the account, the application is closed.
    if (
      existingUser.tutor &&
      existingUser.tutor.status !== "PENDING" &&
      existingUser.tutor.status !== "REJECTED"
    ) {
      throw new TutorAlreadyApprovedError();
    }

    const tutorData = {
      avatarUrl: input.avatarUrl,
      bio: input.bio,
      introVideoUrl: input.introVideoUrl,
      governmentId: input.governmentId,
      status: "PENDING" as const,
    };

    const tutor = existingUser.tutorId
      ? await tx.tutor.update({ where: { id: existingUser.tutorId }, data: tutorData })
      : await tx.tutor.create({ data: tutorData });

    if (!existingUser.tutorId) {
      await tx.user.update({
        where: { id: userId },
        data: { tutor: { connect: { id: tutor.id } } },
      });
    }

    // The application requires exactly one teaching-certification document;
    // re-submission replaces it rather than accumulating extra rows.
    const existingCertificationId = existingUser.tutor?.certifications[0]?.id;
    const certification = existingCertificationId
      ? await tx.certification.update({
          where: { id: existingCertificationId },
          data: { fileUrl: input.certificationUrl },
        })
      : await tx.certification.create({
          data: { fileUrl: input.certificationUrl, tutorId: tutor.id },
        });

    return { tutor: { ...tutor, certificationUrl: certification.fileUrl } };
  });
}

export async function updateTutorProfile(userId: string, input: ProfileRequest) {
  return prisma.$transaction(async (tx) => {
    const existingUser = await tx.user.findUnique({
      where: { id: userId },
      select: {
        tutorId: true,
        tutor: { select: { status: true, certifications: { select: { id: true }, take: 1 } } },
      },
    });

    // A linked Tutor record is not by itself "approved" — enrollTutor() links
    // one immediately on first submission, while it is still PENDING (and it
    // may since have been REJECTED). This endpoint edits an already-published
    // listing, so only an account an admin has actually approved may use it;
    // everyone else belongs in the enroll-tutor application instead.
    if (
      !existingUser ||
      !existingUser.tutorId ||
      !existingUser.tutor ||
      !isApprovedTutorStatus(existingUser.tutor.status)
    ) {
      throw new ProfileForbiddenError();
    }

    const tutorData = {
      avatarUrl: input.tutor.avatarUrl,
      bio: input.tutor.bio,
      introVideoUrl: input.tutor.introVideoUrl,
      governmentId: input.tutor.governmentId,
    };

    const tutor = await tx.tutor.update({ where: { id: existingUser.tutorId }, data: tutorData });

    const user = await tx.user.update({
      where: { id: userId },
      data: {
        firstName: input.user.firstName,
        lastName: input.user.lastName,
        bio: input.user.bio,
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

    // Same one-certification-document model as the enrollment flow: replace
    // the existing document rather than accumulating extra rows.
    const existingCertificationId = existingUser.tutor.certifications[0]?.id;
    const certification = existingCertificationId
      ? await tx.certification.update({
          where: { id: existingCertificationId },
          data: { fileUrl: input.tutor.certificationUrl },
        })
      : await tx.certification.create({
          data: { fileUrl: input.tutor.certificationUrl, tutorId: tutor.id },
        });

    return { user, tutor: { ...tutor, certificationUrl: certification.fileUrl } };
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
  // A stale-but-unexpired token for a since-deleted user would otherwise reach
  // `student.upsert` below and fail on the `Student.userId` foreign key,
  // surfacing as an unhandled 500 instead of a 404.
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });

  if (!user) {
    throw new UserNotFoundError();
  }

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
