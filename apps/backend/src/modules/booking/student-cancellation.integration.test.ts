import { randomUUID } from "node:crypto";
import { URL } from "node:url";
import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import request from "supertest";
import { app } from "../../app.ts";
import { prisma } from "../../lib/db.ts";
import { signAuthToken } from "../../lib/jwt.ts";
import { Prisma } from "../../generated/prisma/client.ts";
import { appendWalletMovement } from "../wallet/wallet-ledger.ts";

const enabled = process.env.RUN_DATABASE_INTEGRATION === "true";
if (enabled) {
  const target = new URL(process.env.DATABASE_URL ?? "");
  if (
    !["localhost", "127.0.0.1"].includes(target.hostname) ||
    target.pathname !== "/tutor_matcher_book3_test"
  ) {
    throw new Error(
      "BOOK-3 integration tests require the dedicated local tutor_matcher_book3_test database"
    );
  }
}

const STUDENT = "43000000-0000-4000-8000-000000000001";
const TEACHER = "43000000-0000-4000-8000-000000000002";
const OTHER = "43000000-0000-4000-8000-000000000003";
const TUTOR = "43000000-0000-4000-8000-000000000004";
const SUBJECT = "43000000-0000-4000-8000-000000000005";
const userIds = [STUDENT, TEACHER, OTHER];
const authorize = (test: request.Test, userId = STUDENT) =>
  test.set(
    "Authorization",
    `Bearer ${signAuthToken({ sub: userId, email: `${userId}@example.com`, isAdmin: false })}`
  );

