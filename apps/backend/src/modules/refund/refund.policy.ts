import type { BookingStatus, RefundRequest } from "../../generated/prisma/client.ts";

// PAY-3: a Student may ask for a refund of a paid lesson once its scheduled end has passed,
// with no deadline, whether or not the Tutor has confirmed it. Every request waits for an
// admin, because a Student's account of the lesson cannot be verified automatically.

export type RefundBlockCode =
  "REFUND_ALREADY_REQUESTED" | "REFUND_NOT_ELIGIBLE" | "REFUND_LESSON_NOT_ENDED";

export const refundBlockMessages: Record<RefundBlockCode, string> = {
  REFUND_ALREADY_REQUESTED: "You already requested a refund for this lesson.",
  REFUND_NOT_ELIGIBLE: "Only paid lessons that were not cancelled can be refunded.",
  REFUND_LESSON_NOT_ENDED: "You can request a refund after the lesson's scheduled end.",
};

export type RefundEligibilitySource = {
  status: BookingStatus;
  endedAt: Date;
  paid: boolean;
  hasRequest: boolean;
};

// Returns why a refund cannot be requested now, or null when the Student may file one.
export function refundBlock(booking: RefundEligibilitySource, now: Date): RefundBlockCode | null {
  if (booking.hasRequest) return "REFUND_ALREADY_REQUESTED";
  if (!["CONFIRMED", "COMPLETED"].includes(booking.status) || !booking.paid)
    return "REFUND_NOT_ELIGIBLE";
  if (booking.endedAt.getTime() > now.getTime()) return "REFUND_LESSON_NOT_ENDED";
  return null;
}

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
