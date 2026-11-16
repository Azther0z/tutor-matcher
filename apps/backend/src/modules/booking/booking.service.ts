import { Prisma } from "../../generated/prisma/client.ts";
import { prisma } from "../../lib/db.ts";
import { isTransactionConflict } from "../../lib/transaction-conflict.ts";
import { publicPortfolioSelect, publicCertificationUrls } from "../profile/profile.public.ts";
import { subjectSnapshot } from "../subject/subject.public.ts";
import { notifyUser } from "../notification/notification.service.ts";
import { appendWalletMovement, InsufficientWalletBalance } from "../wallet/wallet-ledger.ts";
import { settleTutorEarnings } from "../wallet/earning-settlement.service.ts";
import type { CreateBookingInput } from "./booking.schema.ts";
import {
  BookingConflictError,
  BookingDomainError,
  BookingForbiddenError,
  BookingNotFoundError,
  BookingPaymentError,
} from "./booking.errors.ts";
import { assertSlotBlock, decimalString, PAYMENT_HOLD_MINUTES, SLOT_MS } from "./booking.policy.ts";
import { detailInclude, mapBookingResponse } from "./booking.view.ts";
import { waitForBookingNotifications } from "./booking.notifications.ts";
import { releaseExpiredBookings } from "./booking.expiry.ts";

export * from "./booking.errors.ts";
export {
  assertSlotBlock,
  cancellationRefund,
  CANCELLATION_POLICY_WINDOW_HOURS,
  LATE_CANCELLATION_REFUND_RATE,
  PAYMENT_HOLD_MINUTES,
} from "./booking.policy.ts";
export { mapBookingResponse } from "./booking.view.ts";
export { waitForBookingNotifications } from "./booking.notifications.ts";
export { releaseExpiredBookings } from "./booking.expiry.ts";
export {
  cancelBooking,
  cancelBookingAsTutor,
  getCancellationQuote,
  getTutorCancellationQuote,
  listTutorUpcomingBookings,
} from "./booking-cancel.service.ts";
export {
  confirmBookingCompletionAsTutor,
  listTutorBookingsNeedingConfirmation,
} from "./booking-completion.service.ts";

function isSerializationError(error: unknown) {
  return isTransactionConflict(error);
}

async function loadDetail(id: string) {
  return prisma.booking.findUnique({ where: { id }, include: detailInclude });
}

// BOOK-1 returns future, unclaimed slots for a published tutor subject.
export async function getSubjectAvailability(subjectId: string) {
  const now = new Date();
  await releaseExpiredBookings(now, { subjectId });
  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    include: {
      tutor: {
        include: {
          user: { select: { firstName: true, lastName: true } },
          currentProfileVersion: { select: { avatarUrl: true, ...publicPortfolioSelect } },
        },
      },
      availabilitySubjects: {
        where: { availability: { isOpen: true, bookingId: null, startedAt: { gt: now } } },
        include: { availability: true },
      },
    },
  });
  if (!subject) throw new BookingNotFoundError("Subject not found", "SUBJECT_NOT_FOUND");
  return {
    subject: {
      id: subject.id,
      name: subject.name,
      description: subject.description,
      hourlyRate: decimalString(subject.hourlyRate),
      format: subject.format,
      tutor: {
        id: subject.tutor.id,
        name: subject.tutor.user
          ? `${subject.tutor.user.firstName} ${subject.tutor.user.lastName}`
          : "Tutor",
        avatarUrl: subject.tutor.currentProfileVersion.avatarUrl,
        certificationUrls: publicCertificationUrls(subject.tutor.currentProfileVersion),
      },
    },
    acceptingBookings: subject.tutor.status === "PUBLISHED",
    slots: (subject.tutor.status === "PUBLISHED" ? subject.availabilitySubjects : [])
      .map(({ availability }) => ({
        id: availability.id,
        startedAt: availability.startedAt.toISOString(),
        available: true as const,
      }))
      .sort((first, second) => first.startedAt.localeCompare(second.startedAt)),
  };
}

async function eligibleSlots(
  tx: Prisma.TransactionClient,
  subjectId: string,
  ids: string[],
  now: Date
) {
  return tx.availability.findMany({
    where: {
      id: { in: ids },
      bookingId: null,
      isOpen: true,
      startedAt: { gt: now },
      availabilitySubjects: { some: { subjectId } },
    },
    orderBy: { startedAt: "asc" },
  });
}

