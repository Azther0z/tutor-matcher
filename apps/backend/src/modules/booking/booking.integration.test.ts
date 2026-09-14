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

const BOOK4_STUDENT_ID = "39000000-0000-4000-8000-000000000001";
const BOOK4_TUTOR_USER_ID = "39000000-0000-4000-8000-000000000002";
const BOOK4_TUTOR_ID = "39000000-0000-4000-8000-000000000003";
const BOOK4_STRANGER_ID = "39000000-0000-4000-8000-000000000004";
const BOOK4_SUBJECT_ID = "39000000-0000-4000-8000-000000000005";
const BOOK4_FAR_SLOT_ID = "39000000-0000-4000-8000-000000000006";
const BOOK4_NEAR_SLOT_ID = "39000000-0000-4000-8000-000000000007";
const BOOK4_RESCHEDULE_SLOT_ID = "39000000-0000-4000-8000-000000000008";
const BOOK4_RESCHEDULE_TARGET_SLOT_ID = "39000000-0000-4000-8000-000000000009";
const BOOK4_SLOT_IDS = [
  BOOK4_FAR_SLOT_ID,
  BOOK4_NEAR_SLOT_ID,
  BOOK4_RESCHEDULE_SLOT_ID,
  BOOK4_RESCHEDULE_TARGET_SLOT_ID,
];

const book4StudentToken = signAuthToken({
  sub: BOOK4_STUDENT_ID,
  email: "book4-student@example.com",
  isAdmin: false,
});
const book4TutorToken = signAuthToken({
  sub: BOOK4_TUTOR_USER_ID,
  email: "book4-tutor@example.com",
  isAdmin: false,
});
const book4StrangerToken = signAuthToken({
  sub: BOOK4_STRANGER_ID,
  email: "book4-stranger@example.com",
  isAdmin: false,
});
const asBook4Student = (test: request.Test) =>
  test.set("Authorization", `Bearer ${book4StudentToken}`);
const asBook4Tutor = (test: request.Test) => test.set("Authorization", `Bearer ${book4TutorToken}`);
const asBook4Stranger = (test: request.Test) =>
  test.set("Authorization", `Bearer ${book4StrangerToken}`);

async function cleanBook4Fixtures() {
  await prisma.payment.deleteMany({ where: { booking: { subjectId: BOOK4_SUBJECT_ID } } });
  await prisma.availability.updateMany({
    where: { id: { in: BOOK4_SLOT_IDS } },
    data: { bookingId: null },
  });
  await prisma.booking.deleteMany({ where: { subjectId: BOOK4_SUBJECT_ID } });
  await prisma.availabilitySubject.deleteMany({ where: { subjectId: BOOK4_SUBJECT_ID } });
  await prisma.availability.deleteMany({ where: { id: { in: BOOK4_SLOT_IDS } } });
  await prisma.subject.deleteMany({ where: { id: BOOK4_SUBJECT_ID } });
  await prisma.user.deleteMany({
    where: { id: { in: [BOOK4_STUDENT_ID, BOOK4_TUTOR_USER_ID, BOOK4_STRANGER_ID] } },
  });
  await prisma.tutor.deleteMany({ where: { id: BOOK4_TUTOR_ID } });
}

