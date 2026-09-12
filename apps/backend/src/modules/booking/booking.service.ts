import { createHash } from "node:crypto";
import { Prisma } from "../../generated/prisma/client.ts";
import { prisma } from "../../lib/db.ts";
import type {
  CancelBookingInput,
  CreateBookingInput,
  RescheduleBookingInput,
} from "./booking.schema.ts";

const SLOT_MS = 30 * 60_000;
const BANGKOK_TIME_ZONE = "Asia/Bangkok";
const ZERO = new Prisma.Decimal(0);

function positiveSetting(name: string, fallback: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function rateSetting(name: string, fallback: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : fallback;
}

// These BOOK-3 defaults stay configurable until product signs off the final policy numbers.
export const CANCELLATION_POLICY_WINDOW_HOURS = positiveSetting(
  "BOOKING_CANCELLATION_WINDOW_HOURS",
  24
);
export const LATE_CANCELLATION_REFUND_RATE = rateSetting("BOOKING_LATE_REFUND_RATE", 0.7);
export const PAYMENT_HOLD_MINUTES = positiveSetting("BOOKING_PAYMENT_HOLD_MINUTES", 15);

export type BookingErrorCode =
  | "BOOKING_NOT_FOUND"
  | "SUBJECT_NOT_FOUND"
  | "BOOKING_FORBIDDEN"
  | "SLOT_TAKEN"
  | "INVALID_SLOT_BLOCK"
  | "BOOKING_EXPIRED"
  | "BOOKING_ALREADY_PAID"
  | "BOOKING_NOT_CANCELLABLE"
  | "BOOKING_NOT_RESCHEDULABLE"
  | "PAYMENT_NOT_FOUND"
  | "INSUFFICIENT_BALANCE"
  | "CANCELLATION_QUOTE_CHANGED";

// BOOK-4: which side of the booking the current caller is acting as.
export type BookingActor = "STUDENT" | "TUTOR";

export class BookingDomainError extends Error {
  constructor(
    public readonly code: BookingErrorCode,
    public readonly status: number,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "BookingDomainError";
  }
}

export class BookingNotFoundError extends BookingDomainError {
  constructor(
    message = "Booking not found",
    code: "BOOKING_NOT_FOUND" | "SUBJECT_NOT_FOUND" = "BOOKING_NOT_FOUND"
  ) {
    super(code, 404, message);
  }
}

export class BookingForbiddenError extends BookingDomainError {
  constructor(message: string) {
    super("BOOKING_FORBIDDEN", 403, message);
  }
}

type ConflictCode = Exclude<
  BookingErrorCode,
  | "BOOKING_NOT_FOUND"
  | "SUBJECT_NOT_FOUND"
  | "BOOKING_FORBIDDEN"
  | "PAYMENT_NOT_FOUND"
  | "INSUFFICIENT_BALANCE"
>;

export class BookingConflictError extends BookingDomainError {
  constructor(code: ConflictCode, message: string, details?: Record<string, unknown>) {
    super(code, 409, message, details);
  }
}

export class BookingPaymentError extends BookingDomainError {
  constructor(
    code: "PAYMENT_NOT_FOUND" | "INSUFFICIENT_BALANCE",
    message: string,
    details?: Record<string, unknown>
  ) {
    super(code, code === "INSUFFICIENT_BALANCE" ? 402 : 409, message, details);
  }
}

const detailInclude = {
  user: { select: { id: true, firstName: true, lastName: true, balance: true } },
  subject: {
    include: {
      tutor: {
        include: { user: { select: { id: true, firstName: true, lastName: true } } },
      },
    },
  },
  availabilities: { orderBy: { startedAt: "asc" as const } },
  payments: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.BookingInclude;

type BookingDetailRecord = Prisma.BookingGetPayload<{ include: typeof detailInclude }>;
type QuoteSource = Pick<
  BookingDetailRecord,
  "id" | "status" | "totalAmount" | "startedAt" | "payments"
>;

function decimalString(value: Prisma.Decimal) {
  return value.toDecimalPlaces(2).toFixed(2);
}

function bangkokCalendarDay(value: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BANGKOK_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}

// BOOK-1 only accepts one continuous block that stays on one Bangkok calendar day.
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

// BOOK-3 calculates refunds from server time; the client never supplies money values.
// BOOK-4: a tutor-initiated cancellation never charges the student a late fee.
export function cancellationRefund(
  amount: Prisma.Decimal,
  startsAt: Date,
  now = new Date(),
  actor: BookingActor = "STUDENT"
) {
  const policyMs = CANCELLATION_POLICY_WINDOW_HOURS * 60 * 60_000;
  const late = startsAt.getTime() - now.getTime() <= policyMs;
  const rate = actor === "TUTOR" ? 1 : late ? LATE_CANCELLATION_REFUND_RATE : 1;
  return { late, rate, amount: amount.mul(rate).toDecimalPlaces(2) };
}

function quoteFor(booking: QuoteSource, now: Date, actor: BookingActor = "STUDENT") {
  const transfer = booking.payments.find(
    (payment) => payment.type === "TRANSFER" && payment.status === "HOLDING"
  );
  const originalAmount = transfer?.amount ?? ZERO;
  const late =
    booking.startedAt.getTime() - now.getTime() <= CANCELLATION_POLICY_WINDOW_HOURS * 60 * 60_000;
  const policy = transfer
    ? cancellationRefund(transfer.amount, booking.startedAt, now, actor)
    : { late, rate: 0, amount: ZERO };
  const fee = originalAmount.minus(policy.amount).toDecimalPlaces(2);
  const token = createHash("sha256")
    .update(
      [
        booking.id,
        booking.status,
        booking.startedAt.toISOString(),
        transfer?.id ?? "unpaid",
        transfer?.status ?? "none",
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

export function mapBookingResponse(
  booking: BookingDetailRecord,
  viewerUserId: string,
  now = new Date()
) {
  const isStudent = booking.userId === viewerUserId;
  // BOOK-4: the tutor who owns the subject can view and act on the lesson too.
  const isTutor = booking.subject.tutor.user?.id === viewerUserId;
  const transfer = booking.payments.find((payment) => payment.type === "TRANSFER");
  const amountDue =
    booking.status === "PENDING_PAYMENT" ? (transfer?.amount ?? booking.totalAmount) : ZERO;
  const walletBalance = booking.user.balance;
  const shortfall = amountDue.greaterThan(walletBalance) ? amountDue.minus(walletBalance) : ZERO;
  // A paid booking always has a deadline; a legacy/null pending row is never payable.
  const beforeDeadline =
    booking.paymentExpiresAt !== null && booking.paymentExpiresAt.getTime() > now.getTime();
  const beforeLesson = booking.startedAt.getTime() > now.getTime();
  const payEligible =
    isStudent &&
    booking.status === "PENDING_PAYMENT" &&
    transfer?.status === "PENDING" &&
    beforeDeadline &&
    beforeLesson;
  const canPay = payEligible && shortfall.isZero();
  // BOOK-4: cancel/reschedule are available to either side of the booking, not the student alone.
  const canCancel =
    (isStudent || isTutor) &&
    ["PENDING_PAYMENT", "CONFIRMED"].includes(booking.status) &&
    beforeLesson;
  const canReschedule =
    (isStudent || isTutor) &&
    booking.status === "CONFIRMED" &&
    booking.startedAt.getTime() - now.getTime() > CANCELLATION_POLICY_WINDOW_HOURS * 60 * 60_000;
  const cancelledByRole =
    booking.cancelledByUserId === null
      ? null
      : booking.cancelledByUserId === booking.userId
        ? ("STUDENT" as const)
        : ("TUTOR" as const);

  return {
    id: booking.id,
    status: booking.status,
    description: booking.description,
    zoomMeetingUrl: booking.zoomMeetingUrl,
    createdAt: booking.createdAt.toISOString(),
    isTrial: booking.isTrial,
    totalAmount: decimalString(booking.totalAmount),
    startedAt: booking.startedAt.toISOString(),
    endedAt: booking.endedAt.toISOString(),
    paymentExpiresAt: booking.paymentExpiresAt?.toISOString() ?? null,
    cancelledAt: booking.cancelledAt?.toISOString() ?? null,
    cancellationReason: booking.cancellationReason,
    cancelledByRole,
    viewerRole: isStudent ? ("STUDENT" as const) : ("TUTOR" as const),
    student: {
      id: booking.user.id,
      name: `${booking.user.firstName} ${booking.user.lastName}`,
    },
    subject: {
      id: booking.subject.id,
      name: booking.subject.name,
      description: booking.subject.description,
      hourlyRate: decimalString(booking.subject.hourlyRate),
      tutor: {
        id: booking.subject.tutor.id,
        name: booking.subject.tutor.user
          ? `${booking.subject.tutor.user.firstName} ${booking.subject.tutor.user.lastName}`
          : "Tutor",
        avatarUrl: booking.subject.tutor.avatarUrl,
      },
    },
    availabilities: booking.availabilities.map((slot) => ({
      id: slot.id,
      startedAt: slot.startedAt.toISOString(),
    })),
    payment: {
      status: transfer?.status ?? null,
      amountDue: decimalString(amountDue),
      walletBalance: isStudent ? decimalString(walletBalance) : null,
      shortfall: isStudent ? decimalString(shortfall) : null,
      canPay,
      expiresAt: booking.paymentExpiresAt?.toISOString() ?? null,
    },
    actions: { canPay: payEligible, canCancel, canReschedule },
  };
}

function isSerializationError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

async function loadDetail(id: string) {
  return prisma.booking.findUnique({ where: { id }, include: detailInclude });
}

// BOOK-4: the tutor who owns the subject may act on the booking too, not only the student.
function bookingActor(booking: BookingDetailRecord, userId: string, action: string): BookingActor {
  if (booking.userId === userId) return "STUDENT";
  if (booking.subject.tutor.user?.id === userId) return "TUTOR";
  throw new BookingForbiddenError(`You cannot ${action} this booking`);
}

// Lazily expires abandoned payment-due bookings before relevant reads and writes.
export async function releaseExpiredBookings(
  now = new Date(),
  filter: { id?: string; userId?: string; subjectId?: string; subjectIds?: string[] } = {}
) {
  // subjectIds (BOOK-4's tutor listing) is translated below; it is not itself a Booking field.
  const { subjectIds, ...scalarFilter } = filter;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const expired = await tx.booking.findMany({
            where: {
              ...scalarFilter,
              ...(subjectIds ? { subjectId: { in: subjectIds } } : {}),
              status: "PENDING_PAYMENT",
              OR: [{ paymentExpiresAt: { lte: now } }, { paymentExpiresAt: null }],
            },
            select: { id: true },
          });
          let released = 0;
          for (const candidate of expired) {
            const claimed = await tx.booking.updateMany({
              where: {
                id: candidate.id,
                status: "PENDING_PAYMENT",
                OR: [{ paymentExpiresAt: { lte: now } }, { paymentExpiresAt: null }],
              },
              data: {
                status: "CANCELLED",
                cancelledAt: now,
                cancellationReason: "PAYMENT_EXPIRED",
              },
            });
            if (claimed.count !== 1) continue;
            await tx.payment.updateMany({
              where: { bookingId: candidate.id, type: "TRANSFER", status: "PENDING" },
              data: { status: "CANCELLED" },
            });
            await tx.availability.updateMany({
              where: { bookingId: candidate.id },
              data: { bookingId: null },
            });
            released += 1;
          }
          return released;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } catch (error) {
      if (!isSerializationError(error) || attempt === 1) throw error;
    }
  }
  return 0;
}

// BOOK-1 returns future, unclaimed slots for a published tutor subject.
export async function getSubjectAvailability(subjectId: string) {
  const now = new Date();
  await releaseExpiredBookings(now, { subjectId });
  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    include: {
      tutor: { include: { user: { select: { firstName: true, lastName: true } } } },
      availabilitySubjects: {
        where: { availability: { bookingId: null, startedAt: { gt: now } } },
        include: { availability: true },
      },
    },
  });
  if (!subject || subject.tutor.status !== "PUBLISHED")
    throw new BookingNotFoundError("Subject not found", "SUBJECT_NOT_FOUND");
  return {
    subject: {
      id: subject.id,
      name: subject.name,
      description: subject.description,
      hourlyRate: decimalString(subject.hourlyRate),
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
            description: input.description,
            isTrial: input.isTrial,
            totalAmount: amount,
            startedAt: slots[0]!.startedAt,
            endedAt: new Date(slots.at(-1)!.startedAt.getTime() + SLOT_MS),
            status: requiresPayment ? "PENDING_PAYMENT" : "CONFIRMED",
            paymentExpiresAt: expiresAt,
          },
        });
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
        if (requiresPayment)
          await tx.payment.create({
            data: {
              type: "TRANSFER",
              amount,
              status: "PENDING",
              fromUserId: userId,
              // The platform holds payment until completion; the tutor is the booking beneficiary.
              toUserId: null,
              bookingId: booking.id,
            },
          });
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

export async function listBookings(userId: string, role: BookingActor = "STUDENT") {
  const now = new Date();
  let where: Prisma.BookingWhereInput;
  if (role === "TUTOR") {
    // A tutor's bookings are reached through the subjects they own, not a direct userId column.
    const subjects = await prisma.subject.findMany({
      where: { tutor: { user: { id: userId } } },
      select: { id: true },
    });
    const subjectIds = subjects.map((subject) => subject.id);
    if (subjectIds.length === 0) return [];
    await releaseExpiredBookings(now, { subjectIds });
    where = { subjectId: { in: subjectIds } };
  } else {
    await releaseExpiredBookings(now, { userId });
    where = { userId };
  }
  const bookings = await prisma.booking.findMany({
    where,
    include: detailInclude,
    orderBy: [{ startedAt: "desc" }, { id: "desc" }],
  });
  return bookings.map((booking) => mapBookingResponse(booking, userId, now));
}

export async function confirmBookingPayment(userId: string, id: string) {
  await releaseExpiredBookings(new Date(), { id });

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const booking = await tx.booking.findUnique({
            where: { id },
            include: { payments: true },
          });
          // Capture time inside the serializable transaction so cleanup cannot leave a stale deadline.
          const transactionNow = new Date();
          if (!booking) throw new BookingNotFoundError();
          if (booking.userId !== userId)
            throw new BookingForbiddenError("You cannot pay for this booking");
          if (booking.status === "CONFIRMED")
            throw new BookingConflictError("BOOKING_ALREADY_PAID", "Booking is already paid");
          if (booking.status === "CANCELLED" && booking.cancellationReason === "PAYMENT_EXPIRED")
            throw new BookingConflictError("BOOKING_EXPIRED", "The payment hold has expired");
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
            throw new BookingConflictError("BOOKING_EXPIRED", "The payment hold has expired");

          const transfer = booking.payments.find(
            (payment) => payment.type === "TRANSFER" && payment.status === "PENDING"
          );
          if (!transfer)
            throw new BookingPaymentError("PAYMENT_NOT_FOUND", "Pending payment not found");

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
            throw new BookingConflictError("BOOKING_EXPIRED", "The payment hold has expired");

          const debited = await tx.user.updateMany({
            where: { id: userId, balance: { gte: transfer.amount } },
            data: { balance: { decrement: transfer.amount } },
          });
          if (debited.count !== 1) {
            const user = await tx.user.findUniqueOrThrow({
              where: { id: userId },
              select: { balance: true },
            });
            throw new BookingPaymentError("INSUFFICIENT_BALANCE", "Insufficient balance", {
              walletBalance: decimalString(user.balance),
              amountDue: decimalString(transfer.amount),
              shortfall: decimalString(transfer.amount.minus(user.balance)),
            });
          }
          // HOLDING represents platform escrow. Tutor earnings are credited only after completion.
          const paymentClaimed = await tx.payment.updateMany({
            where: { id: transfer.id, status: "PENDING" },
            data: { status: "HOLDING" },
          });
          if (paymentClaimed.count !== 1)
            throw new BookingConflictError("BOOKING_ALREADY_PAID", "Booking is already paid");

          const detailed = await tx.booking.findUniqueOrThrow({
            where: { id },
            include: detailInclude,
          });
          return mapBookingResponse(detailed, userId, transactionNow);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
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
        throw new BookingConflictError("BOOKING_EXPIRED", "The payment hold has expired");
      }
    }
  }
  throw new BookingConflictError("BOOKING_ALREADY_PAID", "Booking payment could not be claimed");
}

