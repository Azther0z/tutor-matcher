import type { Prisma, TutorProfileVersion } from "../../generated/prisma/client.ts";
import { tutorEnrollmentRequestSchema } from "./profile.schema.ts";
import { prisma } from "../../lib/db.ts";
import type {
  AccountUpdateRequest,
  ProfileRequest,
  StudentProfileRequest,
  TutorEnrollmentRequest,
  TutorDraftRequest,
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
      include: {
        learningAreas: { include: { learningArea: true } },
        user: { select: { firstName: true, lastName: true } },
      },
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

  // The upsert's `include.user` is evaluated before the user.update above runs
  // in the same transaction, so it can return stale firstName/lastName when a
  // rename was requested. Patch the response in-memory instead of reordering
  // the transaction or re-querying.
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

const accountSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  createdAt: true,
} as const;

// Loads the account for a credential change and re-authenticates it.
async function authenticateAccount(userId: string, currentPassword: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { ...accountSelect, password: true },
  });

  if (!user) {
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

  if (!user) {
    throw new AccountNotFoundError();
  }

  return user;
}

export async function updateAccount(userId: string, input: AccountUpdateRequest) {
  const user = await authenticateAccount(userId, input.currentPassword);
  const firstName = input.firstName?.trim();
  const lastName = input.lastName?.trim();
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
        firstName: firstName ?? undefined,
        lastName: lastName ?? undefined,
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

export class TutorWorkflowError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "TutorWorkflowError";
  }
}

export const versionInclude = { certifications: { orderBy: { id: "asc" as const } } };
export const currentTutorInclude = { currentProfileVersion: { include: versionInclude } };
type VersionWithCertificates = TutorProfileVersion & { certifications: { fileUrl: string }[] };
type CurrentTutor = {
  id: string;
  status: string;
  enrolledAt: Date;
  currentProfileVersionId: string;
  currentProfileVersion: VersionWithCertificates;
};

export function flattenVersion(version: VersionWithCertificates) {
  const { certifications, ...fields } = version;
  return { ...fields, certificationUrl: certifications[0]?.fileUrl ?? null };
}

export function flattenTutor(tutor: CurrentTutor) {
  const version = tutor.currentProfileVersion;
  return {
    id: tutor.id,
    status: tutor.status,
    enrolledAt: tutor.enrolledAt,
    avatarUrl: version.avatarUrl,
    bio: version.bio,
    introVideoUrl: version.introVideoUrl,
    identificationCardUrl: version.identificationCardUrl,
    certificationUrl: version.certifications[0]?.fileUrl ?? null,
    verified: true,
  };
}

// Every workflow writer takes this same row lock before checking pending state.
// PostgreSQL READ COMMITTED then sees the previous writer's committed changes.
export async function lockProfileUser(tx: Prisma.TransactionClient, userId: string) {
  await tx.$queryRaw`SELECT user_id FROM users WHERE user_id = ${userId}::uuid FOR UPDATE`;
  const user = await tx.user.findUnique({
    where: { id: userId },
    include: { tutor: { include: currentTutorInclude } },
  });
  if (!user) throw new UserNotFoundError();
  return user;
}

