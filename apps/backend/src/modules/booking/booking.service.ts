import { createHash } from "node:crypto";
import { Prisma } from "../../generated/prisma/client.ts";
import { prisma } from "../../lib/db.ts";
import { isTransactionConflict } from "../../lib/transaction-conflict.ts";
import { publicPortfolioSelect, publicCertificationUrls } from "../profile/profile.public.ts";
import { subjectSnapshot } from "../subject/subject.public.ts";
import { notifyUser } from "../notification/notification.service.ts";
import { setTimeout, clearTimeout } from "node:timers";
import { appendWalletMovement, InsufficientWalletBalance } from "../wallet/wallet-ledger.ts";
import type {
  CancelBookingInput,
  CreateBookingInput,
  RescheduleBookingInput,
  TutorCancelBookingInput,
} from "./booking.schema.ts";

// Best-effort notifications may continue after the response, but cannot delay it indefinitely.
// allSettled also consumes late rejections after the timeout; this is not a durable queue.
export async function waitForBookingNotifications(notifications: Promise<unknown>[]) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.allSettled(notifications).then((results) => {
        for (const [index, result] of results.entries()) {
          if (result.status === "rejected") {
            // Do not log recipient data or raw errors that may contain private details.
            console.warn("[notification:booking] Notification failed", { recipientIndex: index });
          }
        }
      }),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, 1000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

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

// Approved BOOK-3 defaults; deployments may explicitly configure a different policy.
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
  | "BOOKING_NOT_COMPLETABLE"
  | "BOOKING_ALREADY_COMPLETED"
  | "BOOKING_CANCELLED"
  | "BOOKING_NOT_RESCHEDULABLE"
  | "MEETING_LINK_NOT_EDITABLE"
  | "PAYMENT_NOT_FOUND"
  | "INSUFFICIENT_BALANCE"
  | "CANCELLATION_QUOTE_CHANGED";

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
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
          currentProfileVersion: { select: { avatarUrl: true, ...publicPortfolioSelect } },
        },
      },
    },
  },
  availabilities: { orderBy: { startedAt: "asc" as const } },
  walletTransactions: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.BookingInclude;

type BookingDetailRecord = Prisma.BookingGetPayload<{ include: typeof detailInclude }>;
type QuoteSource = Pick<
  BookingDetailRecord,
  "id" | "status" | "totalAmount" | "startedAt" | "walletTransactions"
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
export function cancellationRefund(amount: Prisma.Decimal, startsAt: Date, now = new Date()) {
  const policyMs = CANCELLATION_POLICY_WINDOW_HOURS * 60 * 60_000;
  const late = startsAt.getTime() - now.getTime() <= policyMs;
  const rate = late ? LATE_CANCELLATION_REFUND_RATE : 1;
  return { late, rate, amount: amount.mul(rate).toDecimalPlaces(2) };
}

