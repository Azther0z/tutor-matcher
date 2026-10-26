import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { randomUUID } from "node:crypto";
import { URL } from "node:url";
import { prisma } from "../../lib/db.ts";
import { appendWalletMovement } from "../wallet/wallet-ledger.ts";
import { confirmTopup } from "../wallet/wallet.service.ts";
import { createBooking, confirmBookingPayment } from "./booking.service.ts";

const databaseDescribe = process.env.RUN_DATABASE_INTEGRATION === "true" ? describe : describe.skip;

if (process.env.RUN_DATABASE_INTEGRATION === "true") {
  const target = new URL(process.env.DATABASE_URL ?? "");
  if (
    target.hostname !== "127.0.0.1" ||
    target.port !== "55434" ||
    target.pathname !== "/auth4_test"
  ) {
    throw new Error(
      "BOOK-8 acceptance requires the isolated auth4_test database on 127.0.0.1:55434"
    );
  }
}

databaseDescribe("BOOK-8 wallet and slot acceptance", () => {
  const studentId = randomUUID();
  const otherId = randomUUID();
  const tutorUserId = randomUUID();
  let tutorId: string;
  let subjectId: string;
  let profileId: string;
  let slotId: string;

  beforeAll(async () => {
    for (const id of [studentId, otherId, tutorUserId]) {
      await prisma.user.create({
        data: {
          id,
          firstName: "Book8",
          lastName: "Fixture",
          email: `${id}@example.com`,
          password: "fixture",
        },
      });
    }
    const tutor = await prisma.tutor.create({
      data: {
        status: "PUBLISHED",
        currentProfileVersion: { create: { userId: tutorUserId, status: "APPROVED" } },
      },
    });
    tutorId = tutor.id;
    profileId = tutor.currentProfileVersionId;
    await prisma.user.update({ where: { id: tutorUserId }, data: { tutorId } });
    const subject = await prisma.subject.create({
      data: { tutorId, name: "BOOK-8 Acceptance", hourlyRate: "400.00" },
    });
    subjectId = subject.id;
    const slot = await prisma.availability.create({
      data: {
        tutorId,
        startedAt: new Date(Date.now() + 7 * 86400000),
        availabilitySubjects: { create: { subjectId } },
      },
    });
    slotId = slot.id;
    await prisma.$transaction(
      (tx) => appendWalletMovement(tx, { userId: studentId, type: "TOP_UP", amount: 50 }),
      { isolationLevel: "Serializable" }
    );
  });

  afterAll(async () => {
    await prisma.walletTransaction.deleteMany({ where: { userId: { in: [studentId, otherId] } } });
    if (tutorId) {
      await prisma.availabilitySubject.deleteMany({ where: { availability: { tutorId } } });
      await prisma.availability.deleteMany({ where: { tutorId } });
    }
    await prisma.booking.deleteMany({ where: { userId: { in: [studentId, otherId] } } });
    if (subjectId) await prisma.subject.delete({ where: { id: subjectId } });
    await prisma.user.updateMany({ where: { id: tutorUserId }, data: { tutorId: null } });
    if (tutorId) await prisma.tutor.delete({ where: { id: tutorId } });
    if (profileId) await prisma.tutorProfileVersion.delete({ where: { id: profileId } });
    await prisma.user.deleteMany({ where: { id: { in: [studentId, otherId, tutorUserId] } } });
  });

  it("tops up only the shortfall, confirms once and prevents another student taking the slot", async () => {
    const booking = await createBooking(studentId, {
      subjectId,
      availabilityIds: [slotId],
      isTrial: true,
    });
    expect(booking.status).toBe("PENDING_PAYMENT");
    expect(booking.totalAmount).toBe("200.00");
    expect(await prisma.walletTransaction.count({ where: { bookingId: booking.id } })).toBe(0);
    await expect(confirmBookingPayment(studentId, booking.id)).rejects.toMatchObject({
      code: "INSUFFICIENT_BALANCE",
    });
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: studentId } })).balance.toFixed(2)
    ).toBe("50.00");
    await expect(
      createBooking(otherId, { subjectId, availabilityIds: [slotId], isTrial: true })
    ).rejects.toMatchObject({ code: "SLOT_TAKEN" });
    expect(await prisma.booking.count({ where: { userId: otherId } })).toBe(0);
    await confirmTopup(studentId, {
      amount: 150,
      reference: randomUUID(),
      simulation: "confirmed",
    });
    const paid = await confirmBookingPayment(studentId, booking.id);
    expect(paid.status).toBe("CONFIRMED");
    expect((await prisma.availability.findUniqueOrThrow({ where: { id: slotId } })).bookingId).toBe(
      booking.id
    );
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: studentId } })).balance.toFixed(2)
    ).toBe("0.00");
    await expect(confirmBookingPayment(studentId, booking.id)).rejects.toMatchObject({
      code: "BOOKING_ALREADY_PAID",
    });
    expect(
      await prisma.walletTransaction.count({
        where: { bookingId: booking.id, type: "LESSON_PAYMENT" },
      })
    ).toBe(1);
  });

  it("does not capture payment from an expired hold after another student takes its slot", async () => {
    const slot = await prisma.availability.create({
      data: {
        tutorId,
        startedAt: new Date(Date.now() + 8 * 86400000),
        availabilitySubjects: { create: { subjectId } },
      },
    });
    const stale = await createBooking(studentId, {
      subjectId,
      availabilityIds: [slot.id],
      isTrial: true,
    });
    await prisma.booking.update({
      where: { id: stale.id },
      data: { paymentExpiresAt: new Date(Date.now() - 1000) },
    });
    const winner = await createBooking(otherId, {
      subjectId,
      availabilityIds: [slot.id],
      isTrial: true,
    });
    await expect(confirmBookingPayment(studentId, stale.id)).rejects.toMatchObject({
      code: "BOOKING_EXPIRED",
    });
    expect(await prisma.walletTransaction.count({ where: { bookingId: stale.id } })).toBe(0);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: stale.id } })).status).toBe(
      "CANCELLED"
    );
    expect(
      (await prisma.availability.findUniqueOrThrow({ where: { id: slot.id } })).bookingId
    ).toBe(winner.id);
  });
});
