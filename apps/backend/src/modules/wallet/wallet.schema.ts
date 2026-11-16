import { z } from "zod";
import { httpUrl } from "../profile/profile.schema.ts";

export const createTopupSchema = z.object({
  amount: z.number().positive().max(100_000).multipleOf(0.01),
  slipUrl: httpUrl.max(2000),
});

export const topupIdParamsSchema = z.object({ id: z.uuid() });

export const topupReviewSchema = z
  .object({
    decision: z.enum(["APPROVED", "REJECTED"]),
    rejectionReason: z.string().trim().max(500).optional(),
  })
  .refine((input) => input.decision !== "REJECTED" || !!input.rejectionReason, {
    message: "A rejection reason is required",
    path: ["rejectionReason"],
  });

export const topupListQuerySchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
});

export type CreateTopupInput = z.infer<typeof createTopupSchema>;
export type TopupReviewInput = z.infer<typeof topupReviewSchema>;

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
