import { Prisma, type WalletTransaction } from "../../generated/prisma/client.ts";
import { prisma } from "../../lib/db.ts";
import { isTransactionConflict } from "../../lib/transaction-conflict.ts";
import { appendWalletMovement } from "./wallet-ledger.ts";
import type { ConfirmTopupInput } from "./wallet.schema.ts";

export class WalletDomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400
  ) {
    super(message);
  }
}

function topupResponse(entry: WalletTransaction, balance: Prisma.Decimal) {
  return {
    transaction: {
      id: entry.id,
      type: entry.type,
      amount: entry.amount.toFixed(2),
      balanceAfter: entry.balanceAfter.toFixed(2),
      userId: entry.userId,
      bookingId: entry.bookingId,
      createdAt: entry.createdAt.toISOString(),
    },
    balance: balance.toFixed(2),
    simulated: true,
  };
}

export async function getWallet(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { balance: true } });
  if (!user) throw new WalletDomainError("WALLET_NOT_FOUND", "Wallet not found", 404);
  return { balance: user.balance.toFixed(2) };
}

// Explicit simulated provider: no bank transfer is asserted or accepted by this endpoint.
function confirmMockPayment(input: ConfirmTopupInput) {
  if (process.env.NODE_ENV === "production") {
    throw new WalletDomainError(
      "MOCK_PAYMENT_DISABLED",
      "Simulated payments are disabled in production",
      503
    );
  }
  if (input.simulation === "failed") {
    throw new WalletDomainError(
      "TOPUP_NOT_CONFIRMED",
      "The simulated transfer failed. Your balance was not changed.",
      402
    );
  }
}

export async function confirmTopup(userId: string, input: ConfirmTopupInput) {
  confirmMockPayment(input);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const previous = await tx.walletTransaction.findUnique({
            where: { id: input.reference },
          });
          if (previous) {
            if (
              previous.type !== "TOP_UP" ||
              previous.userId !== userId ||
              !previous.amount.equals(input.amount)
            ) {
              throw new WalletDomainError(
                "TOPUP_REFERENCE_CONFLICT",
                "Top-up reference is already in use",
                409
              );
            }
            const user = await tx.user.findUniqueOrThrow({
              where: { id: userId },
              select: { balance: true },
            });
            return topupResponse(previous, user.balance);
          }
          const entry = await appendWalletMovement(tx, {
            id: input.reference,
            userId,
            type: "TOP_UP",
            amount: input.amount,
          });
          if (!entry) throw new WalletDomainError("INVALID_AMOUNT", "Enter a positive amount");
          return topupResponse(entry, entry.balanceAfter);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (attempt < 2 && (isTransactionConflict(error) || code === "P2002")) continue;
      if (code === "P2025")
        throw new WalletDomainError("WALLET_NOT_FOUND", "Wallet not found", 404);
      throw error;
    }
  }
  throw new WalletDomainError("TOPUP_RETRY", "Please retry the top-up", 409);
}
