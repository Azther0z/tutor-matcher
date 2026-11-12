import type { Prisma, RefundRequest, RefundRequestStatus } from "../../generated/prisma/client.ts";
import { prisma } from "../../lib/db.ts";
import { runSerializable } from "../../lib/serializable.ts";
import { getBooking, waitForBookingNotifications } from "../booking/booking.service.ts";
import { notifyUser } from "../notification/notification.service.ts";
import { appendWalletMovement } from "../wallet/wallet-ledger.ts";
import { refundBlock, refundBlockMessages, type RefundBlockCode } from "./refund.policy.ts";
import type { CreateRefundRequestInput, RefundReviewInput } from "./refund.schema.ts";

// PAY-3: a Student asks for a refund once the lesson's scheduled end has passed. Every request
// waits for an admin. Approval appends one REFUND row for the full paid amount, links it to the
// request and cancels the booking in the same serializable transaction, so the Tutor's pending
// earning disappears with it.

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

// Every reason a refund cannot be requested is a conflict with the booking's current state.
const BLOCKED_STATUS = 409;

function blocked(code: RefundBlockCode) {
  return new RefundDomainError(code, refundBlockMessages[code], BLOCKED_STATUS);
}

const retryError = () => new RefundDomainError("REFUND_RETRY", "Please try again in a moment", 409);

// Approving cancels the paid booking, returns the full amount and links the REFUND row.
async function refundBooking(tx: Prisma.TransactionClient, request: RefundRequest, now: Date) {
  const cancelled = await tx.booking.updateMany({
    where: { id: request.bookingId, status: { in: ["CONFIRMED", "COMPLETED"] } },
    data: { status: "CANCELLED", cancelledAt: now, paymentExpiresAt: null },
  });
  if (cancelled.count !== 1) throw blocked("REFUND_NOT_ELIGIBLE");
  const refund = await appendWalletMovement(tx, {
    userId: request.userId,
    type: "REFUND",
    amount: request.amount,
    bookingId: request.bookingId,
  });
  await tx.refundRequest.update({
    where: { id: request.id },
    data: { walletTransactionId: refund?.id ?? null },
  });
}

export async function createRefundRequest(
  userId: string,
  bookingId: string,
  input: CreateRefundRequestInput
) {
  const filed = await runSerializable(
    async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: {
          refundRequest: { select: { id: true } },
          walletTransactions: { where: { type: "LESSON_PAYMENT" }, take: 1 },
          subject: {
            select: { name: true, tutor: { select: { user: { select: { id: true } } } } },
          },
        },
      });
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
          endedAt: booking.endedAt,
          paid: Boolean(payment),
          hasRequest: booking.refundRequest !== null,
        },
        new Date()
      );
      if (code) throw blocked(code);

      try {
        await tx.refundRequest.create({
          data: {
            bookingId,
            userId,
            reason: input.reason,
            details: input.details || null,
            amount: payment!.amount,
          },
        });
      } catch (error) {
        if ((error as { code?: string }).code === "P2002")
          throw blocked("REFUND_ALREADY_REQUESTED");
        throw error;
      }
      return {
        tutorUserId: booking.subject.tutor.user?.id ?? null,
        subjectName: booking.subjectName ?? booking.subject.name,
        startedAt: booking.startedAt,
      };
    },
    { retryError }
  );

  // Tell the Tutor after the request commits; a failed email never fails the request.
  if (filed.tutorUserId)
    await waitForBookingNotifications([
      notifyUser(filed.tutorUserId, {
        eventType: "booking",
        details: { subjectName: filed.subjectName, scheduledAt: filed.startedAt },
      }),
    ]);
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
  return runSerializable(
    async (tx) => {
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
    },
    { retryError }
  );
}