export async function createBooking(userId: string, input: CreateBookingInput) {
  const now = new Date();
  await releaseExpiredBookings(now, { subjectId: input.subjectId });
  try {
    return await prisma.$transaction(
      async (tx) => {
        const subject = await tx.subject.findUnique({
          where: { id: input.subjectId },
          include: { tutor: { include: { user: { select: { id: true } } } } },
        });
        if (!subject || subject.tutor.status !== "PUBLISHED" || !subject.tutor.user)
          throw new BookingNotFoundError("Subject not found", "SUBJECT_NOT_FOUND");
        if (subject.tutor.user.id === userId)
          throw new BookingForbiddenError("Tutors cannot book their own subject");

        const slots = await eligibleSlots(tx, input.subjectId, input.availabilityIds, now);
        if (slots.length !== input.availabilityIds.length)
          throw new BookingConflictError("SLOT_TAKEN", "One or more slots are unavailable", {
            subjectId: input.subjectId,
          });
        assertSlotBlock(slots, input.subjectId);

        const amount = new Prisma.Decimal(subject.hourlyRate).mul(slots.length).div(2);
        const requiresPayment = !amount.isZero();
        const expiresAt = requiresPayment
          ? new Date(
              Math.min(now.getTime() + PAYMENT_HOLD_MINUTES * 60_000, slots[0]!.startedAt.getTime())
            )
          : null;
        const booking = await tx.booking.create({
          data: {
            userId,
            subjectId: input.subjectId,
            ...subjectSnapshot(subject),
            description: input.description,
            isTrial: false,
            totalAmount: amount,
            startedAt: slots[0]!.startedAt,
            endedAt: new Date(slots.at(-1)!.startedAt.getTime() + SLOT_MS),
            // Zero-priced legacy bookings bypass payment and its notifications; new rates are positive.
            status: requiresPayment ? "PENDING_PAYMENT" : "CONFIRMED",
            paymentExpiresAt: expiresAt,
          },
        });
        if (!requiresPayment) {
          const claimed = await tx.availability.updateMany({
            where: {
              id: { in: input.availabilityIds },
              bookingId: null,
              startedAt: { gt: now },
            },
            data: { bookingId: booking.id },
          });
          if (claimed.count !== input.availabilityIds.length)
            throw new BookingConflictError("SLOT_TAKEN", "One or more slots are unavailable", {
              subjectId: input.subjectId,
            });
        }
        const detailed = await tx.booking.findUniqueOrThrow({
          where: { id: booking.id },
          include: detailInclude,
        });
        return mapBookingResponse(detailed, userId, now);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (error) {
    if (error instanceof BookingDomainError || !isSerializationError(error)) throw error;
    throw new BookingConflictError("SLOT_TAKEN", "One or more slots are unavailable", {
      subjectId: input.subjectId,
    });
  }
}

export async function getBooking(userId: string, id: string) {
  const now = new Date();
  await releaseExpiredBookings(now, { id });
  const booking = await loadDetail(id);
  if (!booking) throw new BookingNotFoundError();
  if (booking.userId !== userId && booking.subject.tutor.user?.id !== userId)
    throw new BookingForbiddenError("You cannot view this booking");
  return mapBookingResponse(booking, userId, now);
}

export async function updateBookingMeetingLink(
  userId: string,
  id: string,
  customMeetingUrl: string | null
) {
  const now = new Date();
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      subject: { include: { tutor: { include: { user: { select: { id: true } } } } } },
    },
  });
  if (!booking) throw new BookingNotFoundError();
  if (booking.subject.tutor.user?.id !== userId)
    throw new BookingForbiddenError(
      "Only the Tutor assigned to this booking can update its meeting link"
    );
  if (booking.status !== "CONFIRMED" || booking.endedAt.getTime() <= now.getTime())
    throw new BookingConflictError(
      "MEETING_LINK_NOT_EDITABLE",
      "Meeting links can only be changed on confirmed bookings before their scheduled end"
    );

  const updated = await prisma.booking.updateMany({
    where: {
      id,
      status: "CONFIRMED",
      endedAt: { gt: now },
      subject: { tutor: { user: { id: userId } } },
    },
    data: {
      customMeetingUrl,
      meetingLinkUpdatedAt: now,
    },
  });
  if (updated.count !== 1)
    throw new BookingConflictError(
      "MEETING_LINK_NOT_EDITABLE",
      "Meeting links can only be changed on confirmed bookings before their scheduled end"
    );

  return getBooking(userId, id);
}

export async function listBookings(
  userId: string,
  { role = "STUDENT" }: { role?: "STUDENT" | "TUTOR" } = {}
) {
  const now = new Date();
  let where: Prisma.BookingWhereInput;
  if (role === "TUTOR") {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tutor: { select: { id: true } } },
    });
    if (!user?.tutor) {
      throw new BookingForbiddenError("Only approved Tutors can view teaching bookings");
    }
    where = { subject: { tutorId: user.tutor.id } };
    await releaseExpiredBookings(now, { tutorId: user.tutor.id });
  } else {
    where = { userId };
    await releaseExpiredBookings(now, { userId });
  }
  const bookings = await prisma.booking.findMany({
    where: {
      ...where,
      OR: [
        { status: { in: ["CONFIRMED", "COMPLETED"] } },
        { status: "CANCELLED", cancellationReason: { not: "PAYMENT_EXPIRED" } },
      ],
    },
    include: detailInclude,
    orderBy: [{ startedAt: "desc" }, { id: "desc" }],
  });
  return bookings.map((booking) => mapBookingResponse(booking, userId, now));
}

