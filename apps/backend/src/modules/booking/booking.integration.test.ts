import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import request from "supertest";
import { app } from "../../app.ts";
import { prisma } from "../../lib/db.ts";
import { signAuthToken } from "../../lib/jwt.ts";

const STUDENT_ID = "41000000-0000-4000-8000-000000000001";
const TUTOR_USER_ID = "41000000-0000-4000-8000-000000000002";
const TUTOR_ID = "41000000-0000-4000-8000-000000000003";
const SUBJECT_ID = "41000000-0000-4000-8000-000000000004";
const PENDING_SLOT_ID = "41000000-0000-4000-8000-000000000005";
const PAID_SLOT_ID = "41000000-0000-4000-8000-000000000006";
const INVALID_EXPIRY_SLOT_ID = "41000000-0000-4000-8000-000000000007";

const token = signAuthToken({
  sub: STUDENT_ID,
  email: "booking-integration-student@example.com",
  isAdmin: false,
});
const authorize = (test: request.Test) => test.set("Authorization", `Bearer ${token}`);

async function cleanFixtures() {
  await prisma.payment.deleteMany({ where: { booking: { subjectId: SUBJECT_ID } } });
  await prisma.availability.updateMany({
    where: { id: { in: [PENDING_SLOT_ID, PAID_SLOT_ID, INVALID_EXPIRY_SLOT_ID] } },
    data: { bookingId: null },
  });
  await prisma.booking.deleteMany({ where: { subjectId: SUBJECT_ID } });
  await prisma.availabilitySubject.deleteMany({ where: { subjectId: SUBJECT_ID } });
  await prisma.availability.deleteMany({
    where: { id: { in: [PENDING_SLOT_ID, PAID_SLOT_ID, INVALID_EXPIRY_SLOT_ID] } },
  });
  await prisma.subject.deleteMany({ where: { id: SUBJECT_ID } });
  await prisma.user.deleteMany({ where: { id: { in: [STUDENT_ID, TUTOR_USER_ID] } } });
  await prisma.tutor.deleteMany({ where: { id: TUTOR_ID } });
}

const describeWithDatabase =
  process.env.RUN_DATABASE_INTEGRATION === "true" ? describe : describe.skip;

