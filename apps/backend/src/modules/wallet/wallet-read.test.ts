import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Prisma } from "../../generated/prisma/client.ts";
import request from "supertest";

const findUser = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const aggregate = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const findBookings = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const findEntries = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const countEntries = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const findEntry = jest.fn<(...args: unknown[]) => Promise<unknown>>();
jest.unstable_mockModule("../../lib/db.ts", () => ({
  prisma: {
    user: { findUnique: findUser },
    booking: { findMany: findBookings },
    walletTransaction: {
      aggregate,
      findMany: findEntries,
      count: countEntries,
      findFirst: findEntry,
    },
  },
}));
const { app } = await import("../../app.ts");
const { signAuthToken } = await import("../../lib/jwt.ts");
const { bangkokMonthWindow, getWalletOverview, tutorShare } = await import("./wallet.service.ts");

const userId = "11111111-1111-4111-8111-111111111111";
const tutorId = "55555555-5555-4555-8555-555555555555";
const bookingId = "66666666-6666-4666-8666-666666666666";
const entryId = "22222222-2222-4222-8222-222222222222";

function get(path: string) {
  return request(app)
    .get(`/api/wallet${path}`)
    .set(
      "Authorization",
      `Bearer ${signAuthToken({ sub: userId, email: "test@example.com", isAdmin: false })}`
    );
}

function entry(type: string, overrides: object = {}) {
  return {
    id: entryId,
    type,
    amount: new Prisma.Decimal(500),
    balanceAfter: new Prisma.Decimal(750),
    userId,
    bookingId: null,
    payoutAccountId: null,
    createdAt: new Date("2026-10-11T04:00:00Z"),
    booking: null,
    payoutAccount: null,
    ...overrides,
  };
}

const booking = {
  id: bookingId,
  status: "CONFIRMED",
  startedAt: new Date("2026-11-02T03:00:00Z"),
  endedAt: new Date("2026-11-02T04:00:00Z"),
  subjectName: null,
  subject: { name: "Physics" },
};

beforeEach(() => {
  jest.clearAllMocks();
  findUser.mockReset().mockResolvedValue({ balance: new Prisma.Decimal(750), tutorId: null });
  aggregate.mockReset().mockResolvedValue({ _sum: { amount: null } });
  findBookings.mockReset().mockResolvedValue([]);
  findEntries.mockReset().mockResolvedValue([]);
  countEntries.mockReset().mockResolvedValue(0);
  findEntry.mockReset().mockResolvedValue(null);
});

describe("wallet overview", () => {
  it("rejects anonymous requests", async () => {
    await request(app).get("/api/wallet/overview").expect(401);
    expect(findUser).not.toHaveBeenCalled();
  });

  it("returns one balance and no pending earnings for a user who is not a Tutor", async () => {
    aggregate
      .mockResolvedValueOnce({ _sum: { amount: null } })
      .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal(0) } });
    const response = await get("/overview").expect(200);
    expect(response.body).toEqual({
      balance: "750.00",
      isTutor: false,
      pendingEarnings: null,
      earningsThisMonth: "0.00",
      totalPaidOut: "0.00",
      paymentDue: [],
    });
    // Only the user's unpaid bookings are read; no Tutor booking query runs.
    expect(findBookings).toHaveBeenCalledTimes(1);
    expect(findBookings.mock.calls[0]![0]).toMatchObject({
      where: { userId, status: "PENDING_PAYMENT" },
    });
  });

  it("computes Tutor pending earnings per CONFIRMED booking after the 15% fee", async () => {
    findUser.mockResolvedValue({ balance: new Prisma.Decimal(1200), tutorId });
    aggregate
      .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal(425) } })
      .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal(300) } });
    findBookings
      .mockResolvedValueOnce([
        { totalAmount: new Prisma.Decimal(500) },
        { totalAmount: new Prisma.Decimal("333.33") },
      ])
      .mockResolvedValueOnce([
        {
          id: bookingId,
          totalAmount: new Prisma.Decimal(250),
          startedAt: new Date("2026-11-02T03:00:00Z"),
          paymentExpiresAt: new Date("2026-10-30T04:15:00Z"),
          subjectName: "Algebra",
          subject: { name: "Old name" },
        },
      ]);
    const response = await get("/overview").expect(200);
    // 500 - 75.00 = 425.00 and 333.33 - 50.00 = 283.33.
    expect(response.body).toMatchObject({
      balance: "1200.00",
      isTutor: true,
      pendingEarnings: "708.33",
      earningsThisMonth: "425.00",
      totalPaidOut: "300.00",
      paymentDue: [
        {
          bookingId,
          subjectName: "Algebra",
          amount: "250.00",
          startedAt: "2026-11-02T03:00:00.000Z",
          paymentExpiresAt: "2026-10-30T04:15:00.000Z",
        },
      ],
    });
    expect(findBookings.mock.calls[0]![0]).toMatchObject({
      where: { status: "CONFIRMED", subject: { tutorId } },
    });
  });

  it("sums earnings only inside the Bangkok month and every payout", async () => {
    const now = new Date("2026-10-31T18:00:00Z"); // 1 November, 01:00 in Bangkok.
    await getWalletOverview(userId, now);
    expect(aggregate.mock.calls[0]![0]).toEqual({
      where: {
        userId,
        type: "LESSON_EARNING",
        createdAt: {
          gte: new Date("2026-10-31T17:00:00Z"),
          lt: new Date("2026-11-30T17:00:00Z"),
        },
      },
      _sum: { amount: true },
    });
    expect(aggregate.mock.calls[1]![0]).toEqual({
      where: { userId, type: "PAYOUT" },
      _sum: { amount: true },
    });
    expect(findBookings.mock.calls[0]![0]).toMatchObject({
      where: { OR: [{ paymentExpiresAt: null }, { paymentExpiresAt: { gt: now } }] },
    });
  });

  it("returns 404 when the wallet owner no longer exists", async () => {
    findUser.mockResolvedValue(null);
    const response = await get("/overview").expect(404);
    expect(response.body.code).toBe("WALLET_NOT_FOUND");
  });
});

