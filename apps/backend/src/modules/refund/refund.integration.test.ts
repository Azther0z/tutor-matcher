import { randomUUID } from "node:crypto";
import { URL } from "node:url";
import { afterAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
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
    target.pathname !== "/tutor_matcher_pay3_test"
  ) {
    throw new Error(
      "PAY-3 integration tests require the dedicated local tutor_matcher_pay3_test database"
    );
  }
}

const STUDENT = "53000000-0000-4000-8000-000000000001";
const TEACHER = "53000000-0000-4000-8000-000000000002";
const OTHER = "53000000-0000-4000-8000-000000000003";
const ADMIN = "53000000-0000-4000-8000-000000000004";
const TUTOR = "53000000-0000-4000-8000-000000000005";
const SUBJECT = "53000000-0000-4000-8000-000000000006";
const PAYOUT_ACCOUNT = "53000000-0000-4000-8000-000000000007";
const userIds = [STUDENT, TEACHER, OTHER, ADMIN];
const authorize = (test: request.Test, userId: string) =>
  test.set(
    "Authorization",
    `Bearer ${signAuthToken({ sub: userId, email: `${userId}@example.com`, isAdmin: userId === ADMIN })}`
  );

async function cleanFixtures() {
  await prisma.refundRequest.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.review.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.walletTransaction.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.payoutAccount.deleteMany({ where: { userId: { in: userIds } } });
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

// Books and pays a 30-minute lesson (฿100) about two to three days from now.
async function paidLesson() {
  const slotId = randomUUID();
  await prisma.availability.create({
    data: {
      id: slotId,
      tutorId: TUTOR,
      startedAt: new Date(Date.now() + 48 * 3_600_000 + Math.random() * 3_600_000 * 24),
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
  await authorize(request(app).post(`/api/bookings/${id}/confirm-payment`), STUDENT).expect(200);
  return id;
}

// Books and pays a lesson, then moves it so it ended `hoursAgo` hours ago.
async function endedLesson(hoursAgo = 1) {
  const id = await paidLesson();
  const endedAt = Date.now() - hoursAgo * 3_600_000;
  await prisma.booking.update({
    where: { id },
    data: { startedAt: new Date(endedAt - 30 * 60_000), endedAt: new Date(endedAt) },
  });
  return id;
}

const fileRefund = (id: string, body: object, userId = STUDENT) =>
  authorize(request(app).post(`/api/bookings/${id}/refund-request`).send(body), userId);
const balanceOf = async (userId: string) =>
  (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).balance.toFixed(2);
const unsatisfactory = { reason: "UNSATISFACTORY_LESSON", details: "The tutor left early" };

const run = enabled ? describe : describe.skip;

run("PAY-3 refund requests", () => {
  beforeEach(async () => {
    await cleanFixtures();
    await prisma.user.createMany({
      data: userIds.map((id, index) => ({
        id,
        firstName: ["Student", "Tutor", "Other", "Admin"][index]!,
        lastName: "PAY3",
        email: `pay3-${index}@example.com`,
        password: "unused-fixture",
        isAdmin: id === ADMIN,
        // Only the Tutor receives booking updates, so the refund notification can be observed.
        notifyOnBooking: id === TEACHER,
        notifyOnPayment: false,
      })),
    });
    await prisma.$transaction(
      (tx) => appendWalletMovement(tx, { userId: STUDENT, type: "TOP_UP", amount: "500.00" }),
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
      data: { id: SUBJECT, tutorId: TUTOR, name: "PAY-3 Test", hourlyRate: "200.00" },
    });
    await prisma.payoutAccount.create({
      data: {
        id: PAYOUT_ACCOUNT,
        userId: TEACHER,
        bankCode: "KBANK",
        accountHolderName: "Tutor PAY3",
        accountNumber: "1234567890",
        isDefault: true,
      },
    });
  });
  afterAll(cleanFixtures);

  const approve = (requestId: string, by = ADMIN) =>
    authorize(
      request(app).post(`/api/admin/refunds/${requestId}/review`).send({ decision: "APPROVED" }),
      by
    );
  const requestFor = (bookingId: string) =>
    prisma.refundRequest.findUniqueOrThrow({ where: { bookingId } });

  it("sends a Tutor no-show to an admin, whose approval refunds the full amount (AC1)", async () => {
    const id = await endedLesson();
    expect(await balanceOf(STUDENT)).toBe("400.00");
    await fileRefund(id, { reason: "TUTOR_NO_SHOW" }, OTHER).expect(403);
    await fileRefund(id, { reason: "TUTOR_NO_SHOW" }, TEACHER).expect(403);

    // Nothing is refunded until an admin decides, because a no-show claim can't be verified.
    const filed = await fileRefund(id, { reason: "TUTOR_NO_SHOW" }).expect(201);
    expect(filed.body.booking).toMatchObject({
      status: "CONFIRMED",
      refundRequest: { reason: "TUTOR_NO_SHOW", status: "PENDING", amount: "100.00" },
      actions: { canRequestRefund: false },
    });
    expect(await balanceOf(STUDENT)).toBe("400.00");

    const approved = await approve((await requestFor(id)).id).expect(200);
    expect(approved.body).toMatchObject({ status: "APPROVED", reason: "TUTOR_NO_SHOW" });
    expect(await balanceOf(STUDENT)).toBe("500.00");

    // The approved request links the REFUND row it appended.
    const refund = await prisma.walletTransaction.findFirstOrThrow({
      where: { bookingId: id, type: "REFUND" },
    });
    expect(refund.amount).toEqual(new Prisma.Decimal("100.00"));
    expect((await requestFor(id)).walletTransactionId).toBe(refund.id);

    // The Tutor's pending earning disappears with the cancelled booking.
    const overview = await authorize(request(app).get("/api/wallet/overview"), TEACHER).expect(200);
    expect(overview.body.pendingEarnings).toBe("0.00");
    const repeated = await fileRefund(id, { reason: "TUTOR_NO_SHOW" }).expect(409);
    expect(repeated.body.code).toBe("REFUND_ALREADY_REQUESTED");
  });

  it("routes an unsatisfactory lesson to the admin queue and blocks Tutor confirmation (AC2)", async () => {
    const id = await endedLesson();
    await fileRefund(id, { reason: "UNSATISFACTORY_LESSON" }).expect(400);
    const filed = await fileRefund(id, unsatisfactory).expect(201);
    expect(filed.body.booking).toMatchObject({
      status: "CONFIRMED",
      refundRequest: { status: "PENDING", details: "The tutor left early" },
    });

    const tutorView = await authorize(request(app).get(`/api/bookings/${id}`), TEACHER).expect(200);
    expect(tutorView.body.booking).toMatchObject({
      actions: { canConfirmCompletion: false },
      refundRequest: { status: "PENDING", details: null },
    });
    await authorize(request(app).post(`/api/bookings/${id}/confirm-completion`), TEACHER).expect(
      409
    );

    await authorize(request(app).get("/api/admin/refunds"), STUDENT).expect(403);
    const queue = await authorize(
      request(app).get("/api/admin/refunds?status=PENDING"),
      ADMIN
    ).expect(200);
    expect(queue.body.requests).toHaveLength(1);
    expect(queue.body.requests[0]).toMatchObject({
      reason: "UNSATISFACTORY_LESSON",
      amount: "100.00",
      student: { id: STUDENT },
      booking: { id, subjectName: "PAY-3 Test", tutorName: "Tutor PAY3" },
    });

    await approve(queue.body.requests[0].id).expect(200);
    expect(await balanceOf(STUDENT)).toBe("500.00");
    const again = await approve(queue.body.requests[0].id).expect(409);
    expect(again.body.code).toBe("REFUND_NOT_PENDING");
    expect(await balanceOf(STUDENT)).toBe("500.00");
  });

  it("accepts Other with an explanation", async () => {
    const id = await endedLesson();
    await fileRefund(id, { reason: "OTHER" }).expect(400);
    const filed = await fileRefund(id, { reason: "OTHER", details: "Wrong subject" }).expect(201);
    expect(filed.body.booking.refundRequest).toMatchObject({
      reason: "OTHER",
      status: "PENDING",
      details: "Wrong subject",
    });
  });

  it("lets an admin reject with a reason the Student sees, then the Tutor can confirm (AC3)", async () => {
    const id = await endedLesson();
    await fileRefund(id, unsatisfactory).expect(201);
    const pending = await requestFor(id);
    await authorize(
      request(app).post(`/api/admin/refunds/${pending.id}/review`).send({ decision: "REJECTED" }),
      ADMIN
    ).expect(400);
    await authorize(
      request(app)
        .post(`/api/admin/refunds/${pending.id}/review`)
        .send({ decision: "REJECTED", rejectionReason: "The lesson ran for the full time" }),
      ADMIN
    ).expect(200);

    const studentView = await authorize(request(app).get(`/api/bookings/${id}`), STUDENT).expect(
      200
    );
    expect(studentView.body.booking).toMatchObject({
      status: "CONFIRMED",
      refundRequest: { status: "REJECTED", rejectionReason: "The lesson ran for the full time" },
      actions: { canRequestRefund: false },
    });
    expect(await balanceOf(STUDENT)).toBe("400.00");
    expect((await requestFor(id)).walletTransactionId).toBeNull();
    await authorize(request(app).post(`/api/bookings/${id}/confirm-completion`), TEACHER).expect(
      200
    );
  });

  it("accepts a request for a lesson the Tutor already confirmed", async () => {
    const id = await endedLesson();
    await authorize(request(app).post(`/api/bookings/${id}/confirm-completion`), TEACHER).expect(
      200
    );
    const view = await authorize(request(app).get(`/api/bookings/${id}`), STUDENT).expect(200);
    expect(view.body.booking.actions.canRequestRefund).toBe(true);
    await fileRefund(id, unsatisfactory).expect(201);
    await approve((await requestFor(id)).id).expect(200);
    expect(await balanceOf(STUDENT)).toBe("500.00");
    expect((await prisma.booking.findUniqueOrThrow({ where: { id } })).status).toBe("CANCELLED");
  });

  it("keeps an already-cleared earning when a later refund is approved, even after payout", async () => {
    const id = await endedLesson(25);
    await authorize(request(app).post(`/api/bookings/${id}/confirm-completion`), TEACHER).expect(
      200
    );

    const wallet = await authorize(request(app).get("/api/wallet/overview"), TEACHER).expect(200);
    expect(wallet.body).toMatchObject({ balance: "85.00", pendingEarnings: "0.00" });
    expect(
      await prisma.walletTransaction.count({ where: { bookingId: id, type: "LESSON_EARNING" } })
    ).toBe(1);

    const accountId = randomUUID();
    await prisma.payoutAccount.create({
      data: {
        id: accountId,
        userId: TEACHER,
        bankCode: "KBANK",
        accountHolderName: "Tutor PAY3",
        accountNumber: "1234567890",
        isDefault: true,
      },
    });
    await authorize(
      request(app).post("/api/payouts").send({
        amount: 85,
        payoutAccountId: accountId,
        reference: randomUUID(),
      }),
      TEACHER
    ).expect(201);
    expect(await balanceOf(TEACHER)).toBe("0.00");

    await fileRefund(id, unsatisfactory).expect(201);
    await approve((await requestFor(id)).id).expect(200);

    expect(await balanceOf(STUDENT)).toBe("500.00");
    expect(await balanceOf(TEACHER)).toBe("0.00");
    expect(
      await prisma.walletTransaction.count({ where: { bookingId: id, type: "LESSON_EARNING" } })
    ).toBe(1);
    expect(await prisma.walletTransaction.count({ where: { bookingId: id, type: "REFUND" } })).toBe(
      1
    );
    expect(
      await prisma.walletTransaction.count({ where: { userId: TEACHER, type: "PAYOUT" } })
    ).toBe(1);
  });

  it("serializes refund filing with an eligible earning settlement", async () => {
    const id = await endedLesson(25);
    await authorize(request(app).post(`/api/bookings/${id}/confirm-completion`), TEACHER).expect(
      200
    );

    const [walletResponse, refundResponse] = await Promise.all([
      authorize(request(app).get("/api/wallet/overview"), TEACHER),
      fileRefund(id, unsatisfactory),
    ]);
    expect(walletResponse.status).toBe(200);
    expect(refundResponse.status).toBe(201);
    const earningCount = await prisma.walletTransaction.count({
      where: { bookingId: id, type: "LESSON_EARNING" },
    });
    expect([0, 1]).toContain(earningCount);

    await approve((await requestFor(id)).id).expect(200);
    expect(await balanceOf(STUDENT)).toBe("500.00");
    expect(await prisma.walletTransaction.count({ where: { bookingId: id, type: "REFUND" } })).toBe(
      1
    );
    expect(
      await prisma.walletTransaction.count({ where: { bookingId: id, type: "LESSON_EARNING" } })
    ).toBe(earningCount);
    expect(await balanceOf(TEACHER)).toBe(earningCount ? "85.00" : "0.00");
  });

  it("clears one earning when the Tutor opens wallet history and overview concurrently", async () => {
    const id = await endedLesson(25);
    await authorize(request(app).post(`/api/bookings/${id}/confirm-completion`), TEACHER).expect(
      200
    );

    const [overview, history] = await Promise.all([
      authorize(request(app).get("/api/wallet/overview"), TEACHER),
      authorize(request(app).get("/api/wallet/transactions"), TEACHER),
    ]);
    expect(overview.status).toBe(200);
    expect(history.status).toBe(200);
    expect(await balanceOf(TEACHER)).toBe("85.00");
    expect(
      await prisma.walletTransaction.count({ where: { bookingId: id, type: "LESSON_EARNING" } })
    ).toBe(1);

    await authorize(request(app).get("/api/wallet/overview"), TEACHER).expect(200);
    expect(await balanceOf(TEACHER)).toBe("85.00");
    expect(
      await prisma.walletTransaction.count({ where: { bookingId: id, type: "LESSON_EARNING" } })
    ).toBe(1);
  });

  it("makes an earning available to a payout racing the wallet settlement trigger", async () => {
    const id = await endedLesson(25);
    await authorize(request(app).post(`/api/bookings/${id}/confirm-completion`), TEACHER).expect(
      200
    );

    const [overview, payout] = await Promise.all([
      authorize(request(app).get("/api/wallet/overview"), TEACHER),
      authorize(
        request(app)
          .post("/api/payouts")
          .send({ amount: 85, payoutAccountId: PAYOUT_ACCOUNT, reference: randomUUID() }),
        TEACHER
      ),
    ]);
    expect(overview.status).toBe(200);
    expect(payout.status).toBe(201);
    expect(await balanceOf(TEACHER)).toBe("0.00");
    expect(
      await prisma.walletTransaction.count({ where: { bookingId: id, type: "LESSON_EARNING" } })
    ).toBe(1);
    expect(
      await prisma.walletTransaction.count({ where: { userId: TEACHER, type: "PAYOUT" } })
    ).toBe(1);
  });

  it("does not credit earnings when Admin approval races settlement", async () => {
    const id = await endedLesson(25);
    await authorize(request(app).post(`/api/bookings/${id}/confirm-completion`), TEACHER).expect(
      200
    );
    await fileRefund(id, unsatisfactory).expect(201);
    const requestId = (await requestFor(id)).id;

    const [walletResponse, refundResponse] = await Promise.all([
      authorize(request(app).get("/api/wallet/overview"), TEACHER),
      approve(requestId),
    ]);
    expect(walletResponse.status).toBe(200);
    expect(refundResponse.status).toBe(200);
    expect(await balanceOf(STUDENT)).toBe("500.00");
    expect(await balanceOf(TEACHER)).toBe("0.00");
    expect(
      await prisma.walletTransaction.count({ where: { bookingId: id, type: "LESSON_EARNING" } })
    ).toBe(0);
    expect(await prisma.walletTransaction.count({ where: { bookingId: id, type: "REFUND" } })).toBe(
      1
    );
  });

  it("drops a refunded lesson's review from the public rating but keeps the row", async () => {
    const id = await endedLesson();
    await authorize(request(app).post(`/api/bookings/${id}/confirm-completion`), TEACHER).expect(
      200
    );
    await authorize(
      request(app).post("/api/reviews").send({ bookingId: id, rating: 1, comment: "Poor" }),
      STUDENT
    ).expect(201);
    const subjectPage = () =>
      request(app).get(`/api/discovery/tutors/${TUTOR}/subjects/${SUBJECT}`).expect(200);
    expect((await subjectPage()).body.subject).toMatchObject({ rating: 1, reviewCount: 1 });

    await fileRefund(id, unsatisfactory).expect(201);
    await approve((await requestFor(id)).id).expect(200);

    const after = (await subjectPage()).body;
    expect(after.subject).toMatchObject({ rating: null, reviewCount: 0 });
    expect(after.reviews).toEqual([]);
    expect(await prisma.review.count({ where: { bookingId: id } })).toBe(1);
  });

  it("opens only after the lesson's scheduled end, with no deadline", async () => {
    const upcoming = await paidLesson();
    const view = await authorize(request(app).get(`/api/bookings/${upcoming}`), STUDENT).expect(
      200
    );
    expect(view.body.booking.actions.canRequestRefund).toBe(false);
    const early = await fileRefund(upcoming, unsatisfactory).expect(409);
    expect(early.body.code).toBe("REFUND_LESSON_NOT_ENDED");

    const longAgo = await endedLesson(24 * 30);
    await fileRefund(longAgo, { reason: "TUTOR_NO_SHOW" }).expect(201);
  });

  it("tells the Tutor that the Student asked for a refund", async () => {
    const info = jest.spyOn(console, "info").mockImplementation(() => undefined);
    try {
      const id = await endedLesson();
      await fileRefund(id, unsatisfactory).expect(201);
      expect(info).toHaveBeenCalledWith(
        expect.stringContaining("[notification:booking] pay3-1@example.com: PAY-3 Test")
      );
    } finally {
      info.mockRestore();
    }
  });

  it("stops an admin deciding a refund for their own lesson", async () => {
    const id = await endedLesson();
    await fileRefund(id, unsatisfactory).expect(201);
    await prisma.user.update({ where: { id: TEACHER }, data: { isAdmin: true } });
    const response = await approve((await requestFor(id)).id, TEACHER).expect(403);
    expect(response.body.code).toBe("REFUND_SELF_REVIEW");
  });

  it("refunds once when two admins approve at the same time", async () => {
    const id = await endedLesson();
    await fileRefund(id, unsatisfactory).expect(201);
    await prisma.user.update({ where: { id: OTHER }, data: { isAdmin: true } });
    const requestId = (await requestFor(id)).id;
    const responses = await Promise.all([approve(requestId), approve(requestId, OTHER)]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(await balanceOf(STUDENT)).toBe("500.00");
    expect(await prisma.walletTransaction.count({ where: { bookingId: id, type: "REFUND" } })).toBe(
      1
    );
  });

  it("files once when the Student submits twice at the same time", async () => {
    const id = await endedLesson();
    const responses = await Promise.all([
      fileRefund(id, unsatisfactory),
      fileRefund(id, unsatisfactory),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(await prisma.refundRequest.count({ where: { bookingId: id } })).toBe(1);
  });
});
