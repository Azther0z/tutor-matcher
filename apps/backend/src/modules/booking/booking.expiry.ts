import { Prisma } from "../../generated/prisma/client.ts";
import { prisma } from "../../lib/db.ts";
import { isTransactionConflict } from "../../lib/transaction-conflict.ts";

export type ExpiryFilter = {
  id?: string;
  userId?: string;
  subjectId?: string;
  tutorId?: string;
};

// Lazily expires abandoned holds with a fixed number of queries per batch.
export async function releaseExpiredBookings(now = new Date(), filter: ExpiryFilter = {}) {
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
          const ids = expired.map(({ id }) => id);
          if (ids.length === 0) return 0;

          const claimed = await tx.booking.updateMany({
            where: {
              id: { in: ids },
              status: "PENDING_PAYMENT",
              OR: [{ paymentExpiresAt: { lte: now } }, { paymentExpiresAt: null }],
            },
            data: {
              status: "CANCELLED",
              cancelledAt: now,
              cancellationReason: "PAYMENT_EXPIRED",
            },
          });
          await tx.availability.updateMany({
            where: {
              bookingId: { in: ids },
              booking: {
                status: "CANCELLED",
                cancellationReason: "PAYMENT_EXPIRED",
                cancelledAt: now,
              },
            },
            data: { bookingId: null },
          });
          return claimed.count;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } catch (error) {
      if (!isTransactionConflict(error) || attempt === 1) throw error;
    }
  }
  return 0;
}
