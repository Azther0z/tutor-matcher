import { Prisma } from "../../generated/prisma/client.ts";
import { prisma } from "../../lib/db.ts";
import { payoutAccountResponse } from "../payout/payout-account.service.ts";
import { walletTransactionSigns } from "./wallet-ledger.ts";
import type { WalletTransactionsQuery } from "./wallet.schema.ts";

export class WalletDomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400
  ) {
    super(message);
  }
}

export async function getWallet(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { balance: true } });
  if (!user) throw new WalletDomainError("WALLET_NOT_FOUND", "Wallet not found", 404);
  return { balance: user.balance.toFixed(2) };
}

// PAY-5: provisional platform fee; pending earnings are a calculation, never a ledger row.
export const PLATFORM_FEE_RATE = new Prisma.Decimal("0.15");
export const WALLET_TRANSACTIONS_PAGE_SIZE = 20;
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

// Asia/Bangkok has no daylight saving, so its calendar month is a fixed UTC+7 window.
export function bangkokMonthWindow(now: Date) {
  const local = new Date(now.getTime() + BANGKOK_OFFSET_MS);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth();
  return {
    start: new Date(Date.UTC(year, month, 1) - BANGKOK_OFFSET_MS),
    end: new Date(Date.UTC(year, month + 1, 1) - BANGKOK_OFFSET_MS),
  };
}

export function tutorShare(totalAmount: Prisma.Decimal) {
  return totalAmount.minus(totalAmount.times(PLATFORM_FEE_RATE).toDecimalPlaces(2));
}

const transactionInclude = {
  booking: {
    select: {
      id: true,
      status: true,
      startedAt: true,
      endedAt: true,
      subjectName: true,
      subject: { select: { name: true } },
    },
  },
  payoutAccount: true,
} satisfies Prisma.WalletTransactionInclude;

type WalletTransactionWithLinks = Prisma.WalletTransactionGetPayload<{
  include: typeof transactionInclude;
}>;

// Every ledger row is a completed movement; direction follows the type's sign.
function transactionResponse(entry: WalletTransactionWithLinks) {
  return {
    id: entry.id,
    type: entry.type,
    direction: walletTransactionSigns[entry.type] === 1 ? ("IN" as const) : ("OUT" as const),
    status: "COMPLETED" as const,
    amount: entry.amount.toFixed(2),
    balanceAfter: entry.balanceAfter.toFixed(2),
    createdAt: entry.createdAt.toISOString(),
    booking: entry.booking && {
      id: entry.booking.id,
      status: entry.booking.status,
      subjectName: entry.booking.subjectName ?? entry.booking.subject.name,
      startedAt: entry.booking.startedAt.toISOString(),
      endedAt: entry.booking.endedAt.toISOString(),
    },
    payoutAccount: entry.payoutAccount && payoutAccountResponse(entry.payoutAccount),
  };
}

export async function getWalletOverview(userId: string, now = new Date()) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { balance: true, tutorId: true },
  });
  if (!user) throw new WalletDomainError("WALLET_NOT_FOUND", "Wallet not found", 404);
  const month = bangkokMonthWindow(now);
  // Earnings and payouts are Tutor-only movements, so Students get null instead of zeros.
  const tutorId = user.tutorId;
  const [earnedThisMonth, paidOut, tutorBookings, paymentDue] = await Promise.all([
    tutorId
      ? prisma.walletTransaction.aggregate({
          where: {
            userId,
            type: "LESSON_EARNING",
            createdAt: { gte: month.start, lt: month.end },
          },
          _sum: { amount: true },
        })
      : null,
    tutorId
      ? prisma.walletTransaction.aggregate({
          where: { userId, type: "PAYOUT" },
          _sum: { amount: true },
        })
      : null,
    tutorId
      ? prisma.booking.findMany({
          where: { status: "CONFIRMED", subject: { tutorId } },
          select: { totalAmount: true },
        })
      : null,
    prisma.booking.findMany({
      where: {
        userId,
        status: "PENDING_PAYMENT",
        OR: [{ paymentExpiresAt: null }, { paymentExpiresAt: { gt: now } }],
      },
      select: {
        id: true,
        totalAmount: true,
        startedAt: true,
        paymentExpiresAt: true,
        subjectName: true,
        subject: { select: { name: true } },
      },
      orderBy: { startedAt: "asc" },
      take: 10,
    }),
  ]);
  const zero = new Prisma.Decimal(0);
  return {
    balance: user.balance.toFixed(2),
    isTutor: Boolean(tutorId),
    pendingEarnings:
      tutorBookings &&
      tutorBookings
        .reduce((sum, booking) => sum.plus(tutorShare(booking.totalAmount)), zero)
        .toFixed(2),
    earningsThisMonth: earnedThisMonth && (earnedThisMonth._sum.amount ?? zero).toFixed(2),
    totalPaidOut: paidOut && (paidOut._sum.amount ?? zero).toFixed(2),
    paymentDue: paymentDue.map((booking) => ({
      bookingId: booking.id,
      subjectName: booking.subjectName ?? booking.subject.name,
      amount: booking.totalAmount.toFixed(2),
      startedAt: booking.startedAt.toISOString(),
      paymentExpiresAt: booking.paymentExpiresAt?.toISOString() ?? null,
    })),
  };
}

export async function listWalletTransactions(userId: string, query: WalletTransactionsQuery) {
  const where = { userId, ...(query.type ? { type: query.type } : {}) };
  const [entries, total] = await Promise.all([
    prisma.walletTransaction.findMany({
      where,
      include: transactionInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (query.page - 1) * WALLET_TRANSACTIONS_PAGE_SIZE,
      take: WALLET_TRANSACTIONS_PAGE_SIZE,
    }),
    prisma.walletTransaction.count({ where }),
  ]);
  return {
    transactions: entries.map(transactionResponse),
    page: query.page,
    pageSize: WALLET_TRANSACTIONS_PAGE_SIZE,
    total,
  };
}

// Owner-only: another user's transaction is indistinguishable from a missing one.
export async function getWalletTransaction(userId: string, id: string) {
  const entry = await prisma.walletTransaction.findFirst({
    where: { id, userId },
    include: transactionInclude,
  });
  if (!entry) throw new WalletDomainError("TRANSACTION_NOT_FOUND", "Transaction not found", 404);
  return transactionResponse(entry);
}
