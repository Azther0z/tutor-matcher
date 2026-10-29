import { createHash } from "node:crypto";
import { Prisma } from "../../generated/prisma/client.ts";
import { BookingConflictError } from "./booking.errors.ts";

export const SLOT_MS = 30 * 60_000;
const BANGKOK_TIME_ZONE = "Asia/Bangkok";
export const ZERO = new Prisma.Decimal(0);

function positiveSetting(name: string, fallback: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function rateSetting(name: string, fallback: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : fallback;
}

export const CANCELLATION_POLICY_WINDOW_HOURS = positiveSetting(
  "BOOKING_CANCELLATION_WINDOW_HOURS",
  24
);
export const LATE_CANCELLATION_REFUND_RATE = rateSetting("BOOKING_LATE_REFUND_RATE", 0.7);
export const PAYMENT_HOLD_MINUTES = positiveSetting("BOOKING_PAYMENT_HOLD_MINUTES", 15);

export function decimalString(value: Prisma.Decimal) {
  return value.toDecimalPlaces(2).toFixed(2);
}

const bangkokDateFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: BANGKOK_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function bangkokCalendarDay(value: Date) {
  const parts = bangkokDateFormat.formatToParts(value);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}

export function assertSlotBlock(slots: Array<{ startedAt: Date }>, subjectId: string) {
  if (slots.length === 0)
    throw new BookingConflictError("INVALID_SLOT_BLOCK", "Select at least one slot", {
      subjectId,
    });
  const day = bangkokCalendarDay(slots[0]!.startedAt);
  for (let index = 0; index < slots.length; index++) {
    if (bangkokCalendarDay(slots[index]!.startedAt) !== day)
      throw new BookingConflictError(
        "INVALID_SLOT_BLOCK",
        "Selected slots must be on the same day",
        { subjectId }
      );
    if (
      index > 0 &&
      slots[index]!.startedAt.getTime() - slots[index - 1]!.startedAt.getTime() !== SLOT_MS
    )
      throw new BookingConflictError("INVALID_SLOT_BLOCK", "Selected slots must be consecutive", {
        subjectId,
      });
  }
}

export function cancellationRefund(amount: Prisma.Decimal, startsAt: Date, now = new Date()) {
  const policyMs = CANCELLATION_POLICY_WINDOW_HOURS * 60 * 60_000;
  const late = startsAt.getTime() - now.getTime() <= policyMs;
  const rate = late ? LATE_CANCELLATION_REFUND_RATE : 1;
  return { late, rate, amount: amount.mul(rate).toDecimalPlaces(2) };
}

type QuoteSource = {
  id: string;
  status: string;
  totalAmount: Prisma.Decimal;
  startedAt: Date;
  walletTransactions: Array<{ id: string; type: string; amount: Prisma.Decimal }>;
};

export function studentQuote(booking: QuoteSource, now: Date) {
  const transfer = booking.walletTransactions.find((payment) => payment.type === "LESSON_PAYMENT");
  const originalAmount = transfer?.amount ?? ZERO;
  const late =
    booking.startedAt.getTime() - now.getTime() <= CANCELLATION_POLICY_WINDOW_HOURS * 60 * 60_000;
  const policy = transfer
    ? cancellationRefund(transfer.amount, booking.startedAt, now)
    : { late, rate: 0, amount: ZERO };
  const fee = originalAmount.minus(policy.amount).toDecimalPlaces(2);
  const token = createHash("sha256")
    .update(
      [
        booking.id,
        booking.status,
        booking.startedAt.toISOString(),
        transfer?.id ?? "unpaid",
        decimalString(originalAmount),
        decimalString(policy.amount),
        String(policy.rate),
        String(policy.late),
      ].join("|")
    )
    .digest("hex");
  return {
    token,
    generatedAt: now.toISOString(),
    bookingId: booking.id,
    lateCancellation: policy.late,
    policyWindowHours: CANCELLATION_POLICY_WINDOW_HOURS,
    refundRate: policy.rate,
    originalAmount: decimalString(originalAmount),
    refundAmount: decimalString(policy.amount),
    cancellationFee: decimalString(fee),
  };
}

export function tutorQuote(booking: QuoteSource, now: Date) {
  const transfer = booking.walletTransactions.find((payment) => payment.type === "LESSON_PAYMENT");
  const originalAmount = transfer?.amount ?? ZERO;
  const late =
    booking.startedAt.getTime() - now.getTime() <= CANCELLATION_POLICY_WINDOW_HOURS * 60 * 60_000;
  const token = createHash("sha256")
    .update(
      [
        "TUTOR",
        booking.id,
        booking.status,
        booking.startedAt.toISOString(),
        transfer?.id ?? "unpaid",
        decimalString(originalAmount),
        String(late),
      ].join("|")
    )
    .digest("hex");
  return {
    token,
    generatedAt: now.toISOString(),
    bookingId: booking.id,
    lateCancellation: late,
    policyWindowHours: CANCELLATION_POLICY_WINDOW_HOURS,
    refundRate: transfer ? 1 : 0,
    originalAmount: decimalString(originalAmount),
    refundAmount: decimalString(originalAmount),
    cancellationFee: decimalString(ZERO),
  };
}
