import { Prisma } from "../../generated/prisma/client.ts";
import { prisma } from "../../lib/db.ts";
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

function money(value: Prisma.Decimal | string | number) {
  return new Prisma.Decimal(value).toFixed(2);
}

function topupResponse(
  payment: {
    id: string;
    amount: Prisma.Decimal;
    status: string;
    createdAt: Date;
    completedAt: Date | null;
  },
  balance: Prisma.Decimal
) {
  return {
    transaction: {
      id: payment.id,
      type: "TOPUP" as const,
      method: "PROMPTPAY" as const,
      amount: money(payment.amount),
      status: payment.status,
      createdAt: payment.createdAt.toISOString(),
      completedAt: payment.completedAt?.toISOString() ?? null,
    },
    balance: money(balance),
  };
}

async function existingTopup(userId: string, reference: string) {
  const payment = await prisma.payment.findUnique({ where: { id: reference } });
  if (!payment) return null;
  if (
    payment.type !== "TRANSFER" ||
    payment.fromUserId !== null ||
    payment.toUserId !== userId ||
    payment.status !== "COMPLETED"
  ) {
    throw new WalletDomainError(
      "TOPUP_REFERENCE_CONFLICT",
      "Top-up reference is already in use",
      409
    );
  }
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { balance: true } });
  if (!user) throw new WalletDomainError("WALLET_NOT_FOUND", "Wallet not found", 404);
  return topupResponse(payment, user.balance);
}

export async function getWallet(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { balance: true },
  });
  if (!user) throw new WalletDomainError("WALLET_NOT_FOUND", "Wallet not found", 404);
  return { balance: money(user.balance) };
}

export async function confirmTopup(userId: string, input: ConfirmTopupInput) {
  const previous = await existingTopup(userId, input.reference);
  if (previous) {
    if (previous.transaction.amount !== money(input.amount)) {
      throw new WalletDomainError(
        "TOPUP_REFERENCE_CONFLICT",
        "Top-up reference was confirmed for a different amount",
        409
      );
    }
    return previous;
  }

  const completedAt = new Date();
  try {
    return await prisma.$transaction(
      async (tx) => {
        const user = await tx.user.update({
          where: { id: userId },
          data: { balance: { increment: input.amount } },
          select: { balance: true },
        });
        const payment = await tx.payment.create({
          data: {
            id: input.reference,
            type: "TRANSFER",
            amount: input.amount,
            status: "COMPLETED",
            completedAt,
            fromUserId: null,
            toUserId: userId,
          },
        });
        return topupResponse(payment, user.balance);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "P2002") {
      const racedTopup = await existingTopup(userId, input.reference);
      if (racedTopup && racedTopup.transaction.amount === money(input.amount)) return racedTopup;
    }
    if (code === "P2025") {
      throw new WalletDomainError("WALLET_NOT_FOUND", "Wallet not found", 404);
    }
    throw error;
  }
}
