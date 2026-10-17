import { Prisma, type WalletTransactionType } from "../../generated/prisma/client.ts";

export class InsufficientWalletBalance extends Error {
  constructor(
    public readonly balance: Prisma.Decimal,
    public readonly amount: Prisma.Decimal
  ) {
    super("Insufficient balance");
  }
}

const signs: Record<WalletTransactionType, 1 | -1> = {
  TOP_UP: 1,
  LESSON_EARNING: 1,
  REFUND: 1,
  LESSON_PAYMENT: -1,
  PAYOUT: -1,
};

// The caller must supply a serializable transaction covering the business state change too.
// This is the only runtime writer of User.balance. Ledger entries are append-only.
export async function appendWalletMovement(
  tx: Prisma.TransactionClient,
  input: {
    id?: string;
    userId: string;
    type: WalletTransactionType;
    amount: Prisma.Decimal | string | number;
    bookingId?: string;
  }
) {
  const amount = new Prisma.Decimal(input.amount);
  if (!amount.isFinite() || amount.isNegative() || amount.decimalPlaces() > 2) {
    throw new Error("Wallet amounts must be non-negative finite values with at most two decimals");
  }
  if (amount.isZero()) return null;
  const debit = signs[input.type] === -1;
  const updated = await tx.user.updateMany({
    where: { id: input.userId, ...(debit ? { balance: { gte: amount } } : {}) },
    data: { balance: debit ? { decrement: amount } : { increment: amount } },
  });
  const user = await tx.user.findUniqueOrThrow({
    where: { id: input.userId },
    select: { balance: true },
  });
  if (updated.count !== 1) throw new InsufficientWalletBalance(user.balance, amount);
  return tx.walletTransaction.create({
    data: { ...input, amount, balanceAfter: user.balance },
  });
}
