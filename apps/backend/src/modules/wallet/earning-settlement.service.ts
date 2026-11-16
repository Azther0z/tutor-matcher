import { prisma } from "../../lib/db.ts";
import { runSerializable } from "../../lib/serializable.ts";
import { appendWalletMovement, tutorShare } from "./wallet-ledger.ts";

export const LESSON_EARNING_CLEARING_HOURS = 24;
const LESSON_EARNING_CLEARING_MS = LESSON_EARNING_CLEARING_HOURS * 60 * 60_000;

export function lessonEarningClearsAt(endedAt: Date) {
  return new Date(endedAt.getTime() + LESSON_EARNING_CLEARING_MS);
}

export type LessonEarningHoldReason =
  "AWAITING_COMPLETION" | "CLEARING_PERIOD" | "REFUND_REVIEW" | "READY_TO_CLEAR";

export function lessonEarningHoldReason(
  status: string,
  endedAt: Date,
  refundStatus: string | null,
  now: Date
): LessonEarningHoldReason | null {
  if (refundStatus === "PENDING") return "REFUND_REVIEW";
  if (status !== "COMPLETED") return "AWAITING_COMPLETION";
  if (lessonEarningClearsAt(endedAt).getTime() > now.getTime()) return "CLEARING_PERIOD";
  return "READY_TO_CLEAR";
}

const retryError = () => new Error("Lesson earnings changed while clearing; retry the request");

async function settleBookingEarning(userId: string, bookingId: string, now: Date) {
  return runSerializable(
    async (tx) => {
      const booking = await tx.booking.findFirst({
        where: {
          id: bookingId,
          subject: { tutor: { user: { id: userId } } },
        },
        include: {
          walletTransactions: { where: { type: { in: ["LESSON_PAYMENT", "LESSON_EARNING"] } } },
          refundRequest: { select: { status: true } },
        },
      });
      if (!booking || booking.status !== "COMPLETED") return false;
      const payment = booking.walletTransactions.find((entry) => entry.type === "LESSON_PAYMENT");
      const earning = booking.walletTransactions.find((entry) => entry.type === "LESSON_EARNING");
      if (
        !payment ||
        earning ||
        booking.refundRequest?.status === "PENDING" ||
        lessonEarningClearsAt(booking.endedAt).getTime() > now.getTime()
      )
        return false;

      await appendWalletMovement(tx, {
        userId,
        type: "LESSON_EARNING",
        amount: tutorShare(booking.totalAmount),
        bookingId: booking.id,
      });
      return true;
    },
    { retryOnUniqueViolation: true, retryError }
  );
}

/** Move only this user's completed lesson earnings that have finished clearing. */
export async function settleTutorEarnings(userId: string, now = new Date()) {
  const tutor = await prisma.user.findUnique({ where: { id: userId }, select: { tutorId: true } });
  if (!tutor?.tutorId) return 0;

  const candidates = await prisma.booking.findMany({
    where: {
      status: "COMPLETED",
      endedAt: { lte: new Date(now.getTime() - LESSON_EARNING_CLEARING_MS) },
      subject: { tutorId: tutor.tutorId },
      walletTransactions: {
        some: { type: "LESSON_PAYMENT" },
        none: { type: "LESSON_EARNING" },
      },
    },
    select: { id: true },
    orderBy: [{ endedAt: "asc" }, { id: "asc" }],
  });

  let settled = 0;
  for (const booking of candidates) {
    if (await settleBookingEarning(userId, booking.id, now)) settled += 1;
  }
  return settled;
}
