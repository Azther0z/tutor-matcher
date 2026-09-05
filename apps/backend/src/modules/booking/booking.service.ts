import { Prisma } from "../../generated/prisma/client.ts";
import { prisma } from "../../lib/db.ts";
import type {
  CancelBookingInput,
  CreateBookingInput,
  RescheduleBookingInput,
} from "./booking.schema.ts";

const SLOT_MS = 30 * 60_000;
export const LATE_CANCELLATION_REFUND_RATE = 0.7;

// BOOK-3: Calculate whether the late-cancellation rule applies and how much to return.
export function cancellationRefund(amount: Prisma.Decimal, startsAt: Date, now = new Date()) {
  const late = startsAt.getTime() - now.getTime() <= 24 * 60 * 60_000;
  return { late, amount: late ? amount.mul(LATE_CANCELLATION_REFUND_RATE) : amount };
}
export class BookingNotFoundError extends Error {
  code = "BOOKING_NOT_FOUND";
}
export class BookingForbiddenError extends Error {
  code = "BOOKING_FORBIDDEN";
}
export class BookingConflictError extends Error {
  code = "BOOKING_CONFLICT";
  constructor(
    message: string,
    public subjectId: number
  ) {
    super(message);
  }
}
export class BookingPaymentError extends Error {
  code = "PAYMENT_FAILED";
}

const detailInclude = {
  user: { select: { id: true, firstName: true, lastName: true, email: true } },
  subject: {
    include: {
      tutor: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
    },
  },
  availabilities: { orderBy: { startedAt: "asc" as const } },
  payments: { orderBy: { createdAt: "asc" as const } },
};

// BOOK-1: Return only future, unclaimed slots for a published tutor subject.
export async function getSubjectAvailability(subjectId: number) {
  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    include: {
      tutor: { include: { user: { select: { firstName: true, lastName: true } } } },
      availabilitySubjects: {
        where: { availability: { bookingId: null, startedAt: { gt: new Date() } } },
        include: { availability: true },
      },
    },
  });
  if (!subject || subject.tutor.status !== "PUBLISHED")
    throw new BookingNotFoundError("Subject not found");
  return {
    subject: {
      id: subject.id,
      name: subject.name,
      description: subject.description,
      hourlyRate: subject.hourlyRate.toString(),
      tutor: {
        id: subject.tutor.id,
        name: subject.tutor.user
          ? `${subject.tutor.user.firstName} ${subject.tutor.user.lastName}`
          : "Tutor",
        avatarUrl: subject.tutor.avatarUrl,
      },
    },
    slots: subject.availabilitySubjects
      .map(({ availability }) => ({
        id: availability.id,
        startedAt: availability.startedAt,
        available: true,
      }))
      .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime()),
  };
}

async function eligibleSlots(tx: Prisma.TransactionClient, subjectId: number, ids: number[]) {
  // Recheck every chosen slot inside the transaction to prevent stale bookings.
  return tx.availability.findMany({
    where: {
      id: { in: ids },
      bookingId: null,
      startedAt: { gt: new Date() },
      availabilitySubjects: { some: { subjectId } },
    },
    orderBy: { startedAt: "asc" },
  });
}
function assertContiguous(slots: Array<{ startedAt: Date }>, subjectId: number) {
  // Multi-slot lessons must consist of consecutive 30-minute blocks.
  for (let i = 1; i < slots.length; i++)
    if (slots[i]!.startedAt.getTime() - slots[i - 1]!.startedAt.getTime() !== SLOT_MS)
      throw new BookingConflictError("Selected slots must be consecutive", subjectId);
}

