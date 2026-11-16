import { Prisma } from "../../generated/prisma/client.ts";
import { prisma } from "../../lib/db.ts";
import { isTransactionConflict } from "../../lib/transaction-conflict.ts";
import {
  BookingConflictError,
  BookingDomainError,
  BookingForbiddenError,
  BookingNotFoundError,
} from "./booking.errors.ts";
import { detailInclude, mapBookingResponse, type BookingDetailRecord } from "./booking.view.ts";

// CLASS-2 lists ended, paid lessons that still need the assigned Tutor's confirmation.
export async function listTutorBookingsNeedingConfirmation(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { tutorId: true } });
  if (!user?.tutorId)
    throw new BookingForbiddenError("Only approved Tutors can view lessons needing confirmation");
  const now = new Date();
  const bookings = await prisma.booking.findMany({
    where: {
      subject: { tutorId: user.tutorId },
      status: "CONFIRMED",
      endedAt: { lte: now },
    },
    include: detailInclude,
    orderBy: [{ endedAt: "asc" }, { id: "asc" }],
  });
  return bookings.map((booking) => mapBookingResponse(booking, userId, now));
}

// Completion unlocks review eligibility; earnings remain calculated pending amounts until PAY-6.
export async function confirmBookingCompletionAsTutor(userId: string, id: string) {
  let completed: BookingDetailRecord | null;
  try {
    completed = await prisma.$transaction(
      async (tx) => {
        const booking = await tx.booking.findUnique({ where: { id }, include: detailInclude });
        const now = new Date();
        if (!booking) throw new BookingNotFoundError();
        if (booking.subject.tutor.user?.id !== userId)
          throw new BookingForbiddenError("Only the assigned Tutor can confirm this lesson");
        if (booking.status === "COMPLETED")
          throw new BookingConflictError(
            "BOOKING_ALREADY_COMPLETED",
            "This lesson has already been completed"
          );
        if (booking.status === "CANCELLED")
          throw new BookingConflictError("BOOKING_CANCELLED", "This booking was cancelled");
        if (booking.status !== "CONFIRMED" || booking.endedAt.getTime() > now.getTime())
          throw new BookingConflictError(
            "BOOKING_NOT_COMPLETABLE",
            "This lesson is not ready for completion confirmation"
          );
        if (booking.refundRequest?.status === "PENDING")
          throw new BookingConflictError(
            "BOOKING_NOT_COMPLETABLE",
            "The Student asked for a refund for this lesson. You can confirm it if an admin rejects the request."
          );

        const updated = await tx.booking.updateMany({
          where: { id, status: "CONFIRMED", endedAt: { lte: now } },
          data: { status: "COMPLETED" },
        });
        if (updated.count !== 1)
          throw new BookingConflictError(
            "BOOKING_NOT_COMPLETABLE",
            "This lesson was already changed and can no longer be confirmed"
          );

        return tx.booking.findUnique({ where: { id }, include: detailInclude });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (error) {
    if (error instanceof BookingDomainError || !isTransactionConflict(error)) throw error;
    throw new BookingConflictError(
      "BOOKING_NOT_COMPLETABLE",
      "This lesson was already changed and can no longer be confirmed"
    );
  }

  if (!completed) throw new BookingNotFoundError();
  return mapBookingResponse(completed, userId);
}
