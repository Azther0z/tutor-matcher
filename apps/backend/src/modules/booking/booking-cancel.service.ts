import { Prisma } from "../../generated/prisma/client.ts";
import { prisma } from "../../lib/db.ts";
import { isTransactionConflict } from "../../lib/transaction-conflict.ts";
import { notifyUser } from "../notification/notification.service.ts";
import { appendWalletMovement } from "../wallet/wallet-ledger.ts";
import type { CancelBookingInput, TutorCancelBookingInput } from "./booking.schema.ts";
import {
  BookingConflictError,
  BookingDomainError,
  BookingForbiddenError,
  BookingNotFoundError,
  BookingPaymentError,
} from "./booking.errors.ts";
import { decimalString, studentQuote, tutorQuote, ZERO } from "./booking.policy.ts";
import { releaseExpiredBookings } from "./booking.expiry.ts";
import { waitForBookingNotifications } from "./booking.notifications.ts";
import { detailInclude, mapBookingResponse, type BookingDetailRecord } from "./booking.view.ts";

async function loadDetail(id: string) {
  return prisma.booking.findUnique({ where: { id }, include: detailInclude });
}

export async function getCancellationQuote(userId: string, id: string) {
  const now = new Date();
  await releaseExpiredBookings(now, { id });
  const booking = await loadDetail(id);
  if (!booking) throw new BookingNotFoundError();
  if (booking.userId !== userId) throw new BookingForbiddenError("You cannot cancel this booking");
  if (
    !["PENDING_PAYMENT", "CONFIRMED"].includes(booking.status) ||
    booking.startedAt.getTime() <= now.getTime()
  )
    throw new BookingConflictError("BOOKING_NOT_CANCELLABLE", "Booking cannot be cancelled");
  if (
    booking.status === "CONFIRMED" &&
    booking.totalAmount.gt(0) &&
    !booking.walletTransactions.some((movement) => movement.type === "LESSON_PAYMENT")
  )
    throw new BookingPaymentError("PAYMENT_NOT_FOUND", "Confirmed lesson payment not found");
  return studentQuote(booking, now);
}

