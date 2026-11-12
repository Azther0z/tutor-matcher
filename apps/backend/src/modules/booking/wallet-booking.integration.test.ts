import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { randomUUID } from "node:crypto";
import { URL } from "node:url";
import { prisma } from "../../lib/db.ts";
import { appendWalletMovement } from "../wallet/wallet-ledger.ts";
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

  it("rejects insufficient funds without reserving a slot or creating a ledger row, then books after top-up", async () => {
    const input = { subjectId, availabilityIds: [slotId], isTrial: false };
    await expect(createBooking(studentId, input)).rejects.toMatchObject({
      code: "INSUFFICIENT_BALANCE",
    });
    expect(await prisma.booking.count({ where: { userId: studentId } })).toBe(0);
    expect(
      (await prisma.availability.findUniqueOrThrow({ where: { id: slotId } })).bookingId
    ).toBeNull();
    expect(
      await prisma.walletTransaction.count({ where: { userId: studentId, type: "LESSON_PAYMENT" } })
    ).toBe(0);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: studentId } })).balance.toFixed(2)
    ).toBe("50.00");
    await prisma.$transaction(
      (tx) => appendWalletMovement(tx, { userId: studentId, type: "TOP_UP", amount: 150 }),
      { isolationLevel: "Serializable" }
    );
    const paid = await createBooking(studentId, input);
    expect(paid.status).toBe("CONFIRMED");
    expect(paid.isTrial).toBe(false);
    expect(paid.paymentExpiresAt).toBeNull();
    expect(paid.payment.walletBalance).toBe("0.00");
    expect((await prisma.availability.findUniqueOrThrow({ where: { id: slotId } })).bookingId).toBe(
      paid.id
    );
    await expect(createBooking(otherId, input)).rejects.toMatchObject({ code: "SLOT_TAKEN" });
    await expect(confirmBookingPayment(studentId, paid.id)).rejects.toMatchObject({
      code: "BOOKING_ALREADY_PAID",
    });
    expect(
      await prisma.walletTransaction.count({
        where: { bookingId: paid.id, type: "LESSON_PAYMENT" },
      })
    ).toBe(1);
  });

  it("allows exactly one concurrent booking and charges only the winner", async () => {
    const slot = await prisma.availability.create({
      data: {
        tutorId,
        startedAt: new Date(Date.now() + 8 * 86400000),
        availabilitySubjects: { create: { subjectId } },
      },
    });
    for (const userId of [studentId, otherId]) {
      await prisma.$transaction(
        (tx) => appendWalletMovement(tx, { userId, type: "TOP_UP", amount: 200 }),
        { isolationLevel: "Serializable" }
      );
    }
    const results = await Promise.allSettled(
      [studentId, otherId].map((userId) =>
        createBooking(userId, { subjectId, availabilityIds: [slot.id], isTrial: false })
      )
    );
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const reserved = await prisma.availability.findUniqueOrThrow({ where: { id: slot.id } });
    expect(reserved.bookingId).not.toBeNull();
    expect(
      await prisma.walletTransaction.count({
        where: { bookingId: reserved.bookingId!, type: "LESSON_PAYMENT" },
      })
    ).toBe(1);
    const users = await prisma.user.findMany({ where: { id: { in: [studentId, otherId] } } });
    expect(users.map((user) => user.balance.toFixed(2)).sort()).toEqual(["0.00", "200.00"]);
  });
});
