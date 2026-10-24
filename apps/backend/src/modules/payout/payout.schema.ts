import { z } from "zod";

export const requestPayoutSchema = z.object({
  amount: z.number().positive().max(100_000).multipleOf(0.01),
  payoutAccountId: z.uuid(),
  reference: z.uuid(),
});

export type RequestPayoutInput = z.infer<typeof requestPayoutSchema>;