describe("wallet helpers", () => {
  it("uses the Bangkok calendar month", () => {
    expect(bangkokMonthWindow(new Date("2026-12-31T17:30:00Z"))).toEqual({
      start: new Date("2026-12-31T17:00:00Z"),
      end: new Date("2027-01-31T17:00:00Z"),
    });
  });

  it("rounds the fee to cents before taking the Tutor share", () => {
    expect(tutorShare(new Prisma.Decimal("0.05")).toFixed(2)).toBe("0.04");
    expect(tutorShare(new Prisma.Decimal("500")).toFixed(2)).toBe("425.00");
  });
});

describe("wallet transaction list", () => {
  it("lists every type newest first with derived direction and status", async () => {
    findEntries.mockResolvedValue([
      entry("PAYOUT", {
        payoutAccountId: "44444444-4444-4444-8444-444444444444",
        payoutAccount: {
          id: "44444444-4444-4444-8444-444444444444",
          bankCode: "KBANK",
          accountHolderName: "Alice Johnson",
          accountNumber: "1234567890",
          isDefault: true,
          createdAt: new Date("2026-10-20T04:00:00Z"),
          removedAt: null,
          userId,
        },
      }),
      entry("REFUND", { bookingId, booking: { ...booking, status: "CANCELLED" } }),
      entry("LESSON_EARNING", { bookingId, booking }),
      entry("LESSON_PAYMENT", { bookingId, booking }),
      entry("TOP_UP"),
    ]);
    countEntries.mockResolvedValue(5);
    const response = await get("/transactions").expect(200);
    expect(response.body).toMatchObject({ page: 1, pageSize: 20, total: 5 });
    expect(
      response.body.transactions.map((item: { type: string; direction: string }) => [
        item.type,
        item.direction,
      ])
    ).toEqual([
      ["PAYOUT", "OUT"],
      ["REFUND", "IN"],
      ["LESSON_EARNING", "IN"],
      ["LESSON_PAYMENT", "OUT"],
      ["TOP_UP", "IN"],
    ]);
    expect(response.body.transactions[0]).toMatchObject({
      status: "COMPLETED",
      payoutAccount: { bankName: "Kasikornbank", maskedAccountNumber: "•••• 7890" },
    });
    expect(response.body.transactions[0].payoutAccount).not.toHaveProperty("accountNumber");
    expect(response.body.transactions[3].booking).toEqual({
      id: bookingId,
      status: "CONFIRMED",
      subjectName: "Physics",
      startedAt: "2026-11-02T03:00:00.000Z",
      endedAt: "2026-11-02T04:00:00.000Z",
    });
    expect(findEntries.mock.calls[0]![0]).toMatchObject({
      where: { userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: 0,
      take: 20,
    });
  });

  it("filters by type and pages within the user's own rows", async () => {
    await get("/transactions?type=REFUND&page=3").expect(200);
    expect(findEntries.mock.calls[0]![0]).toMatchObject({
      where: { userId, type: "REFUND" },
      skip: 40,
      take: 20,
    });
    expect(countEntries).toHaveBeenCalledWith({ where: { userId, type: "REFUND" } });
  });

  it.each(["?type=EARNING", "?page=0", "?page=abc"])("rejects %s before reading", async (query) => {
    await get(`/transactions${query}`).expect(400);
    expect(findEntries).not.toHaveBeenCalled();
  });
});

describe("wallet transaction detail", () => {
  it("returns the owner's transaction read-only", async () => {
    findEntry.mockResolvedValue(entry("LESSON_PAYMENT", { bookingId, booking }));
    const response = await get(`/transactions/${entryId}`).expect(200);
    expect(response.body).toMatchObject({
      id: entryId,
      type: "LESSON_PAYMENT",
      direction: "OUT",
      status: "COMPLETED",
      amount: "500.00",
      balanceAfter: "750.00",
      createdAt: "2026-10-11T04:00:00.000Z",
      booking: { id: bookingId, subjectName: "Physics" },
      payoutAccount: null,
    });
    expect(findEntry.mock.calls[0]![0]).toMatchObject({ where: { id: entryId, userId } });
  });

  it("returns 404 for another user's or a missing transaction", async () => {
    const response = await get(`/transactions/${entryId}`).expect(404);
    expect(response.body.code).toBe("TRANSACTION_NOT_FOUND");
  });

  it("rejects a malformed id before reading", async () => {
    await get("/transactions/not-a-uuid").expect(400);
    expect(findEntry).not.toHaveBeenCalled();
  });
});
