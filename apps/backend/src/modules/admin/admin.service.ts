import { prisma } from "../../lib/db.ts";
import type { Prisma } from "../../generated/prisma/client.ts";
import {
  TutorWorkflowError,
  lockProfileUser,
  flattenVersion,
  flattenTutor,
  versionInclude,
  currentTutorInclude,
  validateSubmission,
} from "../profile/profile.service.ts";
import type { TutorReviewRequest } from "./admin.schema.ts";

async function requireAdmin(tx: Prisma.TransactionClient, adminId: string) {
  const user = await tx.user.findUnique({ where: { id: adminId }, select: { isAdmin: true } });
  if (!user?.isAdmin) throw new TutorWorkflowError(403, "Administrator access required");
}

export async function listTutorRequests(adminId: string) {
  return prisma.$transaction(async (tx) => {
    await requireAdmin(tx, adminId);
    const requests = await tx.tutorProfileVersion.findMany({
      where: { status: "PENDING" },
      orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
      include: {
        ...versionInclude,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            tutor: { include: currentTutorInclude },
          },
        },
      },
    });
    return requests.map(({ user, ...version }) => ({
      ...flattenVersion(version),
      user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email },
      currentProfile: user.tutor ? flattenTutor(user.tutor) : null,
    }));
  });
}

export async function reviewTutorRequest(adminId: string, id: string, input: TutorReviewRequest) {
  return prisma.$transaction(async (tx) => {
    await requireAdmin(tx, adminId);
    const initial = await tx.tutorProfileVersion.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!initial) throw new TutorWorkflowError(404, "Tutor request not found");
    const user = await lockProfileUser(tx, initial.userId);
    // Re-read after the lock: a concurrent reviewer/withdrawal may have completed.
    const version = await tx.tutorProfileVersion.findUnique({
      where: { id },
      include: versionInclude,
    });
    if (!version) throw new TutorWorkflowError(404, "Tutor request not found");
    if (version.status !== "PENDING")
      throw new TutorWorkflowError(409, "This request is no longer pending");
    if (input.decision === "APPROVED") validateSubmission(version);
    const reviewed = await tx.tutorProfileVersion.update({
      where: { id },
      data: {
        status: input.decision,
        reviewedAt: new Date(),
        reviewedById: adminId,
        rejectionReason: input.decision === "REJECTED" ? input.rejectionReason!.trim() : null,
      },
      include: versionInclude,
    });
    if (input.decision === "APPROVED") {
      if (user.tutor) {
        await tx.tutor.update({
          where: { id: user.tutor.id },
          data: { currentProfileVersionId: id },
        });
      } else {
        const tutor = await tx.tutor.create({
          data: { currentProfileVersionId: id, status: "UNPUBLISHED" },
        });
        await tx.user.update({ where: { id: user.id }, data: { tutorId: tutor.id } });
      }
    }
    return flattenVersion(reviewed);
  });
}
