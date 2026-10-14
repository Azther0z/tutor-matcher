import { Prisma } from "../../generated/prisma/client.ts";
import { prisma } from "../../lib/db.ts";
import type { SubjectRequest } from "./subject.schema.ts";
import { mapSubject, subjectSelect, subjectSnapshot } from "./subject.public.ts";

export class SubjectError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "SubjectError";
  }
}

async function ownedTutorId(tx: Prisma.TransactionClient, userId: string) {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { tutorId: true },
  });
  if (!user?.tutorId) throw new SubjectError(403, "Only approved Tutors can manage subjects");
  return user.tutorId;
}

export async function listSubjects(userId: string) {
  const tutorId = await ownedTutorId(prisma, userId);
  return (
    await prisma.subject.findMany({
      where: { tutorId },
      select: subjectSelect,
      orderBy: [{ name: "asc" }, { id: "asc" }],
    })
  ).map(mapSubject);
}

export async function createSubject(userId: string, input: SubjectRequest) {
  const tutorId = await ownedTutorId(prisma, userId);
  const subject = await prisma.subject.create({
    data: { ...input, tutorId },
    select: subjectSelect,
  });
  return mapSubject(subject);
}

export async function updateSubject(userId: string, subjectId: string, input: SubjectRequest) {
  try {
    return await prisma.$transaction(
      async (tx) => {
        const tutorId = await ownedTutorId(tx, userId);
        const subject = await tx.subject.findFirst({
          where: { id: subjectId, tutorId },
          select: subjectSelect,
        });
        if (!subject) throw new SubjectError(404, "Subject not found");

        // Preserve all legacy booked details before changing the live offering.
        await tx.booking.updateMany({
          where: { subjectId, subjectName: null },
          data: subjectSnapshot(subject),
        });
        return mapSubject(
          await tx.subject.update({
            where: { id: subjectId, tutorId },
            data: input,
            select: subjectSelect,
          })
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034")
      throw new SubjectError(409, "The subject changed while saving. Please try again.");
    throw error;
  }
}
