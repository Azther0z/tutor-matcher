import type { Prisma, TutorProfileVersion } from "../../generated/prisma/client.ts";
import {
  tutorEnrollmentRequestSchema,
  tutorDraftRequestSchema,
  profileRequestSchema,
} from "./profile.schema.ts";
import { prisma } from "../../lib/db.ts";
import { mapSubject, subjectSelect, type SubjectSummary } from "../subject/subject.public.ts";
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

export const versionInclude = { certifications: { orderBy: { fileUrl: "asc" as const } } };
export const currentTutorInclude = {
  currentProfileVersion: { include: versionInclude },
  subjects: { select: subjectSelect, orderBy: [{ name: "asc" as const }, { id: "asc" as const }] },
};
type VersionWithCertificates = TutorProfileVersion & { certifications: { fileUrl: string }[] };
type CurrentTutor = {
  id: string;
  status: string;
  enrolledAt: Date;
  currentProfileVersionId: string;
  currentProfileVersion: VersionWithCertificates;
  subjects?: SubjectSummary[];
};

export function flattenVersion(version: VersionWithCertificates) {
  const { certifications, ...fields } = version;
  return {
    ...fields,
    certificationUrl: certifications[0]?.fileUrl ?? null,
    certificationUrls: certifications.map(({ fileUrl }) => fileUrl),
  };
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
    certificationUrls: version.certifications.map(({ fileUrl }) => fileUrl),
    verified: true,
    subjects: (tutor.subjects ?? []).map(mapSubject),
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

async function applicationResponse(
  tx: Prisma.TransactionClient,
  userId: string,
  focusVersionId?: string
) {
  const user = await tx.user.findUnique({
    where: { id: userId },
    include: { tutor: { include: currentTutorInclude } },
  });
  if (!user) throw new UserNotFoundError();
  const versions = await tx.tutorProfileVersion.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: versionInclude,
  });
  const drafts = versions.filter((version) => version.status === "DRAFT");
  const pending = versions.find((version) => version.status === "PENDING");
  const latestSubmittedVersion = versions.find((version) => version.status !== "DRAFT");
  const latestReview = versions
    .filter((version) => version.status === "APPROVED" || version.status === "REJECTED")
    .sort((a, b) => (b.reviewedAt?.getTime() ?? 0) - (a.reviewedAt?.getTime() ?? 0))[0];
  const focus = focusVersionId ? versions.find((version) => version.id === focusVersionId) : null;
  const latest = focus ?? pending ?? drafts[0] ?? versions[0];
  return {
    status: user.tutor ? "APPROVED" : pending ? "PENDING" : (latest?.status ?? "NONE"),
    tutor: user.tutor ? flattenTutor(user.tutor) : null,
    version: latest ? flattenVersion(latest) : null,
    drafts: drafts.map(flattenVersion),
    submissions: versions.filter((version) => version.status !== "DRAFT").map(flattenVersion),
    pendingRequest: pending ? flattenVersion(pending) : null,
    latestReview: latestReview ? flattenVersion(latestReview) : null,
    latestSubmittedVersion: latestSubmittedVersion ? flattenVersion(latestSubmittedVersion) : null,
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
    throw new TutorWorkflowError(409, "Withdraw your pending request before submitting another");
}

async function legacyDraft(tx: Prisma.TransactionClient, userId: string) {
  const drafts = await tx.tutorProfileVersion.findMany({
    where: { userId, status: "DRAFT" },
    include: versionInclude,
    take: 2,
  });
  if (drafts.length > 1)
    throw new TutorWorkflowError(409, "Multiple drafts exist; select a draft by ID");
  return drafts[0];
}

async function ownerDraft(tx: Prisma.TransactionClient, userId: string, draftId: string) {
  const draft = await tx.tutorProfileVersion.findFirst({
    where: { id: draftId, userId },
    include: versionInclude,
  });
  if (!draft) throw new TutorWorkflowError(404, "Draft not found");
  if (draft.status !== "DRAFT") throw new TutorWorkflowError(409, "Only drafts can be changed");
  return draft;
}

