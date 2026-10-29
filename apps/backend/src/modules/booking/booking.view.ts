import { Prisma } from "../../generated/prisma/client.ts";
import { publicCertificationUrls, publicPortfolioSelect } from "../profile/profile.public.ts";
import { CANCELLATION_POLICY_WINDOW_HOURS, decimalString, ZERO } from "./booking.policy.ts";

export const detailInclude = {
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

export type BookingDetailRecord = Prisma.BookingGetPayload<{ include: typeof detailInclude }>;

export function mapBookingResponse(
  booking: BookingDetailRecord,
  viewerUserId: string,
  now = new Date()
) {
  const isStudent = booking.userId === viewerUserId;
  const isTutor = booking.subject.tutor.user?.id === viewerUserId;
  const transfer = booking.walletTransactions.find((payment) => payment.type === "LESSON_PAYMENT");
  const amountDue = booking.status === "PENDING_PAYMENT" ? booking.totalAmount : ZERO;
  const walletBalance = booking.user.balance;
  const shortfall = amountDue.greaterThan(walletBalance) ? amountDue.minus(walletBalance) : ZERO;
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
  const canTutorCancel =
    isTutor && ["PENDING_PAYMENT", "CONFIRMED"].includes(booking.status) && beforeLesson;

  return {
    id: booking.id,
    status: booking.status,
    viewerRole: isStudent ? ("STUDENT" as const) : ("TUTOR" as const),
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
      status: transfer ? "COMPLETED" : booking.status === "PENDING_PAYMENT" ? "PENDING" : null,
      amountDue: decimalString(amountDue),
      walletBalance: isStudent ? decimalString(walletBalance) : null,
      shortfall: isStudent ? decimalString(shortfall) : null,
      canPay,
      expiresAt: booking.paymentExpiresAt?.toISOString() ?? null,
    },
    actions: { canPay: payEligible, canCancel, canReschedule, canTutorCancel },
  };
}
