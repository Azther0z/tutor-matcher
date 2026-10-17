export type SubjectOffering = {
  id: string;
  name: string;
  description: string | null;
  hourlyRate: string;
  format: "ONLINE";
  learningAreas: Array<{ id: string; name: string }>;
};

export type SubjectInput = {
  name: string;
  description: string;
  hourlyRate: string;
  format: "ONLINE";
  learningAreaIds: string[];
};

// DISC-1: each subject is tagged with one to three learning areas for search.
export const MAX_SUBJECT_LEARNING_AREAS = 3;

export function validateSubject(input: SubjectInput) {
  const errors: Partial<Record<keyof SubjectInput, string>> = {};
  if (!input.name.trim()) errors.name = "Enter a subject name.";
  else if (input.name.trim().length > 100) errors.name = "Use at most 100 characters.";
  if (!input.description.trim()) errors.description = "Enter a subject description.";
  else if (input.description.trim().length > 2000)
    errors.description = "Use at most 2000 characters.";
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(input.hourlyRate.trim()) || Number(input.hourlyRate) <= 0)
    errors.hourlyRate =
      "Enter a positive THB amount up to 99,999,999.99 with at most two decimals.";
  if (input.format !== "ONLINE") errors.format = "Only online lessons are supported.";
  if (input.learningAreaIds.length === 0)
    errors.learningAreaIds = "Choose at least one learning area.";
  else if (input.learningAreaIds.length > MAX_SUBJECT_LEARNING_AREAS)
    errors.learningAreaIds = `Choose at most ${MAX_SUBJECT_LEARNING_AREAS} learning areas.`;
  return errors;
}
