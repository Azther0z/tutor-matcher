import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Prisma } from "../../generated/prisma/client.ts";
import request from "supertest";

const findEntry = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const findUser = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const updateUser = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const createEntry = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const tx = {
  walletTransaction: { findUnique: findEntry, create: createEntry },
  user: { updateMany: updateUser, findUniqueOrThrow: findUser },
};
const transaction =
  jest.fn<(callback: (client: typeof tx) => Promise<unknown>) => Promise<unknown>>();
jest.unstable_mockModule("../../lib/db.ts", () => ({
  prisma: {
    user: { findUnique: findUser },
    $transaction: transaction,
  },
}));
const { app } = await import("../../app.ts");
const { topupRateLimiter } = await import("./wallet.routes.ts");
const { signAuthToken } = await import("../../lib/jwt.ts");
const userId = "11111111-1111-4111-8111-111111111111";
const reference = "22222222-2222-4222-8222-222222222222";
const entry = {
  id: reference,
  type: "TOP_UP",
  amount: new Prisma.Decimal(500),
  balanceAfter: new Prisma.Decimal(750),
  userId,
  bookingId: null,
  createdAt: new Date("2026-10-11T04:00:00Z"),
};
function post(body: object = {}) {
  return request(app)
    .post("/api/wallet/topups/confirm")
    .set(
      "Authorization",
      `Bearer ${signAuthToken({ sub: userId, email: "test@example.com", isAdmin: false })}`
    )
    .send({ amount: 500, reference, simulation: "confirmed", ...body });
}
beforeEach(() => {
  topupRateLimiter.resetKey(userId);
  topupRateLimiter.resetKey("33333333-3333-4333-8333-333333333333");
  jest.clearAllMocks();
  findEntry.mockReset().mockResolvedValue(null);
  findUser.mockReset().mockResolvedValue({ balance: new Prisma.Decimal(750) });
  updateUser.mockReset().mockResolvedValue({ count: 1 });
  createEntry.mockReset().mockResolvedValue(entry);
  transaction.mockReset().mockImplementation((callback) => callback(tx));
});

describe("simulated wallet top-up", () => {
  it("limits each account to ten attempts without blocking reads or another account", async () => {
    for (let i = 0; i < 10; i++) {
      await post().expect(201);
    }
    transaction.mockClear();
    createEntry.mockClear();
    updateUser.mockClear();
    const blocked = await post().expect(429);
    expect(blocked.body.code).toBe("TOPUP_RATE_LIMITED");
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);
    expect(transaction).not.toHaveBeenCalled();
    expect(createEntry).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();

    await request(app)
      .get("/api/wallet")
      .set(
        "Authorization",
        `Bearer ${signAuthToken({ sub: userId, email: "test@example.com", isAdmin: false })}`
      )
      .expect(200);
    await request(app)
      .post("/api/wallet/topups/confirm")
      .set(
        "Authorization",
        `Bearer ${signAuthToken({ sub: "33333333-3333-4333-8333-333333333333", email: "other@example.com", isAdmin: false })}`
      )
      .send({ amount: 500, reference, simulation: "confirmed" })
      .expect(201);
  });

  it("requires authentication", async () => {
    await request(app)
      .post("/api/wallet/topups/confirm")
      .send({ amount: 500, reference, simulation: "confirmed" })
      .expect(401);
    expect(transaction).not.toHaveBeenCalled();
  });
  it("appends one TOP_UP with its balanceAfter in the same transaction as the credit", async () => {
    const result = await post().expect(201);
    expect(result.body).toMatchObject({
      balance: "750.00",
      simulated: true,
      transaction: {
        type: "TOP_UP",
        amount: "500.00",
        balanceAfter: "750.00",
        userId,
        bookingId: null,
      },
    });
    expect(result.body.transaction).not.toHaveProperty("status");
    expect(result.body.transaction).not.toHaveProperty("direction");
    expect(updateUser).toHaveBeenCalledWith({
      where: { id: userId },
      data: { balance: { increment: new Prisma.Decimal(500) } },
    });
    expect(createEntry).toHaveBeenCalledWith({
      data: {
        id: reference,
        userId,
        type: "TOP_UP",
        amount: new Prisma.Decimal(500),
        balanceAfter: new Prisma.Decimal(750),
      },
    });
  });
  it("returns the original balanceAfter on retry without adding money again", async () => {
    findEntry.mockResolvedValue(entry);
    findUser.mockResolvedValue({ balance: new Prisma.Decimal(900) });
    const result = await post().expect(201);
    expect(result.body.balance).toBe("900.00");
    expect(result.body.transaction.balanceAfter).toBe("750.00");
    expect(updateUser).not.toHaveBeenCalled();
    expect(createEntry).not.toHaveBeenCalled();
  });
  it("rejects a reference for another user or amount", async () => {
    findEntry.mockResolvedValue({ ...entry, userId: reference });
    await post().expect(409);
    findEntry.mockResolvedValue(entry);
    await post({ amount: 501 }).expect(409);
    expect(updateUser).not.toHaveBeenCalled();
  });
  it("failed simulation leaves no balance mutation or row", async () => {
    await post({ simulation: "failed" }).expect(402);
    expect(transaction).not.toHaveBeenCalled();
    expect(createEntry).not.toHaveBeenCalled();
  });
  it("does not expose simulated credits in production", async () => {
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
  it("does not accept a confirmation without an explicit simulation outcome", async () => {
    await post({ simulation: null }).expect(400);
    expect(transaction).not.toHaveBeenCalled();
  });
  it("retries a competing duplicate and returns its committed ledger row", async () => {
    transaction.mockRejectedValueOnce({ code: "P2002" });
    findEntry.mockResolvedValue(entry);
    await post().expect(201);
    expect(transaction).toHaveBeenCalledTimes(2);
    expect(updateUser).not.toHaveBeenCalled();
  });
  it("propagates ledger write failure instead of reporting success", async () => {
    createEntry.mockRejectedValueOnce(new Error("ledger unavailable"));
    await post().expect(500);
  });
});
