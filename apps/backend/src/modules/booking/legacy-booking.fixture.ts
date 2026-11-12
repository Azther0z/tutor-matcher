// Test-only fixture for records created before atomic wallet booking.
import { prisma } from "../../lib/db.ts";
import { subjectSnapshot } from "../subject/subject.public.ts";

export async function createLegacyPendingBooking(
  userId: string,
  subjectId: string,
  slotId: string
) {
  const subject = await prisma.subject.findUniqueOrThrow({ where: { id: subjectId } });
  const slot = await prisma.availability.findUniqueOrThrow({ where: { id: slotId } });
  return prisma.booking.create({
    data: {
      userId,
      subjectId,
      ...subjectSnapshot(subject),
      totalAmount: subject.hourlyRate.div(2),
      startedAt: slot.startedAt,
      endedAt: new Date(slot.startedAt.getTime() + 30 * 60_000),
      status: "PENDING_PAYMENT",
      paymentExpiresAt: new Date(Date.now() + 15 * 60_000),
      availabilities: { connect: { id: slotId } },
    },
  });
}