export async function createBooking(userId: number, input: CreateBookingInput) {
  try {
    // Create the booking, reserve its slots, and create payment as one atomic operation.
    return await prisma.$transaction(
      async (tx) => {
        // Confirm the selected subject is published and owned by another user.
        const subject = await tx.subject.findUnique({
          where: { id: input.subjectId },
          include: { tutor: { include: { user: { select: { id: true } } } } },
        });
        if (!subject || subject.tutor.status !== "PUBLISHED" || !subject.tutor.user)
          throw new BookingNotFoundError("Subject not found");
        if (subject.tutor.user.id === userId)
          throw new BookingForbiddenError("Tutors cannot book their own subject");
        const slots = await eligibleSlots(tx, input.subjectId, input.availabilityIds);
        // A missing slot means it was invalid or another booking claimed it first.
        if (slots.length !== input.availabilityIds.length)
          throw new BookingConflictError(
            "One or more slots are no longer available",
            input.subjectId
          );
        assertContiguous(slots, input.subjectId);
        // Each availability record is 30 minutes, so two slots equal the hourly rate.
        const amount = new Prisma.Decimal(subject.hourlyRate).mul(slots.length).div(2);
        // Snapshot time and price so booking history remains stable after slots are released.
        const booking = await tx.booking.create({
          data: {
            userId,
            subjectId: input.subjectId,
            description: input.description,
            isTrial: input.isTrial,
            totalAmount: amount,
            startedAt: slots[0]!.startedAt,
            endedAt: new Date(slots.at(-1)!.startedAt.getTime() + SLOT_MS),
          },
        });
        const claimed = await tx.availability.updateMany({
          where: { id: { in: input.availabilityIds }, bookingId: null },
          data: { bookingId: booking.id },
        });
        if (claimed.count !== input.availabilityIds.length)
          throw new BookingConflictError(
            "One or more slots are no longer available",
            input.subjectId
          );
        // Payment stays pending until the student confirms payment on the detail page.
        await tx.payment.create({
          data: {
            type: "TRANSFER",
            amount,
            status: "PENDING",
            fromUserId: userId,
            toUserId: subject.tutor.user.id,
            bookingId: booking.id,
          },
        });
        return tx.booking.findUniqueOrThrow({ where: { id: booking.id }, include: detailInclude });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (error) {
    // Treat a database serialization race as the same conflict as a taken slot.
    if (
      error instanceof BookingConflictError ||
      error instanceof BookingNotFoundError ||
      error instanceof BookingForbiddenError
    )
      throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034")
      throw new BookingConflictError("One or more slots are no longer available", input.subjectId);
    throw error;
  }
}

export async function getBooking(userId: number, id: number) {
  // Only the student or the lesson tutor may read these booking details.
  const booking = await prisma.booking.findUnique({ where: { id }, include: detailInclude });
  if (!booking) throw new BookingNotFoundError("Booking not found");
  if (booking.userId !== userId && booking.subject.tutor.user?.id !== userId)
    throw new BookingForbiddenError("You cannot view this booking");
  return booking;
}

// Return the current student's bookings newest first for the booking history page.
export async function listBookings(userId: number) {
  const bookings = await prisma.booking.findMany({
    where: { userId },
    include: detailInclude,
    orderBy: [{ startedAt: "desc" }, { id: "desc" }],
  });
  // Shape nested tutor data into the same client contract used by booking pages.
  return bookings.map((booking) => ({
    ...booking,
    subject: {
      ...booking.subject,
      tutor: {
        id: booking.subject.tutor.id,
        name: booking.subject.tutor.user
          ? `${booking.subject.tutor.user.firstName} ${booking.subject.tutor.user.lastName}`
          : "Tutor",
        avatarUrl: booking.subject.tutor.avatarUrl,
      },
    },
  }));
}

export async function confirmBookingPayment(userId: number, id: number) {
  // Debit balance and confirm the booking together so neither can succeed alone.
  return prisma.$transaction(
    async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id }, include: { payments: true } });
      if (!booking) throw new BookingNotFoundError("Booking not found");
      if (booking.userId !== userId)
        throw new BookingForbiddenError("You cannot pay for this booking");
      if (booking.status !== "PENDING_PAYMENT")
        throw new BookingConflictError("Booking is not awaiting payment", booking.subjectId);
      const payment = booking.payments.find((p) => p.type === "TRANSFER" && p.status === "PENDING");
      if (!payment) throw new BookingPaymentError("Pending payment not found");
      // The balance condition prevents this update from making the balance negative.
      const debited = await tx.user.updateMany({
        where: { id: userId, balance: { gte: payment.amount } },
        data: { balance: { decrement: payment.amount } },
      });
      if (debited.count !== 1) throw new BookingPaymentError("Insufficient balance");
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: "HOLDING", completedAt: new Date() },
      });
      return tx.booking.update({
        where: { id },
        data: { status: "CONFIRMED" },
        include: detailInclude,
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

export async function rescheduleBooking(userId: number, id: number, input: RescheduleBookingInput) {
  // BOOK-3: Reserve replacement slots before releasing the original lesson slots.
  return prisma.$transaction(
    async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id } });
      if (!booking) throw new BookingNotFoundError("Booking not found");
      if (booking.userId !== userId)
        throw new BookingForbiddenError("You cannot reschedule this booking");
      if (
        booking.status !== "CONFIRMED" ||
        booking.startedAt.getTime() - Date.now() <= 24 * 60 * 60_000
      )
        throw new BookingConflictError(
          "Rescheduling is allowed only more than 24 hours before the lesson",
          booking.subjectId
        );
      const currentSlotCount = await tx.availability.count({ where: { bookingId: id } });
      // Rescheduling changes the time but must preserve the purchased duration.
      if (input.availabilityIds.length !== currentSlotCount)
        throw new BookingConflictError(
          "The new time must keep the original lesson duration",
          booking.subjectId
        );
      const slots = await eligibleSlots(tx, booking.subjectId, input.availabilityIds);
      if (slots.length !== input.availabilityIds.length)
        throw new BookingConflictError(
          "One or more slots are no longer available",
          booking.subjectId
        );
      assertContiguous(slots, booking.subjectId);
      const claimed = await tx.availability.updateMany({
        where: { id: { in: input.availabilityIds }, bookingId: null },
        data: { bookingId: id },
      });
      if (claimed.count !== input.availabilityIds.length)
        throw new BookingConflictError(
          "One or more slots are no longer available",
          booking.subjectId
        );
      // Release old slots only after all replacement slots were claimed successfully.
      await tx.availability.updateMany({
        where: { bookingId: id, id: { notIn: input.availabilityIds } },
        data: { bookingId: null },
      });
      return tx.booking.update({
        where: { id },
        data: {
          startedAt: slots[0]!.startedAt,
          endedAt: new Date(slots.at(-1)!.startedAt.getTime() + SLOT_MS),
        },
        include: detailInclude,
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

export async function cancelBooking(userId: number, id: number, input: CancelBookingInput) {
  // BOOK-3: Refund credit, release slots, and cancel status in one transaction.
  return prisma.$transaction(
    async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id }, include: { payments: true } });
      if (!booking) throw new BookingNotFoundError("Booking not found");
      if (booking.userId !== userId)
        throw new BookingForbiddenError("You cannot cancel this booking");
      if (
        !["PENDING_PAYMENT", "CONFIRMED"].includes(booking.status) ||
        booking.startedAt <= new Date()
      )
        throw new BookingConflictError("Booking cannot be cancelled", booking.subjectId);
      const policy = cancellationRefund(booking.totalAmount, booking.startedAt);
      const late = policy.late;
      const transfer = booking.payments.find(
        (p) => p.type === "TRANSFER" && p.status === "HOLDING"
      );
      let refund = new Prisma.Decimal(0);
      if (transfer) {
        // Refund 100% when more than 24 hours away; otherwise refund 70%.
        refund = cancellationRefund(transfer.amount, booking.startedAt).amount;
        // Credit the student and keep a separate REFUND record for the audit trail.
        await tx.user.update({ where: { id: userId }, data: { balance: { increment: refund } } });
        await tx.payment.create({
          data: {
            type: "REFUND",
            amount: refund,
            status: "COMPLETED",
            completedAt: new Date(),
            fromUserId: transfer.toUserId,
            toUserId: userId,
            bookingId: id,
          },
        });
        await tx.payment.update({ where: { id: transfer.id }, data: { status: "CANCELLED" } });
      }
      // A cancelled lesson must no longer block the tutor's availability.
      await tx.availability.updateMany({ where: { bookingId: id }, data: { bookingId: null } });
      const updated = await tx.booking.update({
        where: { id },
        data: { status: "CANCELLED", cancelledAt: new Date(), cancellationReason: input.reason },
        include: detailInclude,
      });
      return {
        booking: updated,
        refund: {
          amount: refund.toString(),
          lateCancellation: late,
          rate: late ? LATE_CANCELLATION_REFUND_RATE : 1,
        },
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}