async function cleanFixtures() {
  await prisma.walletTransaction.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.availability.updateMany({ where: { tutorId: TUTOR }, data: { bookingId: null } });
  await prisma.booking.deleteMany({ where: { subjectId: SUBJECT } });
  await prisma.availabilitySubject.deleteMany({ where: { subjectId: SUBJECT } });
  await prisma.availability.deleteMany({ where: { tutorId: TUTOR } });
  await prisma.subject.deleteMany({ where: { id: SUBJECT } });
  await prisma.user.updateMany({ where: { id: TEACHER }, data: { tutorId: null } });
  await prisma.tutor.deleteMany({ where: { id: TUTOR } });
  await prisma.tutorProfileVersion.deleteMany({ where: { userId: TEACHER } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

async function createLesson(hoursAway: number, paid = true) {
  const slotId = randomUUID();
  await prisma.availability.create({
    data: {
      id: slotId,
      tutorId: TUTOR,
      startedAt: new Date(Date.now() + hoursAway * 3_600_000),
      availabilitySubjects: { create: { subjectId: SUBJECT } },
    },
  });
  const created = await authorize(
    request(app)
      .post("/api/bookings")
      .send({
        subjectId: SUBJECT,
        availabilityIds: [slotId],
        isTrial: true,
      })
  ).expect(201);
  const id = created.body.booking.id as string;
  if (paid) await authorize(request(app).post(`/api/bookings/${id}/confirm-payment`)).expect(200);
  return { id, slotId };
}

async function quoteFor(id: string) {
  const response = await authorize(
    request(app).get(`/api/bookings/${id}/cancellation-quote`)
  ).expect(200);
  return response.body.quote as {
    token: string;
    refundAmount: string;
    cancellationFee: string;
    refundRate: number;
  };
}

async function snapshot(id: string, slotId: string) {
  const [booking, student, teacher, slot, movements] = await Promise.all([
    prisma.booking.findUniqueOrThrow({ where: { id } }),
    prisma.user.findUniqueOrThrow({ where: { id: STUDENT } }),
    prisma.user.findUniqueOrThrow({ where: { id: TEACHER } }),
    prisma.availability.findUniqueOrThrow({ where: { id: slotId } }),
    prisma.walletTransaction.findMany({ where: { bookingId: id }, orderBy: { type: "asc" } }),
  ]);
  return { booking, student, teacher, slot, movements };
}

(enabled ? describe : describe.skip)("BOOK-3 student cancellation acceptance", () => {
  beforeEach(async () => {
    await cleanFixtures();
    await prisma.user.createMany({
      data: userIds.map((id, index) => ({
        id,
        firstName: ["Student", "Tutor", "Other"][index],
        lastName: "BOOK3",
        email: `book3-${index}@example.com`,
        password: "unused-fixture",
        notifyOnBooking: false,
        notifyOnPayment: false,
      })),
    });
    await prisma.$transaction(
      (tx) =>
        appendWalletMovement(tx, {
          userId: STUDENT,
          type: "TOP_UP",
          amount: "500.00",
        }),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    await prisma.tutor.create({
      data: {
        id: TUTOR,
        status: "PUBLISHED",
        currentProfileVersion: { create: { userId: TEACHER, status: "APPROVED" } },
      },
    });
    await prisma.user.update({ where: { id: TEACHER }, data: { tutorId: TUTOR } });
    await prisma.subject.create({
      data: { id: SUBJECT, tutorId: TUTOR, name: "BOOK-3 Test", hourlyRate: "200.00" },
    });
  });
  afterAll(cleanFixtures);

  it.each([
    [48, "100.00", "0.00", "500.00"],
    [12, "70.00", "30.00", "470.00"],
  ])(
    "refunds a paid lesson %s hours away and releases its slots atomically",
    async (hours, refund, fee, balance) => {
      const { id, slotId } = await createLesson(Number(hours));
      const before = await snapshot(id, slotId);
      const quote = await quoteFor(id);
      expect(quote).toMatchObject({ refundAmount: refund, cancellationFee: fee });
      const response = await authorize(
        request(app)
          .post(`/api/bookings/${id}/cancel`)
          .send({ quoteToken: quote.token, reason: "Schedule changed" })
      ).expect(200);
      const after = await snapshot(id, slotId);
      expect(response.body.refund).toMatchObject({ amount: refund, cancellationFee: fee });
      expect(response.body.booking.payment.walletBalance).toBe(balance);
      expect(after.student.balance.toFixed(2)).toBe(balance);
      expect(after.teacher.balance.toFixed(2)).toBe("0.00");
      expect(after.booking).toMatchObject({
        status: "CANCELLED",
        cancellationReason: "Schedule changed",
        paymentExpiresAt: null,
      });
      expect(after.slot.bookingId).toBeNull();
      expect(after.movements.filter((row) => row.type === "REFUND")).toHaveLength(1);
      expect(after.movements.find((row) => row.type === "LESSON_PAYMENT")).toEqual(
        before.movements[0]
      );
      expect(after.movements.find((row) => row.type === "REFUND")?.amount.toFixed(2)).toBe(refund);
    }
  );

  it("cancels an unpaid hold without a refund entry or balance change", async () => {
    const { id, slotId } = await createLesson(48, false);
    const quote = await quoteFor(id);
    expect(quote.refundAmount).toBe("0.00");
    await authorize(
      request(app).post(`/api/bookings/${id}/cancel`).send({ quoteToken: quote.token })
    ).expect(200);
    const after = await snapshot(id, slotId);
    expect(after.movements).toEqual([]);
    expect(after.student.balance.toFixed(2)).toBe("500.00");
    expect(after.slot.bookingId).toBeNull();
  });

  it("rejects a non-owner, including the tutor, and unauthenticated requests without changes", async () => {
    const { id, slotId } = await createLesson(48);
    const before = await snapshot(id, slotId);
    for (const userId of [OTHER, TEACHER]) {
      await authorize(request(app).get(`/api/bookings/${id}/cancellation-quote`), userId).expect(
        403
      );
      await authorize(request(app).post(`/api/bookings/${id}/cancel`).send({}), userId).expect(403);
    }
    await request(app).post(`/api/bookings/${id}/cancel`).send({}).expect(401);
    expect(await snapshot(id, slotId)).toEqual(before);
  });

  it("rejects missing and stale quote tokens without changing money or the slot", async () => {
    const { id, slotId } = await createLesson(48);
    const before = await snapshot(id, slotId);
    for (const body of [{}, { quoteToken: "f".repeat(64) }]) {
      const response = await authorize(
        request(app).post(`/api/bookings/${id}/cancel`).send(body)
      ).expect(409);
      expect(response.body.code).toBe("CANCELLATION_QUOTE_CHANGED");
      expect(response.body.details.currentQuote).toMatchObject({
        refundAmount: "100.00",
        cancellationFee: "0.00",
      });
    }
    expect(await snapshot(id, slotId)).toEqual(before);
  });

  it("rejects quotes after the lesson moves into the penalty window", async () => {
    const { id, slotId } = await createLesson(48);
    const oldQuote = await quoteFor(id);
    // Fixture-only time change models a previously reviewed quote becoming stale.
    await prisma.booking.update({
      where: { id },
      data: { startedAt: new Date(Date.now() + 12 * 3_600_000) },
    });
    const before = await snapshot(id, slotId);
    const rejected = await authorize(
      request(app).post(`/api/bookings/${id}/cancel`).send({ quoteToken: oldQuote.token })
    ).expect(409);
    expect(rejected.body.details.currentQuote).toMatchObject({
      refundAmount: "70.00",
      cancellationFee: "30.00",
    });
    expect(await snapshot(id, slotId)).toEqual(before);
    await authorize(
      request(app)
        .post(`/api/bookings/${id}/cancel`)
        .send({ quoteToken: rejected.body.details.currentQuote.token })
    ).expect(200);
    expect((await snapshot(id, slotId)).student.balance.toFixed(2)).toBe("470.00");
  });

  it("commits at most one refund for concurrent or repeated cancellation", async () => {
    const { id, slotId } = await createLesson(48);
    const quote = await quoteFor(id);
    const results = await Promise.all(
      [1, 2].map(() =>
        authorize(request(app).post(`/api/bookings/${id}/cancel`).send({ quoteToken: quote.token }))
      )
    );
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    await authorize(
      request(app).post(`/api/bookings/${id}/cancel`).send({ quoteToken: quote.token })
    ).expect(409);
    const after = await snapshot(id, slotId);
    expect(after.student.balance.toFixed(2)).toBe("500.00");
    expect(after.movements.filter((row) => row.type === "REFUND")).toHaveLength(1);
  });

  it.each(["started", "COMPLETED", "CANCELLED"])(
    "rejects a %s lesson without a refund",
    async (state) => {
      const { id, slotId } = await createLesson(48);
      await prisma.booking.update({
        where: { id },
        data:
          state === "started"
            ? { startedAt: new Date(Date.now() - 60_000) }
            : { status: state as "COMPLETED" | "CANCELLED" },
      });
      const before = await snapshot(id, slotId);
      await authorize(request(app).get(`/api/bookings/${id}/cancellation-quote`)).expect(409);
      await authorize(request(app).post(`/api/bookings/${id}/cancel`).send({})).expect(409);
      expect(await snapshot(id, slotId)).toEqual(before);
    }
  );
});