async function applicationResponse(tx: Prisma.TransactionClient, userId: string) {
  const user = await tx.user.findUnique({
    where: { id: userId },
    include: { tutor: { include: currentTutorInclude } },
  });
  if (!user) throw new UserNotFoundError();
  const active = await tx.tutorProfileVersion.findFirst({
    where: { userId, status: { in: ["DRAFT", "PENDING"] } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: versionInclude,
  });
  const latest =
    active ??
    (await tx.tutorProfileVersion.findFirst({
      where: { userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: versionInclude,
    }));
  return {
    status: user.tutor ? "APPROVED" : (latest?.status ?? "NONE"),
    tutor: user.tutor ? flattenTutor(user.tutor) : null,
    version: latest ? flattenVersion(latest) : null,
  };
}

export async function getTutorApplication(userId: string) {
  return prisma.$transaction((tx) => applicationResponse(tx, userId), {
    isolationLevel: "RepeatableRead",
  });
}

async function requireNoPending(tx: Prisma.TransactionClient, userId: string) {
  const pending = await tx.tutorProfileVersion.findFirst({ where: { userId, status: "PENDING" } });
  if (pending)
    throw new TutorWorkflowError(409, "Withdraw your pending request before changing it");
}

async function writeDraft(tx: Prisma.TransactionClient, userId: string, input: TutorDraftRequest) {
  const draft = await tx.tutorProfileVersion.findFirst({
    where: { userId, status: "DRAFT" },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  const previous = draft
    ? null
    : await tx.tutorProfileVersion.findFirst({
        where: { userId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: versionInclude,
      });
  const fields = input;
  const certificationUrl = input.certificationUrl;
  const baseline: Partial<ReturnType<typeof flattenVersion>> = previous
    ? flattenVersion(previous)
    : {};
  const createdAt = new Date(Math.max(Date.now(), (previous?.createdAt.getTime() ?? 0) + 1));
  // Pick fields explicitly: validation middleware does not replace req.body.
  const data = {
    avatarUrl: fields.avatarUrl,
    bio: fields.bio?.trim() ?? fields.bio,
    introVideoUrl: fields.introVideoUrl,
    identificationCardUrl: fields.identificationCardUrl,
  };
  const certifications =
    certificationUrl === undefined
      ? undefined
      : {
          ...(draft ? { deleteMany: {} } : {}),
          create: certificationUrl ? [{ fileUrl: certificationUrl }] : [],
        };
  return draft
    ? tx.tutorProfileVersion.update({
        where: { id: draft.id },
        data: { ...data, certifications },
        include: versionInclude,
      })
    : tx.tutorProfileVersion.create({
        data: {
          avatarUrl: fields.avatarUrl === undefined ? baseline.avatarUrl : data.avatarUrl,
          bio: fields.bio === undefined ? baseline.bio : data.bio,
          introVideoUrl:
            fields.introVideoUrl === undefined ? baseline.introVideoUrl : data.introVideoUrl,
          identificationCardUrl:
            fields.identificationCardUrl === undefined
              ? baseline.identificationCardUrl
              : data.identificationCardUrl,
          userId,
          createdAt,
          certifications:
            certifications ??
            (previous
              ? { create: previous.certifications.map(({ fileUrl }) => ({ fileUrl })) }
              : undefined),
        },
        include: versionInclude,
      });
}

export function validateSubmission(version: VersionWithCertificates) {
  const parsed = tutorEnrollmentRequestSchema.safeParse({
    ...flattenVersion(version),
    consentAccepted: true,
  });
  if (!parsed.success)
    throw new TutorWorkflowError(
      400,
      "Complete your bio, introduction video, identification card and certification before submitting"
    );
}

export async function saveTutorDraft(userId: string, input: TutorDraftRequest) {
  return prisma.$transaction(async (tx) => {
    await lockProfileUser(tx, userId);
    await requireNoPending(tx, userId);
    await writeDraft(tx, userId, input);
    return applicationResponse(tx, userId);
  });
}

async function submitVersion(
  tx: Prisma.TransactionClient,
  version: VersionWithCertificates,
  current?: VersionWithCertificates
) {
  validateSubmission(version);
  const content = (value: VersionWithCertificates) =>
    JSON.stringify([
      value.avatarUrl,
      value.bio,
      value.introVideoUrl,
      value.identificationCardUrl,
      value.certifications.map(({ fileUrl }) => fileUrl).sort(),
    ]);
  if (current && content(current) === content(version)) {
    throw new TutorWorkflowError(400, "Change your profile before submitting it for review");
  }
  await tx.tutorProfileVersion.update({
    where: { id: version.id },
    data: { status: "PENDING", submittedAt: new Date() },
  });
}

export async function submitTutorDraft(userId: string) {
  return prisma.$transaction(async (tx) => {
    const user = await lockProfileUser(tx, userId);
    await requireNoPending(tx, userId);
    const draft = await tx.tutorProfileVersion.findFirst({
      where: { userId, status: "DRAFT" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: versionInclude,
    });
    if (!draft) throw new TutorWorkflowError(404, "No draft to submit");
    await submitVersion(tx, draft, user.tutor?.currentProfileVersion);
    return applicationResponse(tx, userId);
  });
}

export async function enrollTutor(userId: string, input: TutorEnrollmentRequest) {
  return prisma.$transaction(async (tx) => {
    const user = await lockProfileUser(tx, userId);
    if (user.tutor) throw new TutorAlreadyApprovedError();
    await requireNoPending(tx, userId);
    const draft = await writeDraft(tx, userId, input);
    await submitVersion(tx, draft);
    return applicationResponse(tx, userId);
  });
}

export async function updateTutorProfile(userId: string, input: ProfileRequest) {
  return prisma.$transaction(async (tx) => {
    const user = await lockProfileUser(tx, userId);
    if (!user.tutor) throw new ProfileForbiddenError();
    await requireNoPending(tx, userId);
    const draft = await writeDraft(tx, userId, input.tutor);
    await submitVersion(tx, draft, user.tutor.currentProfileVersion);
    // Names belong to account settings; never mutate them during review.
    return applicationResponse(tx, userId);
  });
}

export async function withdrawTutorRequest(userId: string) {
  return prisma.$transaction(async (tx) => {
    await lockProfileUser(tx, userId);
    const pending = await tx.tutorProfileVersion.findFirst({
      where: { userId, status: "PENDING" },
    });
    if (!pending) throw new TutorWorkflowError(409, "No pending request to withdraw");
    await tx.tutorProfileVersion.update({
      where: { id: pending.id },
      data: { status: "CANCELLED" },
    });
    return applicationResponse(tx, userId);
  });
}

export async function setTutorPublication(userId: string, published: boolean) {
  return prisma.$transaction(async (tx) => {
    const user = await lockProfileUser(tx, userId);
    if (!user.tutor) throw new ProfileForbiddenError();
    await tx.tutor.update({
      where: { id: user.tutor.id },
      data: { status: published ? "PUBLISHED" : "UNPUBLISHED" },
    });
    return applicationResponse(tx, userId);
  });
}
