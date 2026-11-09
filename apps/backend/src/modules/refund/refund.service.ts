import {
  Prisma,
  type RefundRequest,
  type RefundRequestStatus,
} from "../../generated/prisma/client.ts";
import { prisma } from "../../lib/db.ts";
import { isTransactionConflict } from "../../lib/transaction-conflict.ts";
import { getBooking } from "../booking/booking.service.ts";
import { appendWalletMovement } from "../wallet/wallet-ledger.ts";
import { refundBlock, refundBlockMessages, type RefundBlockCode } from "./refund.policy.ts";
import type { CreateRefundRequestInput, RefundReviewInput } from "./refund.schema.ts";

// PAY-3: a Student asks for a refund any time after paying. A Tutor no-show (once the lesson
// has started) is refunded in full at once; an unsatisfactory lesson waits for an admin. Every approved
// request appends one REFUND row for the full paid amount and cancels the booking in the same
// serializable transaction, so the Tutor's pending earning disappears with it.

export type RefundErrorCode =
  | RefundBlockCode
  | "BOOKING_NOT_FOUND"
  | "BOOKING_FORBIDDEN"
  | "ADMIN_REQUIRED"
  | "REFUND_NOT_FOUND"
  | "REFUND_NOT_PENDING"
  | "REFUND_SELF_REVIEW"
  | "REFUND_RETRY";

export class RefundDomainError extends Error {
  constructor(
    public readonly code: RefundErrorCode,
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "RefundDomainError";
  }
}

const blockStatus: Record<RefundBlockCode, number> = {
  REFUND_ALREADY_REQUESTED: 409,
  REFUND_LESSON_COMPLETED: 409,
  REFUND_NOT_ELIGIBLE: 409,
  REFUND_NO_SHOW_TOO_EARLY: 409,
};

function blocked(code: RefundBlockCode) {
  return new RefundDomainError(code, refundBlockMessages[code], blockStatus[code]);
}

const serializable = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable };

// Retries a serializable transaction that lost a race; the retry re-reads the new state.
async function withRetry<T>(work: () => Promise<T>) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await work();
    } catch (error) {
      if (attempt < 2 && isTransactionConflict(error)) continue;
      throw error;
    }
  }
  throw new RefundDomainError("REFUND_RETRY", "Please try again in a moment", 409);
}

// Approving cancels the still-confirmed booking and returns the full paid amount.
async function refundBooking(tx: Prisma.TransactionClient, request: RefundRequest, now: Date) {
  const cancelled = await tx.booking.updateMany({
    where: { id: request.bookingId, status: "CONFIRMED" },
    data: { status: "CANCELLED", cancelledAt: now, paymentExpiresAt: null },
  });
  if (cancelled.count !== 1) throw blocked("REFUND_NOT_ELIGIBLE");
  // A request approved before the lesson frees its slots, like a Student cancellation.
  await tx.availability.updateMany({
    where: { bookingId: request.bookingId },
    data: { bookingId: null },
  });
  await appendWalletMovement(tx, {
    userId: request.userId,
    type: "REFUND",
    amount: request.amount,
    bookingId: request.bookingId,
  });
}

export async function createRefundRequest(
  userId: string,
  bookingId: string,
  input: CreateRefundRequestInput
) {
  await withRetry(() =>
    prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: {
          refundRequest: { select: { id: true } },
          walletTransactions: { where: { type: "LESSON_PAYMENT" }, take: 1 },
        },
      });
      const now = new Date();
      if (!booking) throw new RefundDomainError("BOOKING_NOT_FOUND", "Booking not found", 404);
      if (booking.userId !== userId)
        throw new RefundDomainError(
          "BOOKING_FORBIDDEN",
          "Only the Student who booked this lesson can request a refund",
          403
        );
      const payment = booking.walletTransactions[0];
      const code = refundBlock(
        {
          status: booking.status,
          startedAt: booking.startedAt,
          paid: Boolean(payment),
          hasRequest: booking.refundRequest !== null,
        },
        now,
        input.reason
      );
      if (code) throw blocked(code);

      const noShow = input.reason === "TUTOR_NO_SHOW";
      let request: RefundRequest;
      try {
        request = await tx.refundRequest.create({
          data: {
            bookingId,
            userId,
            reason: input.reason,
            details: input.details || null,
            amount: payment!.amount,
            // AC1: a Tutor no-show is approved immediately; anything else waits for an admin.
            status: noShow ? "APPROVED" : "PENDING",
            reviewedAt: noShow ? now : null,
          },
        });
      } catch (error) {
        if ((error as { code?: string }).code === "P2002")
          throw blocked("REFUND_ALREADY_REQUESTED");
        throw error;
      }
      if (noShow) await refundBooking(tx, request, now);
    }, serializable)
  );
  return getBooking(userId, bookingId);
}

