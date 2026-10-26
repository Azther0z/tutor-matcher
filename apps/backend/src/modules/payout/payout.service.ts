import {
  Prisma,
  type PayoutAccount,
  type WalletTransaction,
} from "../../generated/prisma/client.ts";
import { prisma } from "../../lib/db.ts";
import { isTransactionConflict } from "../../lib/transaction-conflict.ts";
import { appendWalletMovement, InsufficientWalletBalance } from "../wallet/wallet-ledger.ts";
import { payoutAccountResponse } from "./payout-account.service.ts";
import type { RequestPayoutInput } from "./payout.schema.ts";

export class PayoutDomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400
  ) {
    super(message);
  }
}

function payoutResponse(entry: WalletTransaction, account: PayoutAccount, balance: Prisma.Decimal) {
  return {
    transaction: {
      id: entry.id,
      type: entry.type,
      amount: entry.amount.toFixed(2),
      balanceAfter: entry.balanceAfter.toFixed(2),
      createdAt: entry.createdAt.toISOString(),
      payoutAccount: payoutAccountResponse(account),
    },
    balance: balance.toFixed(2),
    simulated: true,
  };
}

// Simulated payout: no bank transfer is sent. Off in production, like the simulated top-up.
function assertSimulatedPayoutEnabled() {
  if (process.env.NODE_ENV === "production") {
    throw new PayoutDomainError(
      "MOCK_PAYMENT_DISABLED",
      "Simulated payouts are disabled in production",
      503
    );
  }
}

export async function requestPayout(userId: string, input: RequestPayoutInput) {
  assertSimulatedPayoutEnabled();
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const user = await tx.user.findUnique({
            where: { id: userId },
            select: { tutorId: true },
          });
          if (!user?.tutorId) {
            throw new PayoutDomainError(
              "PAYOUT_TUTOR_ONLY",
              "Only Tutors can request a payout",
              403
            );
          }
          const previous = await tx.walletTransaction.findUnique({
            where: { id: input.reference },
            include: { payoutAccount: true },
          });
          if (previous) {
            if (
              previous.type !== "PAYOUT" ||
              previous.userId !== userId ||
              previous.payoutAccountId !== input.payoutAccountId ||
              !previous.amount.equals(input.amount) ||
              !previous.payoutAccount
            ) {
              throw new PayoutDomainError(
                "PAYOUT_REFERENCE_CONFLICT",
                "Payout reference is already in use",
                409
              );
            }
            const user = await tx.user.findUniqueOrThrow({
              where: { id: userId },
              select: { balance: true },
            });
            return payoutResponse(previous, previous.payoutAccount, user.balance);
          }
          const account = await tx.payoutAccount.findFirst({
            where: { id: input.payoutAccountId, userId, removedAt: null },
          });
          if (!account) {
            throw new PayoutDomainError(
              "PAYOUT_ACCOUNT_NOT_FOUND",
              "Payout account not found",
              404
            );
          }
          const entry = await appendWalletMovement(tx, {
            id: input.reference,
            userId,
            type: "PAYOUT",
            amount: input.amount,
            payoutAccountId: account.id,
          });
          if (!entry) throw new PayoutDomainError("INVALID_AMOUNT", "Enter a positive amount");
          return payoutResponse(entry, account, entry.balanceAfter);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } catch (error) {
      if (error instanceof InsufficientWalletBalance) {
        throw new PayoutDomainError(
          "INSUFFICIENT_BALANCE",
          "The amount is more than your available balance",
          409
        );
      }
      const code = (error as { code?: string }).code;
      if (attempt < 2 && (isTransactionConflict(error) || code === "P2002")) continue;
      if (code === "P2025")
        throw new PayoutDomainError("WALLET_NOT_FOUND", "Wallet not found", 404);
      throw error;
    }
  }
  throw new PayoutDomainError("PAYOUT_RETRY", "Please retry the payout", 409);
}
