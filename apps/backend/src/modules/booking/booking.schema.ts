import { z } from "zod";

const availabilityIds = z
  .array(z.number().int().positive())
  .min(1)
  .max(8)
  // Repeating an id could otherwise count the same 30-minute slot twice.
  .refine((ids) => new Set(ids).size === ids.length, "Availability slots must be unique");

export const subjectIdParamsSchema = z.object({ subjectId: z.coerce.number().int().positive() });
export const bookingIdParamsSchema = z.object({ id: z.coerce.number().int().positive() });
// BOOK-1 accepts the chosen subject, slots, and an optional learning goal.
export const createBookingSchema = z.object({
  subjectId: z.number().int().positive(),
  availabilityIds,
  description: z.string().trim().max(2000).optional(),
  isTrial: z.boolean().default(true),
});
export const rescheduleBookingSchema = z.object({ availabilityIds });
// BOOK-3 allows the student to optionally record why the lesson was cancelled.
export const cancelBookingSchema = z.object({ reason: z.string().trim().max(500).optional() });

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type RescheduleBookingInput = z.infer<typeof rescheduleBookingSchema>;
export type CancelBookingInput = z.infer<typeof cancelBookingSchema>;
