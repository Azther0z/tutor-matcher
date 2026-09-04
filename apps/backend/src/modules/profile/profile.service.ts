import { prisma } from "../../lib/db.ts";
import type { StudentProfileInput } from "./profile.schema.ts";

export async function getStudentProfile(userId: number) {
  return prisma.studentProfile.findUnique({
    where: { userId },
    include: { subjects: { orderBy: { name: "asc" } } },
  });
}

export async function saveStudentProfile(userId: number, input: StudentProfileInput) {
  const subjects = input.subjects.map((name) => name.trim());
  const preferredWeekdays = input.preferredWeekdays ?? [];
  const timezone = input.timezone ?? "UTC";

  return prisma.studentProfile.upsert({
    where: { userId },
    create: {
      user: { connect: { id: userId } },
      level: input.level,
      goals: input.goals,
      preferredWeekdays,
      preferredStartMinute: input.preferredStartMinute,
      preferredEndMinute: input.preferredEndMinute,
      timezone,
      subjects: { create: subjects.map((name) => ({ name })) },
    },
    update: {
      level: input.level,
      goals: input.goals,
      preferredWeekdays,
      preferredStartMinute: input.preferredStartMinute,
      preferredEndMinute: input.preferredEndMinute,
      timezone,
      subjects: {
        deleteMany: {},
        create: subjects.map((name) => ({ name })),
      },
    },
    include: { subjects: { orderBy: { name: "asc" } } },
  });
}
