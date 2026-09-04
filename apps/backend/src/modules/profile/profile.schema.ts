import { z } from "zod";

const timezoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .refine((timezone) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
      return true;
    } catch {
      return false;
    }
  }, "Timezone must be a valid IANA timezone");

export const studentProfileRequestSchema = z
  .object({
    subjects: z.array(z.string().trim().min(1).max(100)).min(1).max(20),
    level: z.string().trim().min(1).max(100),
    goals: z.string().trim().min(1).max(1000),
    preferredWeekdays: z.array(z.number().int().min(1).max(7)).max(7).optional(),
    preferredStartMinute: z.number().int().min(0).max(1439).optional(),
    preferredEndMinute: z.number().int().min(0).max(1439).optional(),
    timezone: timezoneSchema.optional(),
  })
  .superRefine((input, context) => {
    const normalizedSubjects = input.subjects.map((subject) => subject.trim().toLocaleLowerCase());
    if (new Set(normalizedSubjects).size !== normalizedSubjects.length) {
      context.addIssue({
        code: "custom",
        message: "Subjects must not contain duplicates",
        path: ["subjects"],
      });
    }

    const hasStart = input.preferredStartMinute !== undefined;
    const hasEnd = input.preferredEndMinute !== undefined;

    if (hasStart !== hasEnd) {
      context.addIssue({
        code: "custom",
        message: "Preferred start and end times must be provided together",
        path: [hasStart ? "preferredEndMinute" : "preferredStartMinute"],
      });
    } else if (hasStart && hasEnd && input.preferredStartMinute! >= input.preferredEndMinute!) {
      context.addIssue({
        code: "custom",
        message: "Preferred end time must be after the start time",
        path: ["preferredEndMinute"],
      });
    }

    const preferredWeekdays = input.preferredWeekdays ?? [];
    if (new Set(preferredWeekdays).size !== preferredWeekdays.length) {
      context.addIssue({
        code: "custom",
        message: "Preferred weekdays must not contain duplicates",
        path: ["preferredWeekdays"],
      });
    }
  });

export type StudentProfileInput = z.infer<typeof studentProfileRequestSchema>;
