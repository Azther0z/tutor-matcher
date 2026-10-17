import type { Prisma, Subject } from "../../generated/prisma/client.ts";

export const subjectSelect = {
  id: true,
  name: true,
  description: true,
  hourlyRate: true,
  format: true,
  learningAreas: {
    select: { learningArea: { select: { id: true, name: true } } },
    orderBy: { learningArea: { name: "asc" } },
  },
} as const satisfies Prisma.SubjectSelect;

export type SubjectSummary = Prisma.SubjectGetPayload<{ select: typeof subjectSelect }>;

export function mapSubject(subject: SubjectSummary) {
  return {
    id: subject.id,
    name: subject.name,
    description: subject.description,
    hourlyRate: subject.hourlyRate.toFixed(2),
    format: subject.format,
    learningAreas: subject.learningAreas.map(({ learningArea }) => learningArea),
  };
}

export function subjectSnapshot(
  subject: Pick<Subject, "name" | "description" | "hourlyRate" | "format">
) {
  return {
    subjectName: subject.name,
    subjectDescription: subject.description,
    subjectHourlyRate: subject.hourlyRate,
    subjectFormat: subject.format,
  };
}