async function draftBaseline(tx: Prisma.TransactionClient, userId: string) {
  const tutor = await tx.tutor.findFirst({
    where: { user: { id: userId } },
    include: currentTutorInclude,
  });
  return (
    tutor?.currentProfileVersion ??
    tx.tutorProfileVersion.findFirst({
      where: { userId, status: { not: "DRAFT" } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: versionInclude,
    })
  );
}

async function writeDraft(
  tx: Prisma.TransactionClient,
  userId: string,
  input: TutorDraftRequest,
  draft?: VersionWithCertificates
) {
  // Parse here: validation middleware checks input without replacing req.body.
  const fields = tutorDraftRequestSchema.parse(input);
  const previous = draft ?? (await draftBaseline(tx, userId));
  const existingCertificates = previous?.certifications ?? [];
  const certificationUrl = fields.certificationUrl;
  const certificateChanged =
    certificationUrl !== undefined &&
    !existingCertificates.some(({ fileUrl }) => fileUrl === certificationUrl) &&
    (certificationUrl !== null || existingCertificates.length > 0);
  const certificateUrls = [
    ...new Set(
      fields.certificationUrls ??
        (certificateChanged
          ? [
              ...(certificationUrl ? [certificationUrl] : []),
              ...(certificationUrl
                ? existingCertificates.slice(1).map(({ fileUrl }) => fileUrl)
                : []),
            ]
          : existingCertificates.map(({ fileUrl }) => fileUrl))
    ),
  ];
  const data = {
    avatarUrl: fields.avatarUrl === undefined ? previous?.avatarUrl : fields.avatarUrl,
    bio: fields.bio === undefined ? previous?.bio : fields.bio,
    introVideoUrl:
      fields.introVideoUrl === undefined ? previous?.introVideoUrl : fields.introVideoUrl,
    identificationCardUrl:
      fields.identificationCardUrl === undefined
        ? previous?.identificationCardUrl
        : fields.identificationCardUrl,
    certifications: {
      ...(draft ? { deleteMany: {} } : {}),
      create: certificateUrls.map((fileUrl) => ({ fileUrl })),
    },
  };
  if (draft) {
    return tx.tutorProfileVersion.update({
      where: { id: draft.id },
      data,
      include: versionInclude,
    });
  }
  const newest = await tx.tutorProfileVersion.findFirst({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { createdAt: true },
  });
  const createdAt = new Date(Math.max(Date.now(), (newest?.createdAt.getTime() ?? 0) + 1));
  return tx.tutorProfileVersion.create({
    data: { ...data, userId, createdAt },
    include: versionInclude,
  });
}

export async function createTutorDraft(userId: string, input: TutorDraftRequest) {
  return prisma.$transaction(async (tx) => {
    await lockProfileUser(tx, userId);
    const draft = await writeDraft(tx, userId, input);
    return applicationResponse(tx, userId, draft.id);
  });
}

export async function updateTutorDraft(userId: string, draftId: string, input: TutorDraftRequest) {
  return prisma.$transaction(async (tx) => {
    await lockProfileUser(tx, userId);
    const draft = await ownerDraft(tx, userId, draftId);
    await writeDraft(tx, userId, input, draft);
    return applicationResponse(tx, userId, draftId);
  });
}

export async function discardTutorDraft(userId: string, draftId: string) {
  return prisma.$transaction(async (tx) => {
    await lockProfileUser(tx, userId);
    await ownerDraft(tx, userId, draftId);
    await tx.tutorProfileVersion.delete({ where: { id: draftId } });
    return applicationResponse(tx, userId);
  });
}

export function validateSubmission(version: VersionWithCertificates) {
  const parsed = tutorEnrollmentRequestSchema.safeParse({
    ...flattenVersion(version),
    // The canonical array may be empty; the response-only singular alias is then null.
    certificationUrl: undefined,
    consentAccepted: true,
  });
  if (!parsed.success)
    throw new TutorWorkflowError(
      400,
      "Complete your bio, introduction video and identification card, and use valid certification URLs when supplied"
    );
}

export async function saveTutorDraft(userId: string, input: TutorDraftRequest) {
  return prisma.$transaction(async (tx) => {
    await lockProfileUser(tx, userId);
    const existing = await legacyDraft(tx, userId);
    const draft = await writeDraft(tx, userId, input, existing);
    return applicationResponse(tx, userId, draft.id);
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

export async function submitTutorDraft(userId: string, draftId?: string) {
  return prisma.$transaction(async (tx) => {
    const user = await lockProfileUser(tx, userId);
    const draft = draftId ? await ownerDraft(tx, userId, draftId) : await legacyDraft(tx, userId);
    await requireNoPending(tx, userId);
    if (!draft) throw new TutorWorkflowError(404, "No draft to submit");
    await submitVersion(tx, draft, user.tutor?.currentProfileVersion);
    return applicationResponse(tx, userId, draft.id);
  });
}

export async function enrollTutor(userId: string, input: TutorEnrollmentRequest) {
  return prisma.$transaction(async (tx) => {
    const user = await lockProfileUser(tx, userId);
    if (user.tutor) throw new TutorAlreadyApprovedError();
    await requireNoPending(tx, userId);
    const parsed = tutorEnrollmentRequestSchema.parse(input);
    const draft = await writeDraft(tx, userId, parsed, await legacyDraft(tx, userId));
    await submitVersion(tx, draft);
    return applicationResponse(tx, userId);
  });
}

export async function updateTutorProfile(userId: string, input: ProfileRequest) {
  return prisma.$transaction(async (tx) => {
    const user = await lockProfileUser(tx, userId);
    if (!user.tutor) throw new ProfileForbiddenError();
    await requireNoPending(tx, userId);
    const parsed = profileRequestSchema.parse(input);
    const draft = await writeDraft(tx, userId, parsed.tutor, await legacyDraft(tx, userId));
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
      include: versionInclude,
    });
    if (!pending) throw new TutorWorkflowError(409, "No pending request to withdraw");
    await tx.tutorProfileVersion.update({
      where: { id: pending.id },
      data: { status: "CANCELLED" },
    });
    return applicationResponse(tx, userId, pending.id);
  });
}

export async function copyTutorSubmission(userId: string, submissionId: string) {
  return prisma.$transaction(async (tx) => {
    await lockProfileUser(tx, userId);
    const submission = await tx.tutorProfileVersion.findFirst({
      where: { id: submissionId, userId },
      include: versionInclude,
    });
    if (!submission) throw new TutorWorkflowError(404, "Submission not found");
    // A cancelled request is revised after withdrawal, a rejected one after review (SAFE-3).
    if (submission.status !== "CANCELLED" && submission.status !== "REJECTED")
      throw new TutorWorkflowError(409, "Only cancelled or rejected submissions can be copied");
    const newest = await tx.tutorProfileVersion.findFirst({
      where: { userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { createdAt: true },
    });
    // Copy the submitted snapshot exactly, including incomplete legacy values.
    // The source version remains immutable; review metadata belongs to it alone.
    const draft = await tx.tutorProfileVersion.create({
      data: {
        userId,
        avatarUrl: submission.avatarUrl,
        bio: submission.bio,
        introVideoUrl: submission.introVideoUrl,
        identificationCardUrl: submission.identificationCardUrl,
        createdAt: new Date(Math.max(Date.now(), (newest?.createdAt.getTime() ?? 0) + 1)),
        certifications: {
          create: submission.certifications.map(({ fileUrl }) => ({ fileUrl })),
        },
      },
    });
    return applicationResponse(tx, userId, draft.id);
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
