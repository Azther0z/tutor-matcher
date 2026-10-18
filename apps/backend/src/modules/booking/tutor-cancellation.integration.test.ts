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
    target.pathname !== "/tutor_matcher_book4_test"
  ) {
    throw new Error(
      "BOOK-4 integration tests require the dedicated local tutor_matcher_book4_test database"
    );
  }
}

const STUDENT = "44000000-0000-4000-8000-000000000001";
const TEACHER = "44000000-0000-4000-8000-000000000002";
const OTHER = "44000000-0000-4000-8000-000000000003";
const TUTOR = "44000000-0000-4000-8000-000000000004";
const SUBJECT = "44000000-0000-4000-8000-000000000005";
const userIds = [STUDENT, TEACHER, OTHER];
const authorize = (test: request.Test, userId = TEACHER) =>
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
      .send({ subjectId: SUBJECT, availabilityIds: [slotId], isTrial: true }),
    STUDENT
  ).expect(201);
  const id = created.body.booking.id as string;
  if (paid)
    await authorize(request(app).post(`/api/bookings/${id}/confirm-payment`), STUDENT).expect(200);
  return { id, slotId };
}

async function quoteFor(id: string) {
  const response = await authorize(
    request(app).get(`/api/bookings/${id}/tutor-cancellation-quote`)
  ).expect(200);
  return response.body.quote as {
    token: string;
    lateCancellation: boolean;
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

(enabled ? describe : describe.skip)("BOOK-4 tutor cancellation acceptance", () => {
  beforeEach(async () => {
    await cleanFixtures();
    await prisma.user.createMany({
      data: userIds.map((id, index) => ({
        id,
        firstName: ["Student", "Tutor", "Other"][index],
        lastName: "BOOK4",
        email: `book4-${index}@example.com`,
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
      data: { id: SUBJECT, tutorId: TUTOR, name: "BOOK-4 Test", hourlyRate: "200.00" },
    });
  });
  afterAll(cleanFixtures);

  it.each([
    [48, false],
    [12, true],
  ])(
    "refunds the student in full for a paid lesson %s hours away and closes its slots",
    async (hours, late) => {
      const { id, slotId } = await createLesson(Number(hours));
      const before = await snapshot(id, slotId);
      const quote = await quoteFor(id);
      expect(quote).toMatchObject({
        lateCancellation: late,
        refundRate: 1,
        refundAmount: "100.00",
        cancellationFee: "0.00",
      });
      const response = await authorize(
        request(app)
          .post(`/api/bookings/${id}/tutor-cancel`)
          .send({ quoteToken: quote.token, reason: "I am sick" })
      ).expect(200);
      const after = await snapshot(id, slotId);
      expect(response.body.refund).toMatchObject({ amount: "100.00", cancellationFee: "0.00" });
      expect(response.body.booking.viewerRole).toBe("TUTOR");
      expect(after.student.balance.toFixed(2)).toBe("500.00");
      expect(after.teacher.balance.toFixed(2)).toBe("0.00");
      expect(after.booking).toMatchObject({
        status: "CANCELLED",
        cancellationReason: "I am sick",
        cancelledBy: "TUTOR",
        paymentExpiresAt: null,
      });
      expect(after.slot).toMatchObject({ bookingId: null, isOpen: false });
      expect(after.movements.filter((row) => row.type === "REFUND")).toHaveLength(1);
      expect(after.movements.find((row) => row.type === "REFUND")?.userId).toBe(STUDENT);
      expect(after.movements.find((row) => row.type === "LESSON_PAYMENT")).toEqual(
        before.movements[0]
      );
    }
  );

  it("shows the student who cancelled and why", async () => {
    const { id } = await createLesson(48);
    const quote = await quoteFor(id);
    await authorize(
      request(app)
        .post(`/api/bookings/${id}/tutor-cancel`)
        .send({ quoteToken: quote.token, reason: "I am sick" })
    ).expect(200);
    const detail = await authorize(request(app).get(`/api/bookings/${id}`), STUDENT).expect(200);
    expect(detail.body.booking).toMatchObject({
      viewerRole: "STUDENT",
      status: "CANCELLED",
      cancelledBy: "TUTOR",
      cancellationReason: "I am sick",
    });
  });

  it("cancels an unpaid hold without a refund entry and closes its slot", async () => {
    const { id, slotId } = await createLesson(48, false);
    const quote = await quoteFor(id);
    expect(quote.refundAmount).toBe("0.00");
    await authorize(
      request(app).post(`/api/bookings/${id}/tutor-cancel`).send({ reason: "Schedule changed" })
    ).expect(200);
    const after = await snapshot(id, slotId);
    expect(after.movements).toEqual([]);
    expect(after.student.balance.toFixed(2)).toBe("500.00");
    expect(after.slot).toMatchObject({ bookingId: null, isOpen: false });
  });

  it("rejects the student, another user and unauthenticated requests without changes", async () => {
    const { id, slotId } = await createLesson(48);
    const before = await snapshot(id, slotId);
    for (const userId of [STUDENT, OTHER]) {
      await authorize(
        request(app).get(`/api/bookings/${id}/tutor-cancellation-quote`),
        userId
      ).expect(403);
      await authorize(
        request(app).post(`/api/bookings/${id}/tutor-cancel`).send({ reason: "No" }),
        userId
      ).expect(403);
    }
    await request(app).post(`/api/bookings/${id}/tutor-cancel`).send({ reason: "No" }).expect(401);
    expect(await snapshot(id, slotId)).toEqual(before);
  });

  it("rejects a missing reason and missing or stale quote tokens without changes", async () => {
    const { id, slotId } = await createLesson(48);
    const before = await snapshot(id, slotId);
    const quote = await quoteFor(id);
    await authorize(
      request(app).post(`/api/bookings/${id}/tutor-cancel`).send({ quoteToken: quote.token })
    ).expect(400);
    for (const body of [{ reason: "Sick" }, { reason: "Sick", quoteToken: "f".repeat(64) }]) {
      const response = await authorize(
        request(app).post(`/api/bookings/${id}/tutor-cancel`).send(body)
      ).expect(409);
      expect(response.body.code).toBe("CANCELLATION_QUOTE_CHANGED");
      expect(response.body.details.currentQuote).toMatchObject({ refundAmount: "100.00" });
    }
    expect(await snapshot(id, slotId)).toEqual(before);
  });

  it("does not accept a quote token issued for the student's own cancellation", async () => {
    const { id, slotId } = await createLesson(48);
    const studentQuote = await authorize(
      request(app).get(`/api/bookings/${id}/cancellation-quote`),
      STUDENT
    ).expect(200);
    const before = await snapshot(id, slotId);
    await authorize(
      request(app)
        .post(`/api/bookings/${id}/tutor-cancel`)
        .send({ reason: "Sick", quoteToken: studentQuote.body.quote.token })
    ).expect(409);
    expect(await snapshot(id, slotId)).toEqual(before);
  });

  it("commits at most one refund for concurrent or repeated cancellation", async () => {
    const { id, slotId } = await createLesson(48);
    const quote = await quoteFor(id);
    const send = () =>
      authorize(
        request(app)
          .post(`/api/bookings/${id}/tutor-cancel`)
          .send({ quoteToken: quote.token, reason: "Sick" })
      );
    const results = await Promise.all([send(), send()]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    await send().expect(409);
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
      await authorize(request(app).get(`/api/bookings/${id}/tutor-cancellation-quote`)).expect(409);
      await authorize(
        request(app).post(`/api/bookings/${id}/tutor-cancel`).send({ reason: "Sick" })
      ).expect(409);
      expect(await snapshot(id, slotId)).toEqual(before);
    }
  );

  it("lists only the tutor's lessons that have not started, soonest first", async () => {
    const later = await createLesson(48);
    const sooner = await createLesson(12, false);
    const cancelled = await createLesson(72);
    await prisma.booking.update({ where: { id: cancelled.id }, data: { status: "CANCELLED" } });
    const response = await authorize(request(app).get("/api/bookings/tutor/upcoming")).expect(200);
    expect(response.body.bookings.map((booking: { id: string }) => booking.id)).toEqual([
      sooner.id,
      later.id,
    ]);
    expect(response.body.bookings[0]).toMatchObject({
      student: { id: STUDENT, name: "Student BOOK4" },
      actions: { canTutorCancel: true },
    });
    await authorize(request(app).get("/api/bookings/tutor/upcoming"), STUDENT).expect(403);
  });

  it("records the student as the canceller on the BOOK-3 path", async () => {
    const { id } = await createLesson(48);
    const quote = await authorize(
      request(app).get(`/api/bookings/${id}/cancellation-quote`),
      STUDENT
    ).expect(200);
    await authorize(
      request(app).post(`/api/bookings/${id}/cancel`).send({ quoteToken: quote.body.quote.token }),
      STUDENT
    ).expect(200);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id } })).cancelledBy).toBe("STUDENT");
  });
});
