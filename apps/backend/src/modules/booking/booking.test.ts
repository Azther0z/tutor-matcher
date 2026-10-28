import { describe, expect, it, jest } from "@jest/globals";
import { Prisma } from "../../generated/prisma/client.ts";
import {
  createBookingSchema,
  tutorCancelBookingSchema,
  updateMeetingLinkSchema,
} from "./booking.schema.ts";
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

describe("Tutor meeting link rules", () => {
  it("accepts HTTPS URLs up to 2048 characters and rejects longer URLs", () => {
    const prefix = "https://meet.example.com/";
    const maxLengthUrl = prefix + "a".repeat(2048 - prefix.length);

    expect(updateMeetingLinkSchema.safeParse({ customMeetingUrl: maxLengthUrl }).success).toBe(
      true
    );
    expect(
      updateMeetingLinkSchema.safeParse({ customMeetingUrl: `${maxLengthUrl}a` }).success
    ).toBe(false);
  });

  it("allows removing a Tutor URL and rejects non-HTTPS URLs", () => {
    expect(updateMeetingLinkSchema.safeParse({ customMeetingUrl: null }).success).toBe(true);
    expect(
      updateMeetingLinkSchema.safeParse({ customMeetingUrl: "http://meet.example.com/room" })
        .success
    ).toBe(false);
    expect(updateMeetingLinkSchema.safeParse({ customMeetingUrl: "not a URL" }).success).toBe(
      false
    );
  });
});

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
      customMeetingUrl: null,
      meetingLinkUpdatedAt: null,
      createdAt: now,
      status: "PENDING_PAYMENT",
      isTrial: true,
      totalAmount: new Prisma.Decimal("75.00"),
      startedAt: new Date("2026-09-13T02:00:00.000Z"),
      endedAt: new Date("2026-09-13T03:00:00.000Z"),
      paymentExpiresAt: new Date("2026-09-12T00:15:00.000Z"),
      cancelledAt: null,
      cancellationReason: null,
      cancelledBy: null,
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

  it("gives the tutor a cancel action and the student none for the same upcoming lesson", () => {
    const now = new Date("2026-09-12T00:00:00.000Z");
    const record = {
      id: "44444444-4444-4444-8444-444444444444",
      userId: SUBJECT_ID,
      subjectId: SUBJECT_ID,
      description: null,
      zoomMeetingUrl: null,
      customMeetingUrl: null,
      meetingLinkUpdatedAt: null,
      createdAt: now,
      status: "CONFIRMED",
      isTrial: true,
      totalAmount: new Prisma.Decimal("75.00"),
      startedAt: new Date("2026-09-12T10:00:00.000Z"),
      endedAt: new Date("2026-09-12T11:00:00.000Z"),
      paymentExpiresAt: null,
      cancelledAt: null,
      cancellationReason: null,
      cancelledBy: null,
      subjectName: null,
      subjectDescription: null,
      subjectHourlyRate: null,
      subjectFormat: null,
      user: { id: SUBJECT_ID, firstName: "Bob", lastName: "Smith", balance: new Prisma.Decimal(0) },
      subject: {
        id: SUBJECT_ID,
        name: "Mathematics",
        description: null,
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
          user: { id: SLOT_B, firstName: "Alice", lastName: "Johnson" },
        },
      },
      availabilities: [],
      walletTransactions: [],
    } satisfies Parameters<typeof mapBookingResponse>[0];

    const asTutor = mapBookingResponse(record, SLOT_B, now);
    expect(asTutor.viewerRole).toBe("TUTOR");
    expect(asTutor.actions).toMatchObject({
      canTutorCancel: true,
      canCancel: false,
      canConfirmCompletion: false,
    });
    expect(asTutor.payment.walletBalance).toBeNull();

    const asStudent = mapBookingResponse(record, SUBJECT_ID, now);
    expect(asStudent.viewerRole).toBe("STUDENT");
    expect(asStudent.actions).toMatchObject({
      canTutorCancel: false,
      canCancel: true,
      canConfirmCompletion: false,
    });

    const ended = { ...record, endedAt: now };
    expect(mapBookingResponse(ended, SLOT_B, now).actions.canConfirmCompletion).toBe(true);
    expect(mapBookingResponse(ended, SUBJECT_ID, now).actions.canConfirmCompletion).toBe(false);

    const withMeetingLinks = {
      ...record,
      zoomMeetingUrl: "https://meet.example.com/generated",
      customMeetingUrl: "https://meet.example.com/custom",
    };
    const activeAsTutor = mapBookingResponse(withMeetingLinks, SLOT_B, now);
    const activeAsStudent = mapBookingResponse(withMeetingLinks, SUBJECT_ID, now);
    expect(activeAsTutor).toMatchObject({
      effectiveMeetingUrl: "https://meet.example.com/custom",
      actions: { canEditMeetingLink: true, canJoin: true },
    });
    expect(activeAsStudent).toMatchObject({
      effectiveMeetingUrl: "https://meet.example.com/custom",
      actions: { canEditMeetingLink: false, canJoin: true },
    });

    const started = mapBookingResponse({ ...record, startedAt: now }, SLOT_B, now);
    expect(started.actions.canTutorCancel).toBe(false);
    expect(mapBookingResponse(record, SLOT_B, now).actions.canConfirmCompletion).toBe(false);
    expect(
      mapBookingResponse({ ...withMeetingLinks, endedAt: now }, SLOT_B, now).actions
    ).toMatchObject({
      canEditMeetingLink: false,
      canJoin: false,
    });
    const cancelled = mapBookingResponse(
      {
        ...withMeetingLinks,
        status: "CANCELLED",
        cancelledBy: "TUTOR",
        cancellationReason: "Sick",
      },
      SUBJECT_ID,
      now
    );
    expect(cancelled).toMatchObject({ cancelledBy: "TUTOR", cancellationReason: "Sick" });
    expect(cancelled.actions).toMatchObject({
      canTutorCancel: false,
      canEditMeetingLink: false,
      canJoin: false,
    });
    const completed = mapBookingResponse({ ...withMeetingLinks, status: "COMPLETED" }, SLOT_B, now);
    expect(completed.actions).toMatchObject({
      canEditMeetingLink: false,
      canJoin: false,
      canConfirmCompletion: false,
    });
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

  it.each([
    [24 * 60 * 60_000 + 1, false, "100.05"],
    [24 * 60 * 60_000, true, "70.04"],
    [24 * 60 * 60_000 - 1, true, "70.04"],
  ])(
    "uses server time at %s milliseconds before the lesson and rounds the wallet refund",
    (remaining, late, amount) => {
      const now = new Date("2030-01-01T00:00:00.000Z");
      const result = cancellationRefund(
        new Prisma.Decimal("100.05"),
        new Date(now.getTime() + Number(remaining)),
        now
      );
      expect(result.late).toBe(late);
      expect(result.amount.toFixed(2)).toBe(amount);
    }
  );

  it("requires the tutor to give a reason of at most 500 characters", () => {
    expect(tutorCancelBookingSchema.safeParse({}).success).toBe(false);
    expect(tutorCancelBookingSchema.safeParse({ reason: "   " }).success).toBe(false);
    expect(tutorCancelBookingSchema.safeParse({ reason: "x".repeat(501) }).success).toBe(false);
    expect(tutorCancelBookingSchema.safeParse({ reason: " Sick " }).data?.reason).toBe("Sick");
  });
});
