import { describe, expect, it } from "@jest/globals";
import { Prisma } from "../../generated/prisma/client.ts";
import { createBookingSchema } from "./booking.schema.ts";
import {
  assertSlotBlock,
  BookingDomainError,
  cancellationRefund,
  mapBookingResponse,
} from "./booking.service.ts";

const SUBJECT_ID = "11111111-1111-4111-8111-111111111111";
const SLOT_A = "22222222-2222-4222-8222-222222222222";
const SLOT_B = "33333333-3333-4333-8333-333333333333";
const BOOKING_ID = "44444444-4444-4444-8444-444444444444";
// The tutor's own user id, distinct from SUBJECT_ID (reused above as the student's user id).
const TUTOR_USER_ID = SLOT_B;
const FIXED_NOW = new Date("2026-09-12T00:00:00.000Z");

type DetailRecord = Parameters<typeof mapBookingResponse>[0];

// BOOK-4: both the existing student-viewer test and the new tutor-viewer tests need the
// identical booking shape, differing only in which participant is looking at it.
function buildDetailRecord(overrides: Partial<DetailRecord> = {}): DetailRecord {
  return {
    id: BOOKING_ID,
    userId: SUBJECT_ID,
    subjectId: SUBJECT_ID,
    description: "Algebra",
    zoomMeetingUrl: null,
    createdAt: FIXED_NOW,
    status: "PENDING_PAYMENT",
    isTrial: true,
    totalAmount: new Prisma.Decimal("75.00"),
    startedAt: new Date("2026-09-13T02:00:00.000Z"),
    endedAt: new Date("2026-09-13T03:00:00.000Z"),
    paymentExpiresAt: new Date("2026-09-12T00:15:00.000Z"),
    cancelledAt: null,
    cancellationReason: null,
    cancelledByUserId: null,
    user: {
      id: SUBJECT_ID,
      firstName: "Bob",
      lastName: "Smith",
      balance: new Prisma.Decimal("10.00"),
    },
    subject: {
      id: SUBJECT_ID,
      name: "Mathematics",
      description: "Math",
      videoUrl: null,
      hourlyRate: new Prisma.Decimal("75.00"),
      tutorId: SLOT_A,
      tutor: {
        id: SLOT_A,
        avatarUrl: null,
        bio: null,
        introVideoUrl: null,
        governmentId: "fixture",
        enrolledAt: FIXED_NOW,
        status: "PUBLISHED",
        user: {
          id: TUTOR_USER_ID,
          firstName: "Alice",
          lastName: "Johnson",
        },
      },
    },
    availabilities: [],
    payments: [
      {
        id: SLOT_B,
        type: "TRANSFER",
        amount: new Prisma.Decimal("75.00"),
        status: "PENDING",
        createdAt: FIXED_NOW,
        completedAt: null,
        fromUserId: SUBJECT_ID,
        toUserId: TUTOR_USER_ID,
        bookingId: BOOKING_ID,
      },
    ],
    ...overrides,
  };
}

