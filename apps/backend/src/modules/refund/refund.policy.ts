import type {
  BookingStatus,
  RefundRequest,
  RefundRequestReason,
} from "../../generated/prisma/client.ts";

// PAY-3: a Student may ask for a refund at any time after the lesson payment succeeds, with
// no deadline. A Tutor no-show can only be reported once the lesson has started; before that
// only an admin-reviewed request is possible, so the BOOK-3 cancellation rate still applies.

export type RefundBlockCode =
  | "REFUND_ALREADY_REQUESTED"
  | "REFUND_LESSON_COMPLETED"
  | "REFUND_NOT_ELIGIBLE"
  | "REFUND_NO_SHOW_TOO_EARLY";

export const refundBlockMessages: Record<RefundBlockCode, string> = {
  REFUND_ALREADY_REQUESTED: "You already requested a refund for this lesson.",
  REFUND_LESSON_COMPLETED:
    "Your Tutor confirmed this lesson was completed, so it can't be refunded.",
  REFUND_NOT_ELIGIBLE: "Only paid lessons that were not cancelled can be refunded.",
  REFUND_NO_SHOW_TOO_EARLY: "You can report that your tutor didn't show up once the lesson starts.",
};

export type RefundEligibilitySource = {
  status: BookingStatus;
  startedAt: Date;
  paid: boolean;
  hasRequest: boolean;
};

// Returns why a refund cannot be requested now, or null when the Student may file one.
// Pass a reason to also check whether that reason is allowed yet.
export function refundBlock(
  booking: RefundEligibilitySource,
  now: Date,
  reason?: RefundRequestReason
): RefundBlockCode | null {
  if (booking.hasRequest) return "REFUND_ALREADY_REQUESTED";
  if (booking.status === "COMPLETED") return "REFUND_LESSON_COMPLETED";
  if (booking.status !== "CONFIRMED" || !booking.paid) return "REFUND_NOT_ELIGIBLE";
  if (reason === "TUTOR_NO_SHOW" && !canReportNoShow(booking, now))
    return "REFUND_NO_SHOW_TOO_EARLY";
  return null;
}

export function canReportNoShow(booking: Pick<RefundEligibilitySource, "startedAt">, now: Date) {
  return booking.startedAt.getTime() <= now.getTime();
}

// A cancellation refunds the booking its own way, so a pending request is closed with this reason.
export const CANCELLED_REFUND_REJECTION =
  "The lesson was cancelled, so its cancellation refund applies instead.";

// The Student sees everything they wrote; the Tutor sees only that a request exists and its outcome.
export function refundRequestResponse(request: RefundRequest, forStudent: boolean) {
  return {
    id: request.id,
    reason: request.reason,
    status: request.status,
    amount: request.amount.toFixed(2),
    createdAt: request.createdAt.toISOString(),
    reviewedAt: request.reviewedAt?.toISOString() ?? null,
    details: forStudent ? request.details : null,
    rejectionReason: forStudent ? request.rejectionReason : null,
  };
}