describeWithDatabase("BOOK-4: tutor cancellation and reschedule", () => {
  beforeAll(async () => {
    await cleanBook4Fixtures();
    await prisma.tutor.create({
      data: { id: BOOK4_TUTOR_ID, governmentId: "book4-fixture", status: "PUBLISHED" },
    });
    await prisma.user.createMany({
      data: [
        {
          id: BOOK4_STUDENT_ID,
          firstName: "Book4",
          lastName: "Student",
          email: "book4-student@example.com",
          password: "fixture",
          balance: "500.00",
        },
        {
          id: BOOK4_TUTOR_USER_ID,
          firstName: "Book4",
          lastName: "Tutor",
          email: "book4-tutor@example.com",
          password: "fixture",
          balance: "0.00",
          tutorId: BOOK4_TUTOR_ID,
        },
        {
          id: BOOK4_STRANGER_ID,
          firstName: "Book4",
          lastName: "Stranger",
          email: "book4-stranger@example.com",
          password: "fixture",
          balance: "0.00",
        },
      ],
    });
    await prisma.subject.create({
      data: {
        id: BOOK4_SUBJECT_ID,
        tutorId: BOOK4_TUTOR_ID,
        name: "Book4 Physics",
        hourlyRate: "150.00",
      },
    });
    await prisma.availability.createMany({
      data: [
        { id: BOOK4_FAR_SLOT_ID, startedAt: new Date(Date.now() + 48 * 60 * 60_000) },
        { id: BOOK4_NEAR_SLOT_ID, startedAt: new Date(Date.now() + 12 * 60 * 60_000) },
        { id: BOOK4_RESCHEDULE_SLOT_ID, startedAt: new Date(Date.now() + 96 * 60 * 60_000) },
        {
          id: BOOK4_RESCHEDULE_TARGET_SLOT_ID,
          startedAt: new Date(Date.now() + 120 * 60 * 60_000),
        },
      ],
    });
    await prisma.availabilitySubject.createMany({
      data: BOOK4_SLOT_IDS.map((availabilityId) => ({
        availabilityId,
        subjectId: BOOK4_SUBJECT_ID,
      })),
    });
  });

  afterAll(async () => {
    await cleanBook4Fixtures();
  });

  it("lets the tutor cancel a lesson more than 24 hours away with a full refund", async () => {
    const created = await asBook4Student(
      request(app)
        .post("/api/bookings")
        .send({ subjectId: BOOK4_SUBJECT_ID, availabilityIds: [BOOK4_FAR_SLOT_ID], isTrial: true })
    ).expect(201);
    const bookingId = created.body.booking.id as string;
    await asBook4Student(request(app).post(`/api/bookings/${bookingId}/confirm-payment`)).expect(
      200
    );

    // Neither the quote nor the cancel action is available to someone who isn't a party to the lesson.
    await asBook4Stranger(request(app).get(`/api/bookings/${bookingId}/cancellation-quote`)).expect(
      403
    );

    const quoteResponse = await asBook4Tutor(
      request(app).get(`/api/bookings/${bookingId}/cancellation-quote`)
    ).expect(200);
    const quote = quoteResponse.body.quote as {
      token: string;
      refundAmount: string;
      cancellationFee: string;
    };
    expect(quote.refundAmount).toBe("75.00");
    expect(quote.cancellationFee).toBe("0.00");

    const cancelled = await asBook4Tutor(
      request(app).post(`/api/bookings/${bookingId}/cancel`).send({ quoteToken: quote.token })
    ).expect(200);
    expect(cancelled.body.refund).toMatchObject({ amount: "75.00", cancellationFee: "0.00" });

    const [student, booking, payments] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: BOOK4_STUDENT_ID } }),
      prisma.booking.findUniqueOrThrow({ where: { id: bookingId } }),
      prisma.payment.findMany({ where: { bookingId }, orderBy: { createdAt: "asc" } }),
    ]);
    expect(student.balance.toFixed(2)).toBe("500.00");
    expect(booking).toMatchObject({ status: "CANCELLED", cancelledByUserId: BOOK4_TUTOR_USER_ID });
    expect(payments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "REFUND",
          status: "COMPLETED",
          fromUserId: null,
          toUserId: BOOK4_STUDENT_ID,
        }),
      ])
    );
  });

  it("still gives a full refund when the tutor cancels within the 24-hour window", async () => {
    const created = await asBook4Student(
      request(app)
        .post("/api/bookings")
        .send({ subjectId: BOOK4_SUBJECT_ID, availabilityIds: [BOOK4_NEAR_SLOT_ID], isTrial: true })
    ).expect(201);
    const bookingId = created.body.booking.id as string;
    await asBook4Student(request(app).post(`/api/bookings/${bookingId}/confirm-payment`)).expect(
      200
    );

    const quoteResponse = await asBook4Tutor(
      request(app).get(`/api/bookings/${bookingId}/cancellation-quote`)
    ).expect(200);
    const quote = quoteResponse.body.quote as {
      token: string;
      refundAmount: string;
      cancellationFee: string;
      lateCancellation: boolean;
    };
    // The window flag still reports "late" for messaging; only the rate is actor-gated.
    expect(quote.lateCancellation).toBe(true);
    expect(quote.refundAmount).toBe("75.00");
    expect(quote.cancellationFee).toBe("0.00");

    const cancelled = await asBook4Tutor(
      request(app).post(`/api/bookings/${bookingId}/cancel`).send({ quoteToken: quote.token })
    ).expect(200);
    expect(cancelled.body.refund.amount).toBe("75.00");

    const student = await prisma.user.findUniqueOrThrow({ where: { id: BOOK4_STUDENT_ID } });
    expect(student.balance.toFixed(2)).toBe("500.00");
  });

  it("lets the tutor reschedule a confirmed lesson and rejects a third party", async () => {
    const created = await asBook4Student(
      request(app)
        .post("/api/bookings")
        .send({
          subjectId: BOOK4_SUBJECT_ID,
          availabilityIds: [BOOK4_RESCHEDULE_SLOT_ID],
          isTrial: true,
        })
    ).expect(201);
    const bookingId = created.body.booking.id as string;
    await asBook4Student(request(app).post(`/api/bookings/${bookingId}/confirm-payment`)).expect(
      200
    );

    await asBook4Stranger(
      request(app)
        .patch(`/api/bookings/${bookingId}/reschedule`)
        .send({ availabilityIds: [BOOK4_RESCHEDULE_TARGET_SLOT_ID] })
    ).expect(403);

    const rescheduled = await asBook4Tutor(
      request(app)
        .patch(`/api/bookings/${bookingId}/reschedule`)
        .send({ availabilityIds: [BOOK4_RESCHEDULE_TARGET_SLOT_ID] })
    ).expect(200);
    expect(rescheduled.body.booking.availabilities).toEqual([
      expect.objectContaining({ id: BOOK4_RESCHEDULE_TARGET_SLOT_ID }),
    ]);

    const releasedSlot = await prisma.availability.findUniqueOrThrow({
      where: { id: BOOK4_RESCHEDULE_SLOT_ID },
    });
    expect(releasedSlot.bookingId).toBeNull();
  });
});
