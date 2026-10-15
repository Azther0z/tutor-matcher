import { z } from "zod";

export const dayParamsSchema = z.object({ date: z.iso.date() });
export const slotParamsSchema = dayParamsSchema.extend({
  time: z.string().regex(/^(?:[01]\d|2[0-3]):(?:00|30)$/),
});
export const calendarQuerySchema = z
  .object({ from: z.iso.date(), to: z.iso.date() })
  .refine(({ from, to }) => {
    const days = (Date.parse(to) - Date.parse(from)) / 86_400_000;
    return days >= 0 && days < 42;
  }, "Choose a calendar range of at most 42 days");
export const saveSlotSchema = z
  .object({
    revision: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable(),
    isOpen: z.boolean(),
    subjectIds: z.array(z.uuid()).max(1000),
  })
  .strict()
  .superRefine((slot, context) => {
    if (slot.isOpen && slot.subjectIds.length === 0)
      context.addIssue({ code: "custom", message: "Open slots need at least one subject" });
    if (new Set(slot.subjectIds).size !== slot.subjectIds.length)
      context.addIssue({ code: "custom", message: "Subject assignments must be unique" });
  });

export type SaveSlotInput = z.infer<typeof saveSlotSchema>;
