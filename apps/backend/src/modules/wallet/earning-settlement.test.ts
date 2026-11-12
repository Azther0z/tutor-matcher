import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Prisma } from "../../generated/prisma/client.ts";

const findTutor = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const findCandidates = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const findBooking = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const updateUser = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const findWalletOwner = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const findWalletOwnerOrThrow = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const createMovement = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const tx = {
  booking: { findFirst: findBooking },
  user: {
    updateMany: updateUser,
    findUnique: findWalletOwner,
    findUniqueOrThrow: findWalletOwnerOrThrow,
  },
  walletTransaction: { create: createMovement },
};
const transaction =
  jest.fn<(callback: (client: typeof tx) => Promise<unknown>) => Promise<unknown>>();
jest.unstable_mockModule("../../lib/db.ts", () => ({
  prisma: {
    user: { findUnique: findTutor },
    booking: { findMany: findCandidates },
    $transaction: transaction,
  },
}));

const {
  LESSON_EARNING_CLEARING_HOURS,
  lessonEarningClearsAt,
  lessonEarningHoldReason,
  settleTutorEarnings,
} = await import("./earning-settlement.service.ts");

const USER_ID = "11111111-1111-4111-8111-111111111111";
const TUTOR_ID = "22222222-2222-4222-8222-222222222222";
const BOOKING_ID = "33333333-3333-4333-8333-333333333333";
const ENDED_AT = new Date("2026-11-10T12:00:00.000Z");
const NOW = new Date("2026-11-11T12:00:00.000Z");

function lesson(overrides: object = {}) {
  return {
    id: BOOKING_ID,
    status: "COMPLETED",
    endedAt: ENDED_AT,
    totalAmount: new Prisma.Decimal("100.00"),
    walletTransactions: [{ type: "LESSON_PAYMENT" }],
    refundRequest: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  findTutor.mockResolvedValue({ tutorId: TUTOR_ID });
  findCandidates.mockResolvedValue([{ id: BOOKING_ID }]);
  findBooking.mockResolvedValue(lesson());
  updateUser.mockResolvedValue({ count: 1 });
  findWalletOwner.mockResolvedValue({ balance: new Prisma.Decimal("85.00") });
  findWalletOwnerOrThrow.mockResolvedValue({ balance: new Prisma.Decimal("85.00") });
  createMovement.mockResolvedValue({ id: BOOKING_ID });
  transaction.mockImplementation(async (callback) => callback(tx));
});

describe("lesson earning clearing policy", () => {
  it("waits exactly 24 hours from the scheduled lesson end", () => {
    expect(LESSON_EARNING_CLEARING_HOURS).toBe(24);
    expect(lessonEarningClearsAt(ENDED_AT)).toEqual(NOW);
    expect(lessonEarningHoldReason("COMPLETED", ENDED_AT, null, new Date(NOW.getTime() - 1))).toBe(
      "CLEARING_PERIOD"
    );
    expect(lessonEarningHoldReason("COMPLETED", ENDED_AT, null, NOW)).toBe("READY_TO_CLEAR");
  });

  it("requires Tutor completion and an Admin decision before clearing", () => {
    expect(lessonEarningHoldReason("CONFIRMED", ENDED_AT, null, NOW)).toBe("AWAITING_COMPLETION");
    expect(lessonEarningHoldReason("COMPLETED", ENDED_AT, "PENDING", NOW)).toBe("REFUND_REVIEW");
    expect(lessonEarningHoldReason("COMPLETED", ENDED_AT, "REJECTED", NOW)).toBe("READY_TO_CLEAR");
  });
});

describe("settleTutorEarnings", () => {
  it("credits the rounded Tutor share and writes one earning movement", async () => {
    await expect(settleTutorEarnings(USER_ID, NOW)).resolves.toBe(1);
    expect(updateUser).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { balance: { increment: new Prisma.Decimal("85.00") } },
    });
    expect(createMovement).toHaveBeenCalledWith({
      data: {
        userId: USER_ID,
        type: "LESSON_EARNING",
        amount: new Prisma.Decimal("85.00"),
        bookingId: BOOKING_ID,
        balanceAfter: new Prisma.Decimal("85.00"),
      },
    });
  });

  it("rounds the platform fee to cents for each booking before crediting the Tutor share", async () => {
    findBooking.mockResolvedValue(lesson({ totalAmount: new Prisma.Decimal("333.33") }));
    await expect(settleTutorEarnings(USER_ID, NOW)).resolves.toBe(1);
    expect(updateUser).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { balance: { increment: new Prisma.Decimal("283.33") } },
    });
  });

  it("uses existing completed classes and filters candidates by owner and payment", async () => {
    await settleTutorEarnings(USER_ID, NOW);
    expect(findCandidates).toHaveBeenCalledWith({
      where: {
        status: "COMPLETED",
        endedAt: { lte: new Date(NOW.getTime() - 24 * 60 * 60_000) },
        subject: { tutorId: TUTOR_ID },
        walletTransactions: {
          some: { type: "LESSON_PAYMENT" },
          none: { type: "LESSON_EARNING" },
        },
      },
      select: { id: true },
      orderBy: [{ endedAt: "asc" }, { id: "asc" }],
    });
  });

  it.each([
    ["not completed", lesson({ status: "CONFIRMED" })],
    [
      "refund approved before clearing",
      lesson({ status: "CANCELLED", refundRequest: { status: "APPROVED" } }),
    ],
    ["pending refund", lesson({ refundRequest: { status: "PENDING" } })],
    [
      "already cleared",
      lesson({ walletTransactions: [{ type: "LESSON_PAYMENT" }, { type: "LESSON_EARNING" }] }),
    ],
    ["not yet elapsed", lesson({ endedAt: new Date(ENDED_AT.getTime() + 1) })],
  ])("leaves %s earnings pending", async (_case, booking) => {
    findBooking.mockResolvedValue(booking);
    await expect(settleTutorEarnings(USER_ID, NOW)).resolves.toBe(0);
    expect(updateUser).not.toHaveBeenCalled();
    expect(createMovement).not.toHaveBeenCalled();
  });

  it("does nothing for a user without a Tutor wallet", async () => {
    findTutor.mockResolvedValue({ tutorId: null });
    await expect(settleTutorEarnings(USER_ID, NOW)).resolves.toBe(0);
    expect(findCandidates).not.toHaveBeenCalled();
  });
});
