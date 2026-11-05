import { z } from "zod";

export const confirmTopupSchema = z.object({
  amount: z.number().positive().max(100_000).multipleOf(0.01),
  reference: z.uuid(),
  simulation: z.enum(["confirmed", "failed"]),
});

export type ConfirmTopupInput = z.infer<typeof confirmTopupSchema>;

export const walletTransactionTypes = [
  "TOP_UP",
  "LESSON_PAYMENT",
  "LESSON_EARNING",
  "REFUND",
  "PAYOUT",
] as const;

export const walletTransactionsQuerySchema = z.object({
  type: z.enum(walletTransactionTypes).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});

export const walletTransactionParamsSchema = z.object({ id: z.uuid() });

export type WalletTransactionsQuery = z.infer<typeof walletTransactionsQuerySchema>;
