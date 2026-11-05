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
      "CLASS-2 integration tests require the dedicated local tutor_matcher_book4_test database"
    );
  }
}

const STUDENT = "46000000-0000-4000-8000-000000000001";
const TEACHER = "46000000-0000-4000-8000-000000000002";
const OTHER = "46000000-0000-4000-8000-000000000003";
const TUTOR = "46000000-0000-4000-8000-000000000004";
const SUBJECT = "46000000-0000-4000-8000-000000000005";
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

async function moveLessonToPast(id: string) {
  const now = Date.now();
  await prisma.booking.update({
    where: { id },
    data: {
      startedAt: new Date(now - 90 * 60_000),
      endedAt: new Date(now - 60 * 60_000),
    },
  });
}

const run = enabled ? describe : describe.skip;

run("CLASS-2 Tutor lesson completion confirmation", () => {
  beforeEach(async () => {
    await cleanFixtures();
    await prisma.user.createMany({
      data: userIds.map((id, index) => ({
        id,
        firstName: ["Student", "Tutor", "Other"][index],
        lastName: "CLASS2",
        email: `class2-${index}@example.com`,
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
      data: { id: SUBJECT, tutorId: TUTOR, name: "CLASS-2 Test", hourlyRate: "200.00" },
    });
  });
  afterAll(cleanFixtures);

  it("lists only the assigned Tutor's ended, confirmed lessons", async () => {
    const ended = await createLesson(48);
    await moveLessonToPast(ended.id);
    await createLesson(72);
    const unpaid = await createLesson(96, false);
    await moveLessonToPast(unpaid.id);
    const cancelled = await createLesson(120);
    await prisma.booking.update({ where: { id: cancelled.id }, data: { status: "CANCELLED" } });

    const response = await authorize(
      request(app).get("/api/bookings/tutor/needs-confirmation")
    ).expect(200);
    expect(response.body.bookings.map((booking: { id: string }) => booking.id)).toEqual([ended.id]);
    expect(response.body.bookings[0]).toMatchObject({
      status: "CONFIRMED",
      student: { name: "Student CLASS2" },
      actions: { canConfirmCompletion: true },
    });
    await authorize(request(app).get("/api/bookings/tutor/needs-confirmation"), STUDENT).expect(
      403
    );
  });

  it("marks only an ended lesson completed after assigned Tutor confirmation", async () => {
    const { id } = await createLesson(48);
    await moveLessonToPast(id);
    await authorize(request(app).post(`/api/bookings/${id}/confirm-completion`), OTHER).expect(403);

    const confirmed = await authorize(
      request(app).post(`/api/bookings/${id}/confirm-completion`)
    ).expect(200);
    expect(confirmed.body.booking).toMatchObject({
      id,
      status: "COMPLETED",
      actions: { canConfirmCompletion: false },
    });
    const studentView = await authorize(request(app).get(`/api/bookings/${id}`), STUDENT).expect(
      200
    );
    expect(studentView.body.booking).toMatchObject({ status: "COMPLETED", viewerRole: "STUDENT" });
    expect(
      await prisma.walletTransaction.findMany({ where: { bookingId: id }, select: { type: true } })
    ).toEqual([{ type: "LESSON_PAYMENT" }]);
    expect(
      (await authorize(request(app).get("/api/bookings/tutor/needs-confirmation")).expect(200)).body
        .bookings
    ).toEqual([]);
    const repeated = await authorize(
      request(app).post(`/api/bookings/${id}/confirm-completion`)
    ).expect(409);
    expect(repeated.body).toMatchObject({
      code: "BOOKING_ALREADY_COMPLETED",
      message: "This lesson has already been completed",
    });
  });

  it("reports a distinct conflict when the Tutor tries to confirm a cancelled lesson", async () => {
    const { id } = await createLesson(72);
    await moveLessonToPast(id);
    await prisma.booking.update({ where: { id }, data: { status: "CANCELLED" } });

    const response = await authorize(
      request(app).post(`/api/bookings/${id}/confirm-completion`)
    ).expect(409);
    expect(response.body).toMatchObject({
      code: "BOOKING_CANCELLED",
      message: "This booking was cancelled",
    });
  });

  it("keeps the net earning pending across completion and unlocks only the Student's review eligibility", async () => {
    const { id } = await createLesson(48);
    await moveLessonToPast(id);
    const before = await authorize(request(app).get(`/api/bookings/${id}`), STUDENT).expect(200);
    expect(before.body.booking.actions.canReview).toBe(false);
    const walletBefore = await authorize(request(app).get("/api/wallet/overview")).expect(200);
    expect(walletBefore.body).toMatchObject({
      balance: "0.00",
      pendingEarnings: "85.00",
      earningsThisMonth: "0.00",
    });

    const completed = await authorize(
      request(app).post(`/api/bookings/${id}/confirm-completion`)
    ).expect(200);
    expect(completed.body.booking).toMatchObject({
      status: "COMPLETED",
      earnings: { amount: "85.00", status: "PENDING" },
      actions: { canReview: false },
    });
    const studentView = await authorize(request(app).get(`/api/bookings/${id}`), STUDENT).expect(
      200
    );
    expect(studentView.body.booking).toMatchObject({
      actions: { canReview: true },
      earnings: null,
    });
    await authorize(request(app).get(`/api/bookings/${id}`), OTHER).expect(403);
    await authorize(request(app).post(`/api/bookings/${id}/confirm-completion`)).expect(409);
    const walletAfter = await authorize(request(app).get("/api/wallet/overview")).expect(200);
    expect(walletAfter.body).toMatchObject({
      balance: "0.00",
      pendingEarnings: "85.00",
      earningsThisMonth: "0.00",
    });
    const history = await authorize(request(app).get("/api/wallet/transactions")).expect(200);
    expect(history.body.transactions).toEqual([]);

    // A future PAY-6 release is represented by an actual ledger movement, never a pending row.
    await prisma.$transaction(
      (tx) =>
        appendWalletMovement(tx, {
          userId: TEACHER,
          type: "LESSON_EARNING",
          amount: "85.00",
          bookingId: id,
        }),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    const cleared = await authorize(request(app).get("/api/wallet/overview")).expect(200);
    expect(cleared.body).toMatchObject({
      balance: "85.00",
      pendingEarnings: "0.00",
      earningsThisMonth: "85.00",
    });
    const released = await authorize(request(app).get(`/api/bookings/${id}`)).expect(200);
    expect(released.body.booking.earnings).toEqual({ amount: "85.00", status: "RELEASED" });
  });

  it("does not duplicate pending earnings or write credit when confirmations race", async () => {
    const { id } = await createLesson(48);
    await moveLessonToPast(id);
    const responses = await Promise.all([
      authorize(request(app).post(`/api/bookings/${id}/confirm-completion`)),
      authorize(request(app).post(`/api/bookings/${id}/confirm-completion`)),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    const overview = await authorize(request(app).get("/api/wallet/overview")).expect(200);
    expect(overview.body).toMatchObject({ balance: "0.00", pendingEarnings: "85.00" });
    expect(
      await prisma.walletTransaction.count({ where: { bookingId: id, type: "LESSON_EARNING" } })
    ).toBe(0);
  });

  it("rejects confirmation before scheduled end", async () => {
    const { id } = await createLesson(48);
    await authorize(request(app).post(`/api/bookings/${id}/confirm-completion`)).expect(409);
  });
});
