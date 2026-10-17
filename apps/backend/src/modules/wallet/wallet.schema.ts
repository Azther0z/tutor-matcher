import { z } from "zod";

export const confirmTopupSchema = z.object({
  amount: z.number().positive().max(100_000).multipleOf(0.01),
  reference: z.uuid(),
  simulation: z.enum(["confirmed", "failed"]),
});

export type ConfirmTopupInput = z.infer<typeof confirmTopupSchema>;
