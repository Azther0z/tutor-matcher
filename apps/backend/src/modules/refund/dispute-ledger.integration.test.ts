import { randomUUID } from "node:crypto";
import { URL } from "node:url";
import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import request from "supertest";
import { app } from "../../app.ts";
import { prisma } from "../../lib/db.ts";
import { signAuthToken } from "../../lib/jwt.ts";
import { Prisma } from "../../generated/prisma/client.ts";
import { appendWalletMovement } from "../wallet/wallet-ledger.ts";

// SAFE-4: a payment dispute is the PAY-3 refund request. These tests check the acceptance
// criterion on the ledger itself: whatever the admin decides is exactly what the ledger shows.
const enabled = process.env.RUN_DATABASE_INTEGRATION === "true";
if (enabled) {
  const target = new URL(process.env.DATABASE_URL ?? "");
  if (
    target.hostname !== "127.0.0.1" ||
    target.port !== "55439" ||
    target.username !== "safe4" ||
    target.pathname !== "/tutor_matcher_safe4_test"
  ) {
    throw new Error(
      "SAFE-4 integration tests require tutor_matcher_safe4_test as safe4 on 127.0.0.1:55439"
    );
  }
}

const STUDENT = randomUUID();
const TEACHER = randomUUID();
const ADMIN = randomUUID();
const TUTOR = randomUUID();
const SUBJECT = randomUUID();
const userIds = [STUDENT, TEACHER, ADMIN];
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

// Books and pays a lesson through the API, then moves it so its scheduled end has passed.
async function paidLessonThatEnded() {
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
  const endedAt = Date.now() - 3_600_000;
  await prisma.booking.update({
    where: { id },
    data: { startedAt: new Date(endedAt - 30 * 60_000), endedAt: new Date(endedAt) },
  });
  return id;
}

const ledger = () =>
  prisma.walletTransaction.findMany({
    where: { userId: STUDENT },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
const balance = async () =>
  (await prisma.user.findUniqueOrThrow({ where: { id: STUDENT } })).balance.toFixed(2);
const dispute = (bookingId: string) =>
  authorize(
    request(app)
      .post(`/api/bookings/${bookingId}/refund-request`)
      .send({ reason: "UNSATISFACTORY_LESSON", details: "The tutor left after ten minutes" }),
    STUDENT
  ).expect(201);
const disputeFor = (bookingId: string) =>
  prisma.refundRequest.findUniqueOrThrow({ where: { bookingId } });
const resolve = (requestId: string, body: object) =>
  authorize(request(app).post(`/api/admin/refunds/${requestId}/review`).send(body), ADMIN);

const run = enabled ? describe : describe.skip;

run("SAFE-4 payment disputes reflected in the wallet ledger", () => {
  beforeEach(async () => {
    await cleanFixtures();
    await prisma.user.createMany({
      data: userIds.map((id, index) => ({
        id,
        firstName: ["Student", "Tutor", "Admin"][index]!,
        lastName: "SAFE4",
        email: `safe4-${id}@example.com`,
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
      data: { id: SUBJECT, tutorId: TUTOR, name: "SAFE-4 Test", hourlyRate: "200.00" },
    });
  });
  afterAll(async () => {
    await cleanFixtures();
    await prisma.$disconnect();
  });

  it("approval appends one REFUND for the paid amount, linked to the dispute; history is untouched", async () => {
    const bookingId = await paidLessonThatEnded();
    await dispute(bookingId);
    const { id: requestId } = await disputeFor(bookingId);
    const before = await ledger();
    const payment = before.find(({ type }) => type === "LESSON_PAYMENT")!;
    const balanceBefore = await balance();
    // Filing a dispute alone moves no money.
    expect(before.map(({ type }) => type)).toEqual(["TOP_UP", "LESSON_PAYMENT"]);

    await resolve(requestId, { decision: "APPROVED" }).expect(200);

    const after = await ledger();
    expect(after.slice(0, before.length)).toEqual(before);
    expect(after).toHaveLength(before.length + 1);
    const refund = after.at(-1)!;
    expect(refund).toMatchObject({ type: "REFUND", userId: STUDENT, bookingId });
    expect(refund.amount.toFixed(2)).toBe(payment.amount.toFixed(2));
    expect(refund.balanceAfter.toFixed(2)).toBe(
      new Prisma.Decimal(balanceBefore).plus(payment.amount).toFixed(2)
    );
    expect(await balance()).toBe(refund.balanceAfter.toFixed(2));
    expect(await disputeFor(bookingId)).toMatchObject({
      status: "APPROVED",
      walletTransactionId: refund.id,
      reviewedById: ADMIN,
      reviewedAt: expect.any(Date),
    });

    // The Student's own ledger shows the refund, traceable to the cancelled lesson.
    const wallet = await authorize(request(app).get("/api/wallet/transactions"), STUDENT).expect(
      200
    );
    expect(wallet.body.transactions[0]).toMatchObject({
      id: refund.id,
      type: "REFUND",
      direction: "IN",
      amount: payment.amount.toFixed(2),
      booking: { id: bookingId, status: "CANCELLED" },
    });
  });

  it("rejection writes nothing to the ledger and records who decided and why", async () => {
    const bookingId = await paidLessonThatEnded();
    await dispute(bookingId);
    const { id: requestId } = await disputeFor(bookingId);
    const before = await ledger();
    const balanceBefore = await balance();

    await resolve(requestId, {
      decision: "REJECTED",
      rejectionReason: "The lesson ran for the full time",
    }).expect(200);

    expect(await ledger()).toEqual(before);
    expect(await balance()).toBe(balanceBefore);
    expect(await disputeFor(bookingId)).toMatchObject({
      status: "REJECTED",
      walletTransactionId: null,
      reviewedById: ADMIN,
      reviewedAt: expect.any(Date),
      rejectionReason: "The lesson ran for the full time",
    });
  });

  it("a resolved dispute cannot be resolved again, so the ledger keeps a single REFUND", async () => {
    const bookingId = await paidLessonThatEnded();
    await dispute(bookingId);
    const { id: requestId } = await disputeFor(bookingId);
    await resolve(requestId, { decision: "APPROVED" }).expect(200);
    const settled = await ledger();

    await resolve(requestId, { decision: "APPROVED" }).expect(409);
    await resolve(requestId, { decision: "REJECTED", rejectionReason: "Changed mind" }).expect(409);

    expect(await ledger()).toEqual(settled);
    expect(settled.filter(({ type }) => type === "REFUND")).toHaveLength(1);
  });
});
