import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import request from "supertest";
import { app } from "../../app.ts";
import { prisma } from "../../lib/db.ts";
import { signAuthToken } from "../../lib/jwt.ts";

const PORTFOLIO_URLS = ["http://example.com/contest-a", "https://example.com/contest-b"];

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
  await prisma.message.deleteMany({
    where: { OR: [{ fromUserId: STUDENT_ID }, { fromUserId: TUTOR_USER_ID }] },
  });
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
  await prisma.user.updateMany({ where: { id: TUTOR_USER_ID }, data: { tutorId: null } });
  await prisma.tutor.deleteMany({ where: { id: TUTOR_ID } });
  await prisma.tutorProfileVersion.deleteMany({ where: { userId: TUTOR_USER_ID } });
  await prisma.user.deleteMany({ where: { id: { in: [STUDENT_ID, TUTOR_USER_ID] } } });
}

const describeWithDatabase =
  process.env.RUN_DATABASE_INTEGRATION === "true" ? describe : describe.skip;

describeWithDatabase("booking HTTP and database lifecycle", () => {
  beforeAll(async () => {
    await cleanFixtures();
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
        },
      ],
    });
    await prisma.tutor.create({
      data: {
        id: TUTOR_ID,
        status: "PUBLISHED",
        currentProfileVersion: {
          create: {
            userId: TUTOR_USER_ID,
            status: "APPROVED",
            identificationCardUrl: "https://example.com/id.png",
            bio: "Integration tutor",
            certifications: { create: PORTFOLIO_URLS.map((fileUrl) => ({ fileUrl })) },
          },
        },
      },
    });
    await prisma.user.update({ where: { id: TUTOR_USER_ID }, data: { tutorId: TUTOR_ID } });
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
        { id: PENDING_SLOT_ID, startedAt: pendingStartsAt, tutorId: TUTOR_ID },
        { id: PAID_SLOT_ID, startedAt: paidStartsAt, tutorId: TUTOR_ID },
        { id: INVALID_EXPIRY_SLOT_ID, startedAt: invalidExpiryStartsAt, tutorId: TUTOR_ID },
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
      certificationUrls: PORTFOLIO_URLS,
    });
    expect(JSON.stringify(created.body)).not.toContain("identificationCardUrl");
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
  it("unpublishing blocks new bookings without removing existing lessons or conversations", async () => {
    const created = await authorize(
      request(app)
        .post("/api/bookings")
        .send({
          subjectId: SUBJECT_ID,
          availabilityIds: [PENDING_SLOT_ID],
          isTrial: true,
        })
    ).expect(201);
    await prisma.tutor.update({ where: { id: TUTOR_ID }, data: { status: "UNPUBLISHED" } });
    try {
      const availability = await authorize(
        request(app).get(`/api/bookings/subjects/${SUBJECT_ID}/availability`)
      ).expect(200);
      expect(availability.body).toMatchObject({
        acceptingBookings: false,
        slots: [],
        subject: { id: SUBJECT_ID, tutor: { certificationUrls: PORTFOLIO_URLS } },
      });
      await authorize(
        request(app)
          .post("/api/bookings")
          .send({
            subjectId: SUBJECT_ID,
            availabilityIds: [PAID_SLOT_ID],
            isTrial: true,
          })
      ).expect(404);
      const lesson = await authorize(
        request(app).get(`/api/bookings/${created.body.booking.id}`)
      ).expect(200);
      expect(lesson.body.booking.subject.id).toBe(SUBJECT_ID);
      expect(lesson.body.booking.subject.tutor.certificationUrls).toEqual(PORTFOLIO_URLS);
      expect(JSON.stringify(lesson.body)).not.toContain("identificationCardUrl");
      expect(JSON.stringify(lesson.body)).not.toContain("https://example.com/id.png");
      await authorize(
        request(app)
          .post("/api/messages")
          .send({ toUserId: TUTOR_USER_ID, message: "See you at our lesson" })
      ).expect(201);
      const thread = await authorize(
        request(app).get(`/api/messages/thread/${TUTOR_USER_ID}`)
      ).expect(200);
      expect(thread.body).toEqual(
        expect.arrayContaining([expect.objectContaining({ message: "See you at our lesson" })])
      );
    } finally {
      await prisma.tutor.update({ where: { id: TUTOR_ID }, data: { status: "PUBLISHED" } });
    }
  });

  it("preserves new and legacy booked details when a Tutor edits only one offering", async () => {
    const tutorToken = signAuthToken({
      sub: TUTOR_USER_ID,
      email: "booking-integration-tutor@example.com",
      isAdmin: false,
    });
    const asTutor = (test: request.Test) => test.set("Authorization", `Bearer ${tutorToken}`);
    const path = "/api/profiles/me/tutor/subjects";
    const original = await prisma.subject.findUniqueOrThrow({ where: { id: SUBJECT_ID } });
    const existing = await prisma.booking.findFirstOrThrow({ where: { subjectId: SUBJECT_ID } });
    const legacy = await prisma.booking.create({
      data: {
        userId: STUDENT_ID,
        subjectId: SUBJECT_ID,
        status: "CONFIRMED",
        totalAmount: "75.00",
        startedAt: existing.startedAt,
        endedAt: existing.endedAt,
      },
    });
    const sibling = await asTutor(
      request(app).post(path).send({
        name: original.name,
        description: "Another independent offering",
        hourlyRate: "120.50",
        format: "ONLINE",
      })
    ).expect(201);
    try {
      await authorize(
        request(app).put(`${path}/${SUBJECT_ID}`).send({
          name: "Unauthorized",
          description: "No change",
          hourlyRate: "1.00",
          format: "ONLINE",
        })
      ).expect(403);
      const updated = await asTutor(
        request(app).put(`${path}/${SUBJECT_ID}`).send({
          name: "Advanced Mathematics",
          description: "Updated offering",
          hourlyRate: "199.50",
          format: "ONLINE",
        })
      ).expect(200);
      expect(updated.body.subject.name).toBe("Advanced Mathematics");
      const list = await asTutor(request(app).get(path)).expect(200);
      expect(list.body.subjects).toEqual(
        expect.arrayContaining([sibling.body.subject, updated.body.subject])
      );
      const ownerProfile = await asTutor(request(app).get("/api/profiles/me/tutor")).expect(200);
      expect(ownerProfile.body.tutor.subjects).toEqual(list.body.subjects);

      for (const booking of [existing, legacy]) {
        const detail = await authorize(request(app).get(`/api/bookings/${booking.id}`)).expect(200);
        expect(detail.body.booking.subject).toMatchObject({
          name: original.name,
          description: original.description,
          hourlyRate: original.hourlyRate.toFixed(2),
          format: "ONLINE",
        });
        expect(detail.body.booking.totalAmount).toBe(booking.totalAmount.toFixed(2));
        const stored = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
        expect(stored.subjectName).toBe(original.name);
      }
      const created = await authorize(
        request(app)
          .post("/api/bookings")
          .send({ subjectId: SUBJECT_ID, availabilityIds: [INVALID_EXPIRY_SLOT_ID], isTrial: true })
      ).expect(201);
      expect(created.body.booking.subject).toMatchObject({
        name: "Advanced Mathematics",
        description: "Updated offering",
        hourlyRate: "199.50",
        format: "ONLINE",
      });
      expect(created.body.booking.totalAmount).toBe("99.75");
    } finally {
      await prisma.subject.delete({ where: { id: sibling.body.subject.id } });
    }
  });
});