const reviewInclude = {
  user: { select: { id: true, firstName: true, lastName: true, email: true } },
  booking: {
    select: {
      id: true,
      startedAt: true,
      endedAt: true,
      status: true,
      subjectName: true,
      subject: {
        select: {
          name: true,
          tutor: { select: { user: { select: { id: true, firstName: true, lastName: true } } } },
        },
      },
    },
  },
} satisfies Prisma.RefundRequestInclude;

type ReviewRecord = Prisma.RefundRequestGetPayload<{ include: typeof reviewInclude }>;

function adminRefundResponse(request: ReviewRecord) {
  const tutor = request.booking.subject.tutor.user;
  return {
    id: request.id,
    reason: request.reason,
    details: request.details,
    status: request.status,
    amount: request.amount.toFixed(2),
    createdAt: request.createdAt.toISOString(),
    reviewedAt: request.reviewedAt?.toISOString() ?? null,
    rejectionReason: request.rejectionReason,
    // A no-show is approved by the system when filed, so it has no reviewing admin.
    reviewedByAdmin: request.reviewedById !== null,
    student: request.user,
    booking: {
      id: request.booking.id,
      status: request.booking.status,
      subjectName: request.booking.subjectName ?? request.booking.subject.name,
      tutorName: tutor ? `${tutor.firstName} ${tutor.lastName}` : "Tutor",
      startedAt: request.booking.startedAt.toISOString(),
      endedAt: request.booking.endedAt.toISOString(),
    },
  };
}

async function requireAdmin(client: Prisma.TransactionClient, adminId: string) {
  const user = await client.user.findUnique({ where: { id: adminId }, select: { isAdmin: true } });
  if (!user?.isAdmin)
    throw new RefundDomainError("ADMIN_REQUIRED", "Administrator access required", 403);
}

export async function listRefundsForReview(adminId: string, status?: RefundRequestStatus) {
  await requireAdmin(prisma, adminId);
  const requests = await prisma.refundRequest.findMany({
    where: { status },
    // Pending requests are reviewed oldest first; history shows the newest first.
    orderBy: !status
      ? [{ status: "asc" }, { createdAt: "desc" }]
      : status === "PENDING"
        ? [{ createdAt: "asc" }]
        : [{ createdAt: "desc" }],
    take: 100,
    include: reviewInclude,
  });
  return { requests: requests.map(adminRefundResponse) };
}

export async function reviewRefund(adminId: string, id: string, input: RefundReviewInput) {
  return withRetry(() =>
    prisma.$transaction(async (tx) => {
      await requireAdmin(tx, adminId);
      const request = await tx.refundRequest.findUnique({ where: { id }, include: reviewInclude });
      if (!request)
        throw new RefundDomainError("REFUND_NOT_FOUND", "Refund request not found", 404);
      // An admin who is a party to the lesson cannot decide its refund.
      if (request.userId === adminId || request.booking.subject.tutor.user?.id === adminId)
        throw new RefundDomainError(
          "REFUND_SELF_REVIEW",
          "Another admin has to review a refund for your own lesson",
          403
        );
      const now = new Date();
      const reviewed = await tx.refundRequest.updateMany({
        where: { id, status: "PENDING" },
        data: {
          status: input.decision,
          reviewedAt: now,
          reviewedById: adminId,
          rejectionReason: input.decision === "REJECTED" ? input.rejectionReason! : null,
        },
      });
      if (reviewed.count !== 1)
        throw new RefundDomainError(
          "REFUND_NOT_PENDING",
          "This refund request is no longer pending",
          409
        );
      if (input.decision === "APPROVED") await refundBooking(tx, request, now);
      return adminRefundResponse(
        await tx.refundRequest.findUniqueOrThrow({ where: { id }, include: reviewInclude })
      );
    }, serializable)
  );
}
