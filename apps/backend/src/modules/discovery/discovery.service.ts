import { prisma } from "../../lib/db.ts";

export class TutorNotFoundError extends Error {
  constructor() {
    super("Tutor not found");
    this.name = "TutorNotFoundError";
  }
}

export async function getTutorSummary(tutorId: number) {
  const tutor = await prisma.tutor.findUnique({
    where: { id: tutorId },
    select: {
      id: true,
      user: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  if (!tutor?.user) {
    throw new TutorNotFoundError();
  }

  return {
    id: tutor.id,
    userId: tutor.user.id,
    firstName: tutor.user.firstName,
    lastName: tutor.user.lastName,
  };
}