describe("trial booking rules", () => {
  it("rejects duplicate slots before creating a booking", () => {
    expect(
      createBookingSchema.safeParse({
        subjectId: SUBJECT_ID,
        availabilityIds: [SLOT_A, SLOT_A],
        isTrial: true,
      }).success
    ).toBe(false);
  });

  it("accepts UUID identifiers and rejects legacy integer identifiers", () => {
    expect(
      createBookingSchema.safeParse({
        subjectId: SUBJECT_ID,
        availabilityIds: [SLOT_A, SLOT_B],
        isTrial: true,
      }).success
    ).toBe(true);
    expect(
      createBookingSchema.safeParse({ subjectId: 1, availabilityIds: [2], isTrial: true }).success
    ).toBe(false);
  });

  it("accepts consecutive slots on the same Bangkok calendar day", () => {
    expect(() =>
      assertSlotBlock(
        [
          { startedAt: new Date("2026-09-12T02:00:00.000Z") },
          { startedAt: new Date("2026-09-12T02:30:00.000Z") },
        ],
        SUBJECT_ID
      )
    ).not.toThrow();
  });

  it("rejects a continuous UTC block that crosses midnight in Bangkok", () => {
    try {
      assertSlotBlock(
        [
          { startedAt: new Date("2026-09-12T16:30:00.000Z") },
          { startedAt: new Date("2026-09-12T17:00:00.000Z") },
        ],
        SUBJECT_ID
      );
      throw new Error("Expected the slot block to be rejected");
    } catch (error) {
      expect(error).toBeInstanceOf(BookingDomainError);
      expect((error as BookingDomainError).code).toBe("INVALID_SLOT_BLOCK");
    }
  });

  it("rejects non-adjacent slots with a stable error code", () => {
    try {
      assertSlotBlock(
        [
          { startedAt: new Date("2026-09-12T02:00:00.000Z") },
          { startedAt: new Date("2026-09-12T03:00:00.000Z") },
        ],
        SUBJECT_ID
      );
      throw new Error("Expected the slot block to be rejected");
    } catch (error) {
      expect((error as BookingDomainError).code).toBe("INVALID_SLOT_BLOCK");
    }
  });

  it("maps the backend record to the safe shared tutor and shortfall contract", () => {
    const booking = mapBookingResponse(buildDetailRecord(), SUBJECT_ID, FIXED_NOW);

    expect(booking.subject.tutor).toEqual({
      id: SLOT_A,
      name: "Alice Johnson",
      avatarUrl: null,
    });
    expect(booking.payment).toMatchObject({
      walletBalance: "10.00",
      amountDue: "75.00",
      shortfall: "65.00",
      canPay: false,
    });
    expect(booking.actions.canPay).toBe(true);
    expect(booking.viewerRole).toBe("STUDENT");
    expect(JSON.stringify(booking)).not.toContain("email");
    expect(JSON.stringify(booking)).not.toContain("governmentId");
  });

  it("refunds the full credit more than 24 hours before the lesson", () => {
    const result = cancellationRefund(
      new Prisma.Decimal("100.00"),
      new Date("2026-09-07T01:00:01Z"),
      new Date("2026-09-06T01:00:00Z")
    );
    expect(result.late).toBe(false);
    expect(result.amount.toString()).toBe("100");
  });

  it("refunds 70 percent at exactly 24 hours or less", () => {
    const result = cancellationRefund(
      new Prisma.Decimal("100.00"),
      new Date("2026-09-07T01:00:00Z"),
      new Date("2026-09-06T01:00:00Z")
    );
    expect(result.late).toBe(true);
    expect(result.amount.toString()).toBe("70");
  });

  it("never charges a tutor-initiated cancellation a late fee", () => {
    const result = cancellationRefund(
      new Prisma.Decimal("100.00"),
      new Date("2026-09-07T01:00:00Z"),
      new Date("2026-09-06T01:00:00Z"),
      "TUTOR"
    );
    expect(result.late).toBe(true);
    expect(result.amount.toString()).toBe("100");
  });
});

describe("BOOK-4 tutor cancellation and reschedule rules", () => {
  it("lets the tutor who owns the subject cancel or reschedule, with no payment access", () => {
    const booking = mapBookingResponse(
      buildDetailRecord({ status: "CONFIRMED" }),
      TUTOR_USER_ID,
      FIXED_NOW
    );

    expect(booking.viewerRole).toBe("TUTOR");
    expect(booking.actions).toMatchObject({ canPay: false, canCancel: true, canReschedule: true });
    expect(booking.payment.walletBalance).toBeNull();
    expect(booking.payment.shortfall).toBeNull();
    expect(JSON.stringify(booking)).not.toContain("email");
    expect(JSON.stringify(booking)).not.toContain("governmentId");
  });

  it("reports which side cancelled", () => {
    const uncancelled = mapBookingResponse(buildDetailRecord(), SUBJECT_ID, FIXED_NOW);
    expect(uncancelled.cancelledByRole).toBeNull();

    const studentCancelled = mapBookingResponse(
      buildDetailRecord({ cancelledByUserId: SUBJECT_ID }),
      SUBJECT_ID,
      FIXED_NOW
    );
    expect(studentCancelled.cancelledByRole).toBe("STUDENT");

    const tutorCancelled = mapBookingResponse(
      buildDetailRecord({ cancelledByUserId: TUTOR_USER_ID }),
      SUBJECT_ID,
      FIXED_NOW
    );
    expect(tutorCancelled.cancelledByRole).toBe("TUTOR");
  });
});
