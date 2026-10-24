import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Prisma } from "../../generated/prisma/client.ts";
import request from "supertest";

const findEntry = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const findAccount = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const findUser = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const updateUser = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const createEntry = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const tx = {
  walletTransaction: { findUnique: findEntry, create: createEntry },
  payoutAccount: { findFirst: findAccount },
  user: { updateMany: updateUser, findUniqueOrThrow: findUser },
};
const transaction =
  jest.fn<(callback: (client: typeof tx) => Promise<unknown>) => Promise<unknown>>();
jest.unstable_mockModule("../../lib/db.ts", () => ({
  prisma: { $transaction: transaction },
}));
const { app } = await import("../../app.ts");
const { payoutRateLimiter } = await import("./payout.routes.ts");
const { signAuthToken } = await import("../../lib/jwt.ts");
const userId = "11111111-1111-4111-8111-111111111111";
const otherUserId = "33333333-3333-4333-8333-333333333333";
const reference = "22222222-2222-4222-8222-222222222222";
const payoutAccountId = "44444444-4444-4444-8444-444444444444";
const account = {
  id: payoutAccountId,
  bankCode: "KBANK",
  accountHolderName: "Alice Johnson",
  accountNumber: "1234567890",
  isDefault: true,
  createdAt: new Date("2026-10-20T04:00:00Z"),
  removedAt: null,
  userId,
};
const entry = {
  id: reference,
  type: "PAYOUT",
  amount: new Prisma.Decimal(300),
  balanceAfter: new Prisma.Decimal(200),
  userId,
  bookingId: null,
  payoutAccountId,
  createdAt: new Date("2026-10-24T04:00:00Z"),
};
function post(body: object = {}, user = userId) {
  return request(app)
    .post("/api/payouts")
    .set(
      "Authorization",
      `Bearer ${signAuthToken({ sub: user, email: "test@example.com", isAdmin: false })}`
    )
    .send({ amount: 300, payoutAccountId, reference, ...body });
}
beforeEach(() => {
  payoutRateLimiter.resetKey(userId);
  payoutRateLimiter.resetKey(otherUserId);
  jest.clearAllMocks();
  findEntry.mockReset().mockResolvedValue(null);
  findAccount.mockReset().mockResolvedValue(account);
  findUser.mockReset().mockResolvedValue({ balance: new Prisma.Decimal(200) });
  updateUser.mockReset().mockResolvedValue({ count: 1 });
  createEntry.mockReset().mockResolvedValue(entry);
  transaction.mockReset().mockImplementation((callback) => callback(tx));
});

describe("simulated payout request", () => {
  it("requires authentication", async () => {
    await request(app)
      .post("/api/payouts")
      .send({ amount: 300, payoutAccountId, reference })
      .expect(401);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("appends one PAYOUT to the account in the same transaction as the debit", async () => {
    const result = await post().expect(201);
    expect(result.body).toEqual({
      balance: "200.00",
      simulated: true,
      transaction: {
        id: reference,
        type: "PAYOUT",
        amount: "300.00",
        balanceAfter: "200.00",
        createdAt: "2026-10-24T04:00:00.000Z",
        payoutAccount: {
          id: payoutAccountId,
          bankCode: "KBANK",
          bankName: "Kasikornbank",
          accountHolderName: "Alice Johnson",
          maskedAccountNumber: "•••• 7890",
          isDefault: true,
          createdAt: "2026-10-20T04:00:00.000Z",
        },
      },
    });
    expect(JSON.stringify(result.body)).not.toContain("1234567890");
    expect(findAccount).toHaveBeenCalledWith({
      where: { id: payoutAccountId, userId, removedAt: null },
    });
    expect(updateUser).toHaveBeenCalledWith({
      where: { id: userId, balance: { gte: new Prisma.Decimal(300) } },
      data: { balance: { decrement: new Prisma.Decimal(300) } },
    });
    expect(createEntry).toHaveBeenCalledWith({
      data: {
        id: reference,
        userId,
        type: "PAYOUT",
        amount: new Prisma.Decimal(300),
        balanceAfter: new Prisma.Decimal(200),
        payoutAccountId,
      },
    });
  });

  it("blocks an amount above the available balance without writing a row", async () => {
    updateUser.mockResolvedValue({ count: 0 });
    const result = await post({ amount: 300.01 }).expect(409);
    expect(result.body.code).toBe("INSUFFICIENT_BALANCE");
    expect(createEntry).not.toHaveBeenCalled();
  });

  it("rejects an account the user does not own or has removed", async () => {
    findAccount.mockResolvedValue(null);
    const result = await post().expect(404);
    expect(result.body.code).toBe("PAYOUT_ACCOUNT_NOT_FOUND");
    expect(updateUser).not.toHaveBeenCalled();
    expect(createEntry).not.toHaveBeenCalled();
  });

  it("returns the original payout on retry without debiting again", async () => {
    findEntry.mockResolvedValue({ ...entry, payoutAccount: account });
    findUser.mockResolvedValue({ balance: new Prisma.Decimal(150) });
    const result = await post().expect(201);
    expect(result.body.balance).toBe("150.00");
    expect(result.body.transaction.balanceAfter).toBe("200.00");
    expect(updateUser).not.toHaveBeenCalled();
    expect(createEntry).not.toHaveBeenCalled();
  });

  it.each([
    ["another user", { userId: otherUserId }, {}],
    ["another amount", {}, { amount: 301 }],
    ["another account", {}, { payoutAccountId: "55555555-5555-4555-8555-555555555555" }],
    ["a top-up", { type: "TOP_UP", payoutAccountId: null, payoutAccount: null }, {}],
  ])("rejects a reference already used by %s", async (_, previous, body) => {
    findEntry.mockResolvedValue({ ...entry, payoutAccount: account, ...previous });
    const result = await post(body).expect(409);
    expect(result.body.code).toBe("PAYOUT_REFERENCE_CONFLICT");
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("is disabled in production", async () => {
    const environment = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const response = await post().expect(503);
      expect(response.body.code).toBe("MOCK_PAYMENT_DISABLED");
      expect(transaction).not.toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = environment;
    }
  });

  it.each([0, -1, 100001, 1.001])("rejects invalid amount %s", async (amount) => {
    await post({ amount }).expect(400);
    expect(transaction).not.toHaveBeenCalled();
  });

  it.each([{ payoutAccountId: "not-a-uuid" }, { reference: undefined }])(
    "rejects a request without a valid account or reference",
    async (body) => {
      await post(body).expect(400);
      expect(transaction).not.toHaveBeenCalled();
    }
  );

  it("retries a competing duplicate and returns its committed payout", async () => {
    transaction.mockRejectedValueOnce({ code: "P2002" });
    findEntry.mockResolvedValue({ ...entry, payoutAccount: account });
    await post().expect(201);
    expect(transaction).toHaveBeenCalledTimes(2);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("limits each account to ten attempts without blocking another account", async () => {
    for (let i = 0; i < 10; i++) {
      await post().expect(201);
    }
    transaction.mockClear();
    const blocked = await post().expect(429);
    expect(blocked.body.code).toBe("PAYOUT_RATE_LIMITED");
    expect(transaction).not.toHaveBeenCalled();
    await post({}, otherUserId).expect(201);
  });
});