export async function confirmBookingPayment(userId: string, id: string) {
  await settleTutorEarnings(userId);
  await releaseExpiredBookings(new Date(), { id });

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const confirmed = await prisma.$transaction(
        async (tx) => {
          const booking = await tx.booking.findUnique({
            where: { id },
          });
          // Capture time inside the serializable transaction so cleanup cannot leave a stale deadline.
          const transactionNow = new Date();
          if (!booking) throw new BookingNotFoundError();
          if (booking.userId !== userId)
            throw new BookingForbiddenError("You cannot pay for this booking");
          if (booking.status === "CONFIRMED")
            throw new BookingConflictError("BOOKING_ALREADY_PAID", "Booking is already paid");
          if (booking.status === "CANCELLED" && booking.cancellationReason === "PAYMENT_EXPIRED")
            throw new BookingConflictError("BOOKING_EXPIRED", "The payment request has expired");
          if (booking.status !== "PENDING_PAYMENT")
            throw new BookingConflictError(
              "BOOKING_ALREADY_PAID",
              "Booking is not awaiting payment"
            );
          if (
            !booking.paymentExpiresAt ||
            booking.paymentExpiresAt.getTime() <= transactionNow.getTime() ||
            booking.startedAt.getTime() <= transactionNow.getTime()
          )
            throw new BookingConflictError("BOOKING_EXPIRED", "The payment request has expired");

          // Pending bookings remember the interval, not ownership of its slots.
          const slots = await tx.availability.findMany({
            where: {
              startedAt: { gte: booking.startedAt, lt: booking.endedAt },
              isOpen: true,
              bookingId: null,
              availabilitySubjects: { some: { subjectId: booking.subjectId } },
              tutor: { subjects: { some: { id: booking.subjectId } } },
            },
            orderBy: { startedAt: "asc" },
          });
          const expectedCount = (booking.endedAt.getTime() - booking.startedAt.getTime()) / SLOT_MS;
          if (
            expectedCount <= 0 ||
            !Number.isInteger(expectedCount) ||
            slots.length !== expectedCount ||
            slots.some(
              (slot, index) =>
                slot.startedAt.getTime() !== booking.startedAt.getTime() + index * SLOT_MS
            )
          ) {
            throw new BookingConflictError(
              "SLOT_TAKEN",
              "These times are no longer available. Choose another time.",
              { subjectId: booking.subjectId }
            );
          }
          const slotClaim = await tx.availability.updateMany({
            where: { id: { in: slots.map((slot) => slot.id) }, bookingId: null, isOpen: true },
            data: { bookingId: booking.id },
          });
          if (slotClaim.count !== expectedCount)
            throw new BookingConflictError(
              "SLOT_TAKEN",
              "These times are no longer available. Choose another time.",
              { subjectId: booking.subjectId }
            );

          const claimed = await tx.booking.updateMany({
            where: {
              id,
              status: "PENDING_PAYMENT",
              paymentExpiresAt: { gt: transactionNow },
              startedAt: { gt: transactionNow },
            },
            data: { status: "CONFIRMED", paymentExpiresAt: null },
          });
          if (claimed.count !== 1)
            throw new BookingConflictError("BOOKING_EXPIRED", "The payment request has expired");

          try {
            await appendWalletMovement(tx, {
              userId,
              type: "LESSON_PAYMENT",
              amount: booking.totalAmount,
              bookingId: id,
            });
          } catch (error) {
            if (!(error instanceof InsufficientWalletBalance)) throw error;
            throw new BookingPaymentError("INSUFFICIENT_BALANCE", "Insufficient balance", {
              walletBalance: decimalString(error.balance),
              amountDue: decimalString(error.amount),
              shortfall: decimalString(error.amount.minus(error.balance)),
            });
          }

          const detailed = await tx.booking.findUniqueOrThrow({
            where: { id },
            include: detailInclude,
          });
          return {
            response: mapBookingResponse(detailed, userId, transactionNow),
            recipientIds: [detailed.user.id, detailed.subject.tutor.user?.id].filter(
              (recipientId): recipientId is string => recipientId !== undefined
            ),
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
      // Notify only after commit, never from a transaction that can roll back or retry.
      // Lookup/delivery failures must not turn a successful payment into a failed response.
      await waitForBookingNotifications(
        confirmed.recipientIds.map((recipientId) =>
          notifyUser(recipientId, {
            eventType: "booking",
            details: {
              subjectName: confirmed.response.subject.name,
              scheduledAt: new Date(confirmed.response.startedAt),
            },
          })
        )
      );
      return confirmed.response;
    } catch (error) {
      if (!isSerializationError(error)) throw error;
      const latest = await prisma.booking.findUnique({
        where: { id },
        select: { status: true, cancellationReason: true },
      });
      if (latest?.status === "CONFIRMED")
        throw new BookingConflictError("BOOKING_ALREADY_PAID", "Booking is already paid");
      if (attempt === 1) {
        await releaseExpiredBookings(new Date(), { id });
        throw new BookingConflictError("BOOKING_EXPIRED", "The payment request has expired");
      }
    }
  }
  throw new BookingConflictError("BOOKING_ALREADY_PAID", "Booking payment could not be claimed");
}