export async function cancelBooking(userId: string, id: string, input: CancelBookingInput) {
  const now = new Date();
  await releaseExpiredBookings(now, { id });
  try {
    return await prisma.$transaction(
      async (tx) => {
        const booking = await tx.booking.findUnique({ where: { id }, include: detailInclude });
        const transactionNow = new Date();
        if (!booking) throw new BookingNotFoundError();
        if (booking.userId !== userId)
          throw new BookingForbiddenError("You cannot cancel this booking");
        if (
          !["PENDING_PAYMENT", "CONFIRMED"].includes(booking.status) ||
          booking.startedAt.getTime() <= transactionNow.getTime()
        )
          throw new BookingConflictError("BOOKING_NOT_CANCELLABLE", "Booking cannot be cancelled");

        const quote = studentQuote(booking, transactionNow);
        const transfer = booking.walletTransactions.find(
          (payment) => payment.type === "LESSON_PAYMENT"
        );
        if (booking.status === "CONFIRMED" && !booking.totalAmount.isZero() && !transfer)
          throw new BookingPaymentError("PAYMENT_NOT_FOUND", "Confirmed lesson payment not found");
        if (transfer && input.quoteToken !== quote.token)
          throw new BookingConflictError(
            "CANCELLATION_QUOTE_CHANGED",
            "The cancellation amount changed. Review the latest quote before confirming.",
            { currentQuote: quote }
          );

        const claimed = await tx.booking.updateMany({
          where: {
            id,
            status: { in: ["PENDING_PAYMENT", "CONFIRMED"] },
            startedAt: { gt: transactionNow },
          },
          data: {
            status: "CANCELLED",
            cancelledAt: transactionNow,
            cancellationReason: input.reason,
            cancelledBy: "STUDENT",
            paymentExpiresAt: null,
          },
        });
        if (claimed.count !== 1)
          throw new BookingConflictError("BOOKING_NOT_CANCELLABLE", "Booking cannot be cancelled");

        let refund = ZERO;
        if (transfer) {
          refund = new Prisma.Decimal(quote.refundAmount);
          await appendWalletMovement(tx, {
            userId,
            type: "REFUND",
            amount: refund,
            bookingId: id,
          });
        }
        await tx.availability.updateMany({
          where: { bookingId: id },
          data: { bookingId: null },
        });
        const detailed = await tx.booking.findUniqueOrThrow({
          where: { id },
          include: detailInclude,
        });
        return {
          booking: mapBookingResponse(detailed, userId, transactionNow),
          refund: {
            amount: decimalString(refund),
            lateCancellation: quote.lateCancellation,
            rate: quote.refundRate,
            cancellationFee: quote.cancellationFee,
          },
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (error) {
    if (error instanceof BookingDomainError || !isTransactionConflict(error)) throw error;
    throw new BookingConflictError("BOOKING_NOT_CANCELLABLE", "Booking was already cancelled");
  }
}

export async function listTutorUpcomingBookings(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { tutorId: true } });
  if (!user?.tutorId)
    throw new BookingForbiddenError("Only approved Tutors can view their classes");
  const now = new Date();
  await releaseExpiredBookings(now, { tutorId: user.tutorId });
  const bookings = await prisma.booking.findMany({
    where: {
      subject: { tutorId: user.tutorId },
      status: { in: ["PENDING_PAYMENT", "CONFIRMED"] },
      startedAt: { gt: now },
    },
    include: detailInclude,
    orderBy: [{ startedAt: "asc" }, { id: "asc" }],
  });
  return bookings.map((booking) => mapBookingResponse(booking, userId, now));
}

function assertTutorOwnsBooking(booking: BookingDetailRecord, userId: string) {
  if (booking.subject.tutor.user?.id !== userId)
    throw new BookingForbiddenError("You cannot cancel this booking");
}

export async function getTutorCancellationQuote(userId: string, id: string) {
  const now = new Date();
  await releaseExpiredBookings(now, { id });
  const booking = await loadDetail(id);
  if (!booking) throw new BookingNotFoundError();
  assertTutorOwnsBooking(booking, userId);
  if (
    !["PENDING_PAYMENT", "CONFIRMED"].includes(booking.status) ||
    booking.startedAt.getTime() <= now.getTime()
  )
    throw new BookingConflictError("BOOKING_NOT_CANCELLABLE", "Booking cannot be cancelled");
  if (
    booking.status === "CONFIRMED" &&
    booking.totalAmount.gt(0) &&
    !booking.walletTransactions.some((movement) => movement.type === "LESSON_PAYMENT")
  )
    throw new BookingPaymentError("PAYMENT_NOT_FOUND", "Confirmed lesson payment not found");
  return tutorQuote(booking, now);
}

export async function cancelBookingAsTutor(
  userId: string,
  id: string,
  input: TutorCancelBookingInput
) {
  const now = new Date();
  await releaseExpiredBookings(now, { id });
  let cancelled;
  try {
    cancelled = await prisma.$transaction(
      async (tx) => {
        const booking = await tx.booking.findUnique({ where: { id }, include: detailInclude });
        const transactionNow = new Date();
        if (!booking) throw new BookingNotFoundError();
        assertTutorOwnsBooking(booking, userId);
        if (
          !["PENDING_PAYMENT", "CONFIRMED"].includes(booking.status) ||
          booking.startedAt.getTime() <= transactionNow.getTime()
        )
          throw new BookingConflictError("BOOKING_NOT_CANCELLABLE", "Booking cannot be cancelled");

        const quote = tutorQuote(booking, transactionNow);
        const transfer = booking.walletTransactions.find(
          (payment) => payment.type === "LESSON_PAYMENT"
        );
        if (booking.status === "CONFIRMED" && !booking.totalAmount.isZero() && !transfer)
          throw new BookingPaymentError("PAYMENT_NOT_FOUND", "Confirmed lesson payment not found");
        if (transfer && input.quoteToken !== quote.token)
          throw new BookingConflictError(
            "CANCELLATION_QUOTE_CHANGED",
            "The cancellation terms changed. Review the latest terms before confirming.",
            { currentQuote: quote }
          );

        const claimed = await tx.booking.updateMany({
          where: {
            id,
            status: { in: ["PENDING_PAYMENT", "CONFIRMED"] },
            startedAt: { gt: transactionNow },
          },
          data: {
            status: "CANCELLED",
            cancelledAt: transactionNow,
            cancellationReason: input.reason,
            cancelledBy: "TUTOR",
            paymentExpiresAt: null,
          },
        });
        if (claimed.count !== 1)
          throw new BookingConflictError("BOOKING_NOT_CANCELLABLE", "Booking cannot be cancelled");

        let refund = ZERO;
        if (transfer) {
          refund = new Prisma.Decimal(quote.refundAmount);
          await appendWalletMovement(tx, {
            userId: booking.userId,
            type: "REFUND",
            amount: refund,
            bookingId: id,
          });
        }
        await tx.availability.updateMany({
          where: { bookingId: id },
          data: { bookingId: null, isOpen: false },
        });
        const detailed = await tx.booking.findUniqueOrThrow({
          where: { id },
          include: detailInclude,
        });
        return {
          response: {
            booking: mapBookingResponse(detailed, userId, transactionNow),
            refund: {
              amount: decimalString(refund),
              lateCancellation: quote.lateCancellation,
              rate: quote.refundRate,
              cancellationFee: quote.cancellationFee,
            },
          },
          studentId: detailed.user.id,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (error) {
    if (error instanceof BookingDomainError || !isTransactionConflict(error)) throw error;
    throw new BookingConflictError("BOOKING_NOT_CANCELLABLE", "Booking was already cancelled");
  }
  await waitForBookingNotifications([
    notifyUser(cancelled.studentId, {
      eventType: "booking",
      details: {
        subjectName: cancelled.response.booking.subject.name,
        scheduledAt: new Date(cancelled.response.booking.startedAt),
      },
    }),
  ]);
  return cancelled.response;
}
