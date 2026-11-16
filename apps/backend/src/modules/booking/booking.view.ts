import { Prisma } from "../../generated/prisma/client.ts";
import { publicCertificationUrls, publicPortfolioSelect } from "../profile/profile.public.ts";
import {
  lessonEarningClearsAt,
  lessonEarningHoldReason,
} from "../wallet/earning-settlement.service.ts";
import { tutorShare } from "../wallet/wallet.service.ts";
import { refundBlock, refundRequestResponse } from "../refund/refund.policy.ts";
import { decimalString, ZERO } from "./booking.policy.ts";

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
  refundRequest: true,
  review: {
    select: {
      id: true,
      ratingStars: true,
      text: true,
      createdAt: true,
      removedAt: true,
      removalReason: true,
    },
  },
} satisfies Prisma.BookingInclude;

export type BookingDetailRecord = Prisma.BookingGetPayload<{ include: typeof detailInclude }>;

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
  const canReschedule = false;
  // BOOK-4 lets the tutor cancel any class that has not started, including payment holds.
  const canTutorCancel =
    isTutor && ["PENDING_PAYMENT", "CONFIRMED"].includes(booking.status) && beforeLesson;
  const beforeLessonEnd = booking.endedAt.getTime() > now.getTime();
  // PAY-3: while an admin reviews the Student's refund request, the Tutor cannot complete it.
  const refundUnderReview = booking.refundRequest?.status === "PENDING";
  const canConfirmCompletion =
    isTutor &&
    booking.status === "CONFIRMED" &&
    booking.endedAt.getTime() <= now.getTime() &&
    !refundUnderReview;
  const canEditMeetingLink = isTutor && booking.status === "CONFIRMED" && beforeLessonEnd;
  const canJoin = booking.status === "CONFIRMED" && Boolean(effectiveMeetingUrl) && beforeLessonEnd;
  const canReview = isStudent && booking.status === "COMPLETED" && booking.review === null;
  const earning = booking.walletTransactions.find((entry) => entry.type === "LESSON_EARNING");
  const earningsVisibleToTutor =
    isTutor &&
    Boolean(transfer) &&
    (["CONFIRMED", "COMPLETED"].includes(booking.status) || Boolean(earning));
  const clearsAt = lessonEarningClearsAt(booking.endedAt);
  const refundBlockCode = refundBlock(
    {
      status: booking.status,
      endedAt: booking.endedAt,
      paid: Boolean(transfer),
      hasRequest: booking.refundRequest !== null,
    },
    now
  );
  // PAY-3: the Student may ask an admin for a refund once the lesson's scheduled end passes.
  const canRequestRefund = isStudent && refundBlockCode === null;

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
    earnings: earningsVisibleToTutor
      ? {
          amount: decimalString(earning?.amount ?? tutorShare(booking.totalAmount)),
          status: earning ? ("CLEARED" as const) : ("PENDING" as const),
          clearsAt: clearsAt.toISOString(),
          holdReason: earning
            ? null
            : lessonEarningHoldReason(
                booking.status,
                booking.endedAt,
                booking.refundRequest?.status ?? null,
                now
              ),
        }
      : null,
    startedAt: booking.startedAt.toISOString(),
    endedAt: booking.endedAt.toISOString(),
    paymentExpiresAt: booking.paymentExpiresAt?.toISOString() ?? null,
    cancelledAt: booking.cancelledAt?.toISOString() ?? null,
    cancellationReason: booking.cancellationReason,
    cancelledBy: booking.cancelledBy,
    refundRequest: booking.refundRequest
      ? refundRequestResponse(booking.refundRequest, isStudent)
      : null,
    // REV-1: the published review is public, so both participants may see it here.
    review: booking.review
      ? {
          id: booking.review.id,
          rating: booking.review.ratingStars,
          // REV-4: a removed review keeps its row, so it still blocks a second review; the
          // participants see why it was removed instead of its comment.
          comment: booking.review.removedAt ? null : booking.review.text,
          createdAt: booking.review.createdAt.toISOString(),
          removed: booking.review.removedAt
            ? {
                reason: booking.review.removalReason ?? "",
                removedAt: booking.review.removedAt.toISOString(),
              }
            : null,
        }
      : null,
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
    actions: {
      canPay: payEligible,
      canCancel,
      canReschedule,
      canTutorCancel,
      canEditMeetingLink,
      canJoin,
      canConfirmCompletion,
      canReview,
      canRequestRefund,
    },
  };
}
