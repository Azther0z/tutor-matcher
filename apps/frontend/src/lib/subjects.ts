export type SubjectOffering = {
  id: string;
  name: string;
  description: string | null;
  hourlyRate: string;
  format: "ONLINE";
};

export type SubjectInput = {
  name: string;
  description: string;
  hourlyRate: string;
  format: "ONLINE";
};

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
  return errors;
}