function quoteFor(booking: QuoteSource, now: Date) {
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

export function mapBookingResponse(
  booking: BookingDetailRecord,
  viewerUserId: string,
  now = new Date()
) {
  const isStudent = booking.userId === viewerUserId;
  const isTutor = booking.subject.tutor.user?.id === viewerUserId;
  const effectiveMeetingUrl = booking.customMeetingUrl ?? booking.zoomMeetingUrl;
  const transfer = booking.walletTransactions.find((payment) => payment.type === "LESSON_PAYMENT");
  const amountDue = booking.status === "PENDING_PAYMENT" ? booking.totalAmount : ZERO;
  const walletBalance = booking.user.balance;
  const shortfall = amountDue.greaterThan(walletBalance) ? amountDue.minus(walletBalance) : ZERO;
  // A pending paid lesson needs a deadline; a legacy/null pending row is never payable.
  const beforeDeadline =
    booking.paymentExpiresAt !== null && booking.paymentExpiresAt.getTime() > now.getTime();
  const beforeLesson = booking.startedAt.getTime() > now.getTime();
  const payEligible =
    isStudent &&
    booking.status === "PENDING_PAYMENT" &&
    !transfer &&
    beforeDeadline &&
    beforeLesson;
  const canPay = payEligible && shortfall.isZero();
  const canCancel =
    isStudent && ["PENDING_PAYMENT", "CONFIRMED"].includes(booking.status) && beforeLesson;
  const canReschedule =
    isStudent &&
    booking.status === "CONFIRMED" &&
    booking.startedAt.getTime() - now.getTime() > CANCELLATION_POLICY_WINDOW_HOURS * 60 * 60_000;
  // BOOK-4 lets the tutor cancel any class that has not started, including payment holds.
  const canTutorCancel =
    isTutor && ["PENDING_PAYMENT", "CONFIRMED"].includes(booking.status) && beforeLesson;
  const beforeLessonEnd = booking.endedAt.getTime() > now.getTime();
  const canConfirmCompletion =
    isTutor && booking.status === "CONFIRMED" && booking.endedAt.getTime() <= now.getTime();
  const canEditMeetingLink = isTutor && booking.status === "CONFIRMED" && beforeLessonEnd;
  const canJoin = booking.status === "CONFIRMED" && Boolean(effectiveMeetingUrl) && beforeLessonEnd;

  return {
    id: booking.id,
    status: booking.status,
    viewerRole: isStudent ? ("STUDENT" as const) : ("TUTOR" as const),
    description: booking.description,
    zoomMeetingUrl: booking.zoomMeetingUrl,
    customMeetingUrl: booking.customMeetingUrl,
    effectiveMeetingUrl,
    meetingLinkUpdatedAt: booking.meetingLinkUpdatedAt?.toISOString() ?? null,
    createdAt: booking.createdAt.toISOString(),
    isTrial: booking.isTrial,
    totalAmount: decimalString(booking.totalAmount),
    startedAt: booking.startedAt.toISOString(),
    endedAt: booking.endedAt.toISOString(),
    paymentExpiresAt: booking.paymentExpiresAt?.toISOString() ?? null,
    cancelledAt: booking.cancelledAt?.toISOString() ?? null,
    cancellationReason: booking.cancellationReason,
    cancelledBy: booking.cancelledBy,
    student: {
      id: booking.user.id,
      name: `${booking.user.firstName} ${booking.user.lastName}`,
    },
    subject: {
      id: booking.subject.id,
      name: booking.subjectName ?? booking.subject.name,
      description:
        booking.subjectName == null ? booking.subject.description : booking.subjectDescription,
      hourlyRate: decimalString(booking.subjectHourlyRate ?? booking.subject.hourlyRate),
      format: booking.subjectFormat ?? booking.subject.format,
      tutor: {
        id: booking.subject.tutor.id,
        name: booking.subject.tutor.user
          ? `${booking.subject.tutor.user.firstName} ${booking.subject.tutor.user.lastName}`
          : "Tutor",
        avatarUrl: booking.subject.tutor.currentProfileVersion.avatarUrl,
        certificationUrls: publicCertificationUrls(booking.subject.tutor.currentProfileVersion),
      },
    },
    availabilities: booking.availabilities.map((slot) => ({
      id: slot.id,
      startedAt: slot.startedAt.toISOString(),
    })),
    payment: {
      // Compatibility display value only; ledger rows have no status.
      status: transfer ? "COMPLETED" : booking.status === "PENDING_PAYMENT" ? "PENDING" : null,
      amountDue: decimalString(amountDue),
      walletBalance: isStudent ? decimalString(walletBalance) : null,
      shortfall: isStudent ? decimalString(shortfall) : null,
      canPay,
      expiresAt: booking.paymentExpiresAt?.toISOString() ?? null,
    },
    actions: {
      canPay: payEligible,
      canCancel,
      canReschedule,
      canTutorCancel,
      canEditMeetingLink,
      canJoin,
      canConfirmCompletion,
    },
  };
}

function isSerializationError(error: unknown) {
  return isTransactionConflict(error);
}

async function loadDetail(id: string) {
  return prisma.booking.findUnique({ where: { id }, include: detailInclude });
}

// Lazily expires abandoned payment-due bookings before relevant reads and writes.
export async function releaseExpiredBookings(
  now = new Date(),
  filter: { id?: string; userId?: string; subjectId?: string; tutorId?: string } = {}
) {
  const { tutorId, ...bookingFilter } = filter;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const expired = await tx.booking.findMany({
            where: {
              ...bookingFilter,
              ...(tutorId ? { subject: { tutorId } } : {}),
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
            isTrial: input.isTrial,
            totalAmount: amount,
            startedAt: slots[0]!.startedAt,
            endedAt: new Date(slots.at(-1)!.startedAt.getTime() + SLOT_MS),
            // Zero-priced legacy bookings bypass payment and its notifications; new rates are positive.
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

export async function listBookings(userId: string) {
  const now = new Date();
  await releaseExpiredBookings(now, { userId });
  const bookings = await prisma.booking.findMany({
    where: { userId },
    include: detailInclude,
    orderBy: [{ startedAt: "desc" }, { id: "desc" }],
  });
  return bookings.map((booking) => mapBookingResponse(booking, userId, now));
}

export async function confirmBookingPayment(userId: string, id: string) {
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
        const booking = await tx.booking.findUnique({ where: { id } });
        if (!booking) throw new BookingNotFoundError();
        if (booking.userId !== userId)
          throw new BookingForbiddenError("You cannot reschedule this booking");
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
            // A generated room belongs to the old schedule; the CLASS-1 override is retained.
            zoomMeetingUrl: null,
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
  return quoteFor(booking, now);
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

        const quote = quoteFor(booking, transactionNow);
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
          // Keep the original payment immutable; refund from Platform and retain the quoted fee.
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
    if (error instanceof BookingDomainError || !isSerializationError(error)) throw error;
    throw new BookingConflictError("BOOKING_NOT_CANCELLABLE", "Booking was already cancelled");
  }
}

// BOOK-4 lists the tutor's classes that have not started, so a tutor can open one to cancel it.
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

// CLASS-2 changes only BookingStatus; earnings and review effects belong to CLASS-3.
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
    if (error instanceof BookingDomainError || !isSerializationError(error)) throw error;
    throw new BookingConflictError(
      "BOOKING_NOT_COMPLETABLE",
      "This lesson was already changed and can no longer be confirmed"
    );
  }

  if (!completed) throw new BookingNotFoundError();
  return mapBookingResponse(completed, userId);
}

// BOOK-4: a tutor cancellation always refunds the full payment; the window only adds a warning.
function tutorQuoteFor(booking: QuoteSource, now: Date) {
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
  return tutorQuoteFor(booking, now);
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

        const quote = tutorQuoteFor(booking, transactionNow);
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
          // The student gets the full payment back; the original payment row stays unchanged.
          refund = new Prisma.Decimal(quote.refundAmount);
          await appendWalletMovement(tx, {
            userId: booking.userId,
            type: "REFUND",
            amount: refund,
            bookingId: id,
          });
        }
        // The tutor said they cannot teach then, so the freed slots stay closed until reopened.
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
    if (error instanceof BookingDomainError || !isSerializationError(error)) throw error;
    throw new BookingConflictError("BOOKING_NOT_CANCELLABLE", "Booking was already cancelled");
  }
  // Notify only after commit; a failed email must not undo the cancellation.
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
