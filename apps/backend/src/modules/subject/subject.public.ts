import type { Subject } from "../../generated/prisma/client.ts";

export const subjectSelect = {
  id: true,
  name: true,
  description: true,
  hourlyRate: true,
  format: true,
} as const;

export type SubjectSummary = Pick<Subject, keyof typeof subjectSelect>;

export function mapSubject(subject: SubjectSummary) {
  return {
    id: subject.id,
    name: subject.name,
    description: subject.description,
    hourlyRate: subject.hourlyRate.toFixed(2),
    format: subject.format,
  };
}

export function subjectSnapshot(subject: SubjectSummary) {
  return {
    subjectName: subject.name,
    subjectDescription: subject.description,
    subjectHourlyRate: subject.hourlyRate,
    subjectFormat: subject.format,
  };
}
