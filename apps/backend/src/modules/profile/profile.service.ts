import { prisma } from "../../lib/db.ts";
import type { ProfileRequest } from "./profile.schema.ts";

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
