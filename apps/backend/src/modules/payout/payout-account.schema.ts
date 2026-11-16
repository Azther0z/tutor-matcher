import { z } from "zod";
import { payoutBankCodes } from "./payout-banks.ts";

export const payoutAccountParamsSchema = z.object({ id: z.uuid() });
// PROF-7 saves Thai bank accounts only; spaces and dashes in the number are ignored.
export const createPayoutAccountSchema = z.object({
  bankCode: z.enum(payoutBankCodes),
  accountHolderName: z.string().trim().min(1).max(100),
  accountNumber: z
    .string()
    .max(40)
    .transform((value) => value.replace(/[\s-]/g, ""))
    .pipe(z.string().regex(/^\d{10,15}$/)),
  makeDefault: z.boolean().optional(),
});

export type CreatePayoutAccountInput = z.infer<typeof createPayoutAccountSchema>;
