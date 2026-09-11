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
    const now = new Date("2026-09-12T00:00:00.000Z");
    const booking = mapBookingResponse(
      {
        id: "44444444-4444-4444-8444-444444444444",
        userId: SUBJECT_ID,
        subjectId: SUBJECT_ID,
        description: "Algebra",
        zoomMeetingUrl: null,
        createdAt: now,
        status: "PENDING_PAYMENT",
        isTrial: true,
        totalAmount: new Prisma.Decimal("75.00"),
        startedAt: new Date("2026-09-13T02:00:00.000Z"),
        endedAt: new Date("2026-09-13T03:00:00.000Z"),
        paymentExpiresAt: new Date("2026-09-12T00:15:00.000Z"),
        cancelledAt: null,
        cancellationReason: null,
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
            enrolledAt: now,
            status: "PUBLISHED",
            user: {
              id: SLOT_B,
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
            createdAt: now,
            completedAt: null,
            fromUserId: SUBJECT_ID,
            toUserId: SLOT_B,
            bookingId: "44444444-4444-4444-8444-444444444444",
          },
        ],
      },
      SUBJECT_ID,
      now
    );

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
});