describeWithDatabase("booking HTTP and database lifecycle", () => {
  beforeAll(async () => {
    await cleanFixtures();
    await prisma.tutor.create({
      data: { id: TUTOR_ID, governmentId: "integration-fixture", status: "PUBLISHED" },
    });
    await prisma.user.createMany({
      data: [
        {
          id: STUDENT_ID,
          firstName: "Test",
          lastName: "Student",
          email: "booking-integration-student@example.com",
          password: "fixture",
          balance: "500.00",
        },
        {
          id: TUTOR_USER_ID,
          firstName: "Test",
          lastName: "Tutor",
          email: "booking-integration-tutor@example.com",
          password: "fixture",
          balance: "0.00",
          tutorId: TUTOR_ID,
        },
      ],
    });
    await prisma.subject.create({
      data: {
        id: SUBJECT_ID,
        tutorId: TUTOR_ID,
        name: "Integration Mathematics",
        hourlyRate: "150.00",
      },
    });
    const pendingStartsAt = new Date(Date.now() + 48 * 60 * 60_000);
    const paidStartsAt = new Date(Date.now() + 12 * 60 * 60_000);
    const invalidExpiryStartsAt = new Date(Date.now() + 72 * 60 * 60_000);
    await prisma.availability.createMany({
      data: [
        { id: PENDING_SLOT_ID, startedAt: pendingStartsAt },
        { id: PAID_SLOT_ID, startedAt: paidStartsAt },
        { id: INVALID_EXPIRY_SLOT_ID, startedAt: invalidExpiryStartsAt },
      ],
    });
    await prisma.availabilitySubject.createMany({
      data: [
        { availabilityId: PENDING_SLOT_ID, subjectId: SUBJECT_ID },
        { availabilityId: PAID_SLOT_ID, subjectId: SUBJECT_ID },
        { availabilityId: INVALID_EXPIRY_SLOT_ID, subjectId: SUBJECT_ID },
      ],
    });
  });

  afterAll(async () => {
    await cleanFixtures();
  });

  it("returns the actual tutor response shape and cancels a pending transfer atomically", async () => {
    const created = await authorize(
      request(app)
        .post("/api/bookings")
        .send({
          subjectId: SUBJECT_ID,
          availabilityIds: [PENDING_SLOT_ID],
          isTrial: true,
        })
    ).expect(201);

    expect(created.body.booking.subject.tutor).toEqual({
      id: TUTOR_ID,
      name: "Test Tutor",
      avatarUrl: null,
    });
    expect(JSON.stringify(created.body)).not.toContain("governmentId");
    const bookingId = created.body.booking.id as string;

    const cancelled = await authorize(
      request(app).post(`/api/bookings/${bookingId}/cancel`).send({ reason: "Changed plans" })
    ).expect(200);

    expect(cancelled.body.booking.status).toBe("CANCELLED");
    const [booking, transfer, slot] = await Promise.all([
      prisma.booking.findUniqueOrThrow({ where: { id: bookingId } }),
      prisma.payment.findFirstOrThrow({ where: { bookingId, type: "TRANSFER" } }),
      prisma.availability.findUniqueOrThrow({ where: { id: PENDING_SLOT_ID } }),
    ]);
    expect(booking.status).toBe("CANCELLED");
    expect(transfer.status).toBe("CANCELLED");
    expect(slot.bookingId).toBeNull();
  });

  it("refunds from Platform while keeping the original payment and tutor wallet unchanged", async () => {
    const created = await authorize(
      request(app)
        .post("/api/bookings")
        .send({
          subjectId: SUBJECT_ID,
          availabilityIds: [PAID_SLOT_ID],
          isTrial: true,
        })
    ).expect(201);
    const bookingId = created.body.booking.id as string;

    await authorize(request(app).post(`/api/bookings/${bookingId}/confirm-payment`)).expect(200);
    const quoteResponse = await authorize(
      request(app).get(`/api/bookings/${bookingId}/cancellation-quote`)
    ).expect(200);
    const quote = quoteResponse.body.quote as {
      token: string;
      refundAmount: string;
      cancellationFee: string;
    };
    const cancelled = await authorize(
      request(app).post(`/api/bookings/${bookingId}/cancel`).send({ quoteToken: quote.token })
    ).expect(200);

    const [student, tutor, payments] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: STUDENT_ID } }),
      prisma.user.findUniqueOrThrow({ where: { id: TUTOR_USER_ID } }),
      prisma.payment.findMany({ where: { bookingId }, orderBy: { createdAt: "asc" } }),
    ]);
    expect(cancelled.body.refund).toMatchObject({
      amount: quote.refundAmount,
      cancellationFee: quote.cancellationFee,
    });
    expect(student.balance.toFixed(2)).toBe("477.50");
    expect(tutor.balance.toFixed(2)).toBe("0.00");
    expect(payments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "TRANSFER",
          status: "COMPLETED",
          completedAt: expect.any(Date),
          fromUserId: STUDENT_ID,
          toUserId: null,
        }),
        expect.objectContaining({
          type: "REFUND",
          status: "COMPLETED",
          fromUserId: null,
          toUserId: STUDENT_ID,
        }),
      ])
    );
  });

  it("rejects and releases a pending booking whose payment expiry is missing", async () => {
    const created = await authorize(
      request(app)
        .post("/api/bookings")
        .send({
          subjectId: SUBJECT_ID,
          availabilityIds: [INVALID_EXPIRY_SLOT_ID],
          isTrial: true,
        })
    ).expect(201);
    const bookingId = created.body.booking.id as string;
    await prisma.booking.update({ where: { id: bookingId }, data: { paymentExpiresAt: null } });

    const response = await authorize(
      request(app).post(`/api/bookings/${bookingId}/confirm-payment`)
    ).expect(409);
    expect(response.body.code).toBe("BOOKING_EXPIRED");

    const [booking, transfer, slot] = await Promise.all([
      prisma.booking.findUniqueOrThrow({ where: { id: bookingId } }),
      prisma.payment.findFirstOrThrow({ where: { bookingId, type: "TRANSFER" } }),
      prisma.availability.findUniqueOrThrow({ where: { id: INVALID_EXPIRY_SLOT_ID } }),
    ]);
    expect(booking).toMatchObject({ status: "CANCELLED", cancellationReason: "PAYMENT_EXPIRED" });
    expect(transfer.status).toBe("CANCELLED");
    expect(slot.bookingId).toBeNull();
  });
});
