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
const userIds = [STUDENT, TEACHER, OTHER, ADMIN];
const authorize = (test: request.Test, userId: string) =>
  test.set(
    "Authorization",
    `Bearer ${signAuthToken({ sub: userId, email: `${userId}@example.com`, isAdmin: userId === ADMIN })}`
  );

async function cleanFixtures() {
  await prisma.refundRequest.deleteMany({ where: { userId: { in: userIds } } });
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
        notifyOnBooking: false,
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
  });
  afterAll(cleanFixtures);

  it("refunds a Tutor no-show in full at once and cancels the booking (AC1)", async () => {
    const id = await endedLesson();
    expect(await balanceOf(STUDENT)).toBe("400.00");
    await fileRefund(id, { reason: "TUTOR_NO_SHOW" }, OTHER).expect(403);
    await fileRefund(id, { reason: "TUTOR_NO_SHOW" }, TEACHER).expect(403);

    const response = await fileRefund(id, { reason: "TUTOR_NO_SHOW" }).expect(201);
    expect(response.body.booking).toMatchObject({
      status: "CANCELLED",
      refundRequest: { reason: "TUTOR_NO_SHOW", status: "APPROVED", amount: "100.00" },
      actions: { canRequestRefund: false },
    });
    expect(await balanceOf(STUDENT)).toBe("500.00");
    expect(
      await prisma.walletTransaction.findMany({
        where: { bookingId: id },
        select: { type: true, amount: true },
        orderBy: { createdAt: "asc" },
      })
    ).toEqual([
      { type: "LESSON_PAYMENT", amount: new Prisma.Decimal("100.00") },
      { type: "REFUND", amount: new Prisma.Decimal("100.00") },
    ]);
    // The Tutor's pending earning disappears with the cancelled booking.
    const overview = await authorize(request(app).get("/api/wallet/overview"), TEACHER).expect(200);
    expect(overview.body.pendingEarnings).toBe("0.00");

    const repeated = await fileRefund(id, { reason: "TUTOR_NO_SHOW" }).expect(409);
    expect(repeated.body.code).toBe("REFUND_ALREADY_REQUESTED");
  });

  it("sends an unsatisfactory lesson to an admin, who approves the full refund (AC2)", async () => {
    const id = await endedLesson();
    await fileRefund(id, { reason: "UNSATISFACTORY_LESSON" }).expect(400);
    const filed = await fileRefund(id, unsatisfactory).expect(201);
    expect(filed.body.booking).toMatchObject({
      status: "CONFIRMED",
      refundRequest: { status: "PENDING", details: "The tutor left early" },
    });
    expect(await balanceOf(STUDENT)).toBe("400.00");

    // The Tutor cannot confirm completion while the admin decides.
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
    const [pending] = queue.body.requests;
    expect(pending).toMatchObject({
      reason: "UNSATISFACTORY_LESSON",
      amount: "100.00",
      student: { id: STUDENT },
      booking: { id, subjectName: "PAY-3 Test", tutorName: "Tutor PAY3" },
    });

    const approved = await authorize(
      request(app).post(`/api/admin/refunds/${pending.id}/review`).send({ decision: "APPROVED" }),
      ADMIN
    ).expect(200);
    expect(approved.body).toMatchObject({ status: "APPROVED", reviewedByAdmin: true });
    expect(await balanceOf(STUDENT)).toBe("500.00");
    const studentView = await authorize(request(app).get(`/api/bookings/${id}`), STUDENT).expect(
      200
    );
    expect(studentView.body.booking).toMatchObject({
      status: "CANCELLED",
      refundRequest: { status: "APPROVED" },
    });

    const again = await authorize(
      request(app).post(`/api/admin/refunds/${pending.id}/review`).send({ decision: "APPROVED" }),
      ADMIN
    ).expect(409);
    expect(again.body.code).toBe("REFUND_NOT_PENDING");
    expect(await balanceOf(STUDENT)).toBe("500.00");
  });

  it("lets an admin reject with a reason the Student sees, then the Tutor can confirm", async () => {
    const id = await endedLesson();
    await fileRefund(id, unsatisfactory).expect(201);
    const request_ = await prisma.refundRequest.findUniqueOrThrow({ where: { bookingId: id } });
    await authorize(
      request(app).post(`/api/admin/refunds/${request_.id}/review`).send({ decision: "REJECTED" }),
      ADMIN
    ).expect(400);
    await authorize(
      request(app)
        .post(`/api/admin/refunds/${request_.id}/review`)
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
    await authorize(request(app).post(`/api/bookings/${id}/confirm-completion`), TEACHER).expect(
      200
    );
  });

  it("rejects a refund for a completed lesson and shows the reason (AC3)", async () => {
    const id = await endedLesson();
    await authorize(request(app).post(`/api/bookings/${id}/confirm-completion`), TEACHER).expect(
      200
    );
    const view = await authorize(request(app).get(`/api/bookings/${id}`), STUDENT).expect(200);
    expect(view.body.booking).toMatchObject({
      actions: { canRequestRefund: false },
      refundBlockedReason:
        "Your Tutor confirmed this lesson was completed, so it can't be refunded.",
    });

    const response = await fileRefund(id, { reason: "TUTOR_NO_SHOW" }).expect(409);
    expect(response.body).toEqual({
      code: "REFUND_LESSON_COMPLETED",
      message: "Your Tutor confirmed this lesson was completed, so it can't be refunded.",
    });
    expect(await prisma.refundRequest.count({ where: { bookingId: id } })).toBe(0);
    expect(await balanceOf(STUDENT)).toBe("400.00");
  });

  it("accepts requests any time after payment, with no deadline", async () => {
    const longAgo = await endedLesson(24 * 30);
    expect(await balanceOf(STUDENT)).toBe("400.00");
    await fileRefund(longAgo, { reason: "TUTOR_NO_SHOW" }).expect(201);
    expect(await balanceOf(STUDENT)).toBe("500.00");
  });

  it("allows only an admin-reviewed request before the lesson starts", async () => {
    const id = await paidLesson();
    const view = await authorize(request(app).get(`/api/bookings/${id}`), STUDENT).expect(200);
    expect(view.body.booking.actions).toMatchObject({
      canRequestRefund: true,
      canReportTutorNoShow: false,
    });
    const early = await fileRefund(id, { reason: "TUTOR_NO_SHOW" }).expect(409);
    expect(early.body.code).toBe("REFUND_NO_SHOW_TOO_EARLY");
    expect(await prisma.refundRequest.count({ where: { bookingId: id } })).toBe(0);

    await fileRefund(id, unsatisfactory).expect(201);
    const pending = await prisma.refundRequest.findUniqueOrThrow({ where: { bookingId: id } });
    await authorize(
      request(app).post(`/api/admin/refunds/${pending.id}/review`).send({ decision: "APPROVED" }),
      ADMIN
    ).expect(200);
    // The full amount comes back and the freed slot can be booked again.
    expect(await balanceOf(STUDENT)).toBe("500.00");
    expect(await prisma.availability.count({ where: { bookingId: id } })).toBe(0);
  });

  it("closes a pending request when the lesson is cancelled, so it can't refund twice", async () => {
    const id = await paidLesson();
    await fileRefund(id, unsatisfactory).expect(201);
    const quote = await authorize(
      request(app).get(`/api/bookings/${id}/tutor-cancellation-quote`),
      TEACHER
    ).expect(200);
    await authorize(
      request(app)
        .post(`/api/bookings/${id}/tutor-cancel`)
        .send({ reason: "I am sick", quoteToken: quote.body.quote.token }),
      TEACHER
    ).expect(200);
    expect(await balanceOf(STUDENT)).toBe("500.00");

    const closed = await prisma.refundRequest.findUniqueOrThrow({ where: { bookingId: id } });
    expect(closed).toMatchObject({
      status: "REJECTED",
      rejectionReason: "The lesson was cancelled, so its cancellation refund applies instead.",
    });
    await authorize(
      request(app).post(`/api/admin/refunds/${closed.id}/review`).send({ decision: "APPROVED" }),
      ADMIN
    ).expect(409);
    expect(await balanceOf(STUDENT)).toBe("500.00");
  });

  it("stops an admin deciding a refund for their own lesson", async () => {
    const id = await endedLesson();
    await fileRefund(id, unsatisfactory).expect(201);
    await prisma.user.update({ where: { id: TEACHER }, data: { isAdmin: true } });
    const request_ = await prisma.refundRequest.findUniqueOrThrow({ where: { bookingId: id } });
    const response = await authorize(
      request(app).post(`/api/admin/refunds/${request_.id}/review`).send({ decision: "APPROVED" }),
      TEACHER
    ).expect(403);
    expect(response.body.code).toBe("REFUND_SELF_REVIEW");
  });

  it("refunds once when the Student files twice at the same time", async () => {
    const id = await endedLesson();
    const responses = await Promise.all([
      fileRefund(id, { reason: "TUTOR_NO_SHOW" }),
      fileRefund(id, { reason: "TUTOR_NO_SHOW" }),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(await balanceOf(STUDENT)).toBe("500.00");
    expect(await prisma.walletTransaction.count({ where: { bookingId: id, type: "REFUND" } })).toBe(
      1
    );
  });

  it("does not let a refund request and the Tutor's confirmation both succeed", async () => {
    const id = await endedLesson();
    const [refund, confirm] = await Promise.all([
      fileRefund(id, unsatisfactory),
      authorize(request(app).post(`/api/bookings/${id}/confirm-completion`), TEACHER),
    ]);
    const succeeded = [refund.status === 201, confirm.status === 200].filter(Boolean);
    expect(succeeded).toHaveLength(1);
    const booking = await prisma.booking.findUniqueOrThrow({
      where: { id },
      include: { refundRequest: true },
    });
    // Either the lesson completed with no request, or the request is pending on a confirmed lesson.
    if (booking.status === "COMPLETED") expect(booking.refundRequest).toBeNull();
    else expect(booking.refundRequest?.status).toBe("PENDING");
  });
});
