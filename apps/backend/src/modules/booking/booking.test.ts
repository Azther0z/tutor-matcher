import { describe, expect, it, jest } from "@jest/globals";
import { Prisma } from "../../generated/prisma/client.ts";
import { createBookingSchema } from "./booking.schema.ts";
import {
  assertSlotBlock,
  BookingDomainError,
  cancellationRefund,
  mapBookingResponse,
  waitForBookingNotifications,
} from "./booking.service.ts";

const SUBJECT_ID = "11111111-1111-4111-8111-111111111111";
const SLOT_A = "22222222-2222-4222-8222-222222222222";
const SLOT_B = "33333333-3333-4333-8333-333333333333";

it("bounds notification waiting and logs late lookup failures without private details", async () => {
  jest.useFakeTimers();
  const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
  try {
    let reject!: (error: Error) => void;
    const pending = new Promise<void>((_resolve, rejectPromise) => {
      reject = rejectPromise;
    });
    const waiting = waitForBookingNotifications([
      pending,
      Promise.reject(new Error("missing user")),
    ]);
    await jest.advanceTimersByTimeAsync(1000);
    await expect(waiting).resolves.toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
    reject(new Error("late DB failure"));
    await jest.advanceTimersByTimeAsync(0);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith("[notification:booking] Notification failed", {
      recipientIndex: 0,
    });
    expect(warn).toHaveBeenCalledWith("[notification:booking] Notification failed", {
      recipientIndex: 1,
    });
    expect(jest.getTimerCount()).toBe(0);
  } finally {
    warn.mockRestore();
    jest.useRealTimers();
  }
});

it("logs immediate notification rejection but not successful delivery", async () => {
  const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
  try {
    await expect(
      waitForBookingNotifications([
        Promise.resolve(),
        Promise.reject(new Error("private recipient details")),
      ])
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith("[notification:booking] Notification failed", {
      recipientIndex: 1,
    });
  } finally {
    warn.mockRestore();
  }
});

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
    const record = {
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
      subjectName: null,
      subjectDescription: null,
      subjectHourlyRate: null,
      subjectFormat: null,
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
        format: "ONLINE",
        tutorId: SLOT_A,
        tutor: {
          id: SLOT_A,
          currentProfileVersion: { avatarUrl: null, status: "APPROVED", certifications: [] },
          currentProfileVersionId: SLOT_B,
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
      walletTransactions: [],
    } satisfies Parameters<typeof mapBookingResponse>[0];
    const booking = mapBookingResponse(record, SUBJECT_ID, now);

    expect(booking.subject.tutor).toEqual({
      id: SLOT_A,
      name: "Alice Johnson",
      avatarUrl: null,
      certificationUrls: [],
    });
    expect(booking.payment).toMatchObject({
      walletBalance: "10.00",
      amountDue: "75.00",
      shortfall: "65.00",
      canPay: false,
    });
    expect(booking.actions.canPay).toBe(true);
    expect(JSON.stringify(booking)).not.toContain("email");
    expect(JSON.stringify(booking)).not.toContain("identificationCardUrl");

    const preserved = mapBookingResponse(
      {
        ...record,
        subjectName: "Originally booked offering",
        subjectDescription: null,
        subjectHourlyRate: new Prisma.Decimal("50.25"),
        subjectFormat: "ONLINE",
        subject: {
          ...record.subject,
          name: "Changed offering",
          description: "New description",
          hourlyRate: new Prisma.Decimal("999.00"),
        },
      },
      SUBJECT_ID,
      now
    );
    expect(preserved.subject).toMatchObject({
      name: "Originally booked offering",
      description: null,
      hourlyRate: "50.25",
      format: "ONLINE",
    });
    expect(preserved.totalAmount).toBe("75.00");
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