export async function rescheduleBooking(userId: string, id: string, input: RescheduleBookingInput) {
  const now = new Date();
  try {
    return await prisma.$transaction(
      async (tx) => {
        const booking = await tx.booking.findUnique({ where: { id }, include: detailInclude });
        if (!booking) throw new BookingNotFoundError();
        bookingActor(booking, userId, "reschedule");
        if (
          booking.status !== "CONFIRMED" ||
          booking.startedAt.getTime() - now.getTime() <=
            CANCELLATION_POLICY_WINDOW_HOURS * 60 * 60_000
        )
          throw new BookingConflictError(
            "BOOKING_NOT_RESCHEDULABLE",
            `Rescheduling is allowed only more than ${CANCELLATION_POLICY_WINDOW_HOURS} hours before the lesson`
          );

        const currentSlotCount = await tx.availability.count({ where: { bookingId: id } });
        if (input.availabilityIds.length !== currentSlotCount)
          throw new BookingConflictError(
            "INVALID_SLOT_BLOCK",
            "The new time must keep the original lesson duration",
            { subjectId: booking.subjectId }
          );
        const slots = await eligibleSlots(tx, booking.subjectId, input.availabilityIds, now);
        if (slots.length !== input.availabilityIds.length)
          throw new BookingConflictError("SLOT_TAKEN", "One or more slots are unavailable", {
            subjectId: booking.subjectId,
          });
        assertSlotBlock(slots, booking.subjectId);
        const claimed = await tx.availability.updateMany({
          where: {
            id: { in: input.availabilityIds },
            bookingId: null,
            startedAt: { gt: now },
          },
          data: { bookingId: id },
        });
        if (claimed.count !== input.availabilityIds.length)
          throw new BookingConflictError("SLOT_TAKEN", "One or more slots are unavailable", {
            subjectId: booking.subjectId,
          });
        await tx.availability.updateMany({
          where: { bookingId: id, id: { notIn: input.availabilityIds } },
          data: { bookingId: null },
        });
        const detailed = await tx.booking.update({
          where: { id },
          data: {
            startedAt: slots[0]!.startedAt,
            endedAt: new Date(slots.at(-1)!.startedAt.getTime() + SLOT_MS),
          },
          include: detailInclude,
        });
        return mapBookingResponse(detailed, userId, now);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (error) {
    if (error instanceof BookingDomainError || !isSerializationError(error)) throw error;
    throw new BookingConflictError("SLOT_TAKEN", "One or more slots are unavailable");
  }
}

export async function getCancellationQuote(userId: string, id: string) {
  const now = new Date();
  await releaseExpiredBookings(now, { id });
  const booking = await loadDetail(id);
  if (!booking) throw new BookingNotFoundError();
  const actor = bookingActor(booking, userId, "cancel");
  if (
    !["PENDING_PAYMENT", "CONFIRMED"].includes(booking.status) ||
    booking.startedAt.getTime() <= now.getTime()
  )
    throw new BookingConflictError("BOOKING_NOT_CANCELLABLE", "Booking cannot be cancelled");
  if (
    booking.status === "CONFIRMED" &&
    !booking.payments.some((payment) => payment.type === "TRANSFER" && payment.status === "HOLDING")
  )
    throw new BookingPaymentError("PAYMENT_NOT_FOUND", "Confirmed lesson payment not found");
  return quoteFor(booking, now, actor);
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
        const actor = bookingActor(booking, userId, "cancel");
        if (
          !["PENDING_PAYMENT", "CONFIRMED"].includes(booking.status) ||
          booking.startedAt.getTime() <= transactionNow.getTime()
        )
          throw new BookingConflictError("BOOKING_NOT_CANCELLABLE", "Booking cannot be cancelled");

        const quote = quoteFor(booking, transactionNow, actor);
        const transfer = booking.payments.find((payment) => payment.type === "TRANSFER");
        if (booking.status === "CONFIRMED" && transfer?.status !== "HOLDING")
          throw new BookingPaymentError("PAYMENT_NOT_FOUND", "Confirmed lesson payment not found");
        if (transfer?.status === "HOLDING" && input.quoteToken !== quote.token)
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
            // BOOK-4: record which side cancelled, for refund routing and future reliability tracking.
            cancelledByUserId: userId,
            paymentExpiresAt: null,
          },
        });
        if (claimed.count !== 1)
          throw new BookingConflictError("BOOKING_NOT_CANCELLABLE", "Booking cannot be cancelled");

        let refund = ZERO;
        if (transfer?.status === "PENDING")
          await tx.payment.updateMany({
            where: { id: transfer.id, status: "PENDING" },
            data: { status: "CANCELLED" },
          });
        if (transfer?.status === "HOLDING") {
          const transferClosed = await tx.payment.updateMany({
            where: { id: transfer.id, status: "HOLDING" },
            data: { status: "CANCELLED" },
          });
          if (transferClosed.count !== 1)
            throw new BookingConflictError(
              "BOOKING_NOT_CANCELLABLE",
              "Booking was already cancelled"
            );
          refund = new Prisma.Decimal(quote.refundAmount);
          // BOOK-4: the refund always goes to the student, whichever side cancelled.
          await tx.user.update({
            where: { id: booking.userId },
            data: { balance: { increment: refund } },
          });
          await tx.payment.create({
            data: {
              type: "REFUND",
              amount: refund,
              status: "COMPLETED",
              completedAt: transactionNow,
              // Release the refundable portion from platform escrow, not from the tutor wallet.
              fromUserId: null,
              toUserId: booking.userId,
              bookingId: id,
            },
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
    if (error instanceof BookingDomainError || !isSerializationError(error)) throw error;
    throw new BookingConflictError("BOOKING_NOT_CANCELLABLE", "Booking was already cancelled");
  }
}
