import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import request from "supertest";

type Mock = jest.Mock<(...args: unknown[]) => Promise<unknown>>;
const mock = () => jest.fn<(...args: unknown[]) => Promise<unknown>>();
const listAccounts = mock();
const tx = {
  payoutAccount: {
    findMany: mock(),
    findFirst: mock(),
    updateMany: mock(),
    update: mock(),
    create: mock(),
  },
};
const transaction =
  jest.fn<(callback: (client: typeof tx) => Promise<unknown>) => Promise<unknown>>();
jest.unstable_mockModule("../../lib/db.ts", () => ({
  prisma: { payoutAccount: { findMany: listAccounts }, $transaction: transaction },
}));
const { app } = await import("../../app.ts");
const { signAuthToken } = await import("../../lib/jwt.ts");
const { payoutAccountRateLimiter } = await import("./payout-account.routes.ts");

const userId = "77000000-0000-4000-8000-000000000001";
const accountId = "77000000-0000-4000-8000-000000000002";
const otherId = "77000000-0000-4000-8000-000000000003";
const account = (overrides: object = {}) => ({
  id: accountId,
  bankCode: "KBANK",
  accountHolderName: "Student One",
  accountNumber: "1234567890",
  isDefault: true,
  createdAt: new Date("2026-10-24T04:00:00Z"),
  removedAt: null,
  userId,
  ...overrides,
});
const authorize = (test: request.Test) =>
  test.set(
    "Authorization",
    `Bearer ${signAuthToken({ sub: userId, email: "student@example.com", isAdmin: false })}`
  );
const create = (body: object = {}) =>
  authorize(request(app).post("/api/payout-accounts")).send({
    bankCode: "KBANK",
    accountHolderName: "Student One",
    accountNumber: "123-4-56789-0",
    ...body,
  });
const calls = (fn: Mock) => fn.mock.calls.map((call) => call[0]);

beforeEach(() => {
  payoutAccountRateLimiter.resetKey(userId);
  jest.clearAllMocks();
  for (const fn of Object.values(tx.payoutAccount)) fn.mockReset().mockResolvedValue(null);
  tx.payoutAccount.findMany.mockResolvedValue([]);
  listAccounts.mockReset().mockResolvedValue([account()]);
  transaction.mockReset().mockImplementation((callback) => callback(tx));
});

describe("PROF-7 payout account settings", () => {
  it("requires authentication", async () => {
    await request(app).get("/api/payout-accounts").expect(401);
    await request(app).get("/api/payout-accounts/banks").expect(401);
    await request(app).post("/api/payout-accounts").send({}).expect(401);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("lists the Thai banks for the form", async () => {
    const response = await authorize(request(app).get("/api/payout-accounts/banks")).expect(200);
    expect(response.body.banks).toContainEqual({ code: "KBANK", name: "Kasikornbank" });
  });

  it("makes the first account the default and stores the normalized number", async () => {
    const response = await create({ accountHolderName: "  Student One  " }).expect(201);
    expect(tx.payoutAccount.create).toHaveBeenCalledWith({
      data: {
        userId,
        bankCode: "KBANK",
        accountHolderName: "Student One",
        accountNumber: "1234567890",
        isDefault: true,
      },
    });
    expect(response.body.accounts[0]).toMatchObject({
      bankName: "Kasikornbank",
      maskedAccountNumber: "•••• 7890",
      isDefault: true,
    });
    expect(JSON.stringify(response.body)).not.toContain("1234567890");
    expect(response.body.accounts[0]).not.toHaveProperty("accountNumber");
  });

  it("keeps the current default unless the new account asks to replace it", async () => {
    tx.payoutAccount.findMany.mockResolvedValue([{ isDefault: true }]);
    await create().expect(201);
    expect(tx.payoutAccount.updateMany).not.toHaveBeenCalled();
    expect(calls(tx.payoutAccount.create)[0]).toMatchObject({ data: { isDefault: false } });

    tx.payoutAccount.create.mockClear();
    await create({ makeDefault: true }).expect(201);
    expect(tx.payoutAccount.updateMany).toHaveBeenCalledWith({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });
    expect(calls(tx.payoutAccount.create)[0]).toMatchObject({ data: { isDefault: true } });
  });

  it.each([
    [{ bankCode: "CHASE" }],
    [{ accountHolderName: "   " }],
    [{ accountHolderName: "a".repeat(101) }],
    [{ accountNumber: "123456789" }],
    [{ accountNumber: "1234567890123456" }],
    [{ accountNumber: "12345abc90" }],
  ])("rejects invalid details %j without saving", async (body) => {
    await create(body).expect(400);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("allows at most five active accounts", async () => {
    tx.payoutAccount.findMany.mockResolvedValue(Array(5).fill({ isDefault: false }));
    const response = await create().expect(409);
    expect(response.body.code).toBe("PAYOUT_ACCOUNT_LIMIT");
    expect(tx.payoutAccount.create).not.toHaveBeenCalled();
  });

  it("rejects an active account with the same bank and number", async () => {
    tx.payoutAccount.findMany.mockResolvedValue([
      { isDefault: true, bankCode: "KBANK", accountNumber: "1234567890" },
    ]);
    const response = await create().expect(409);
    expect(response.body.code).toBe("PAYOUT_ACCOUNT_DUPLICATE");
    expect(tx.payoutAccount.create).not.toHaveBeenCalled();
    await create({ bankCode: "SCB" }).expect(201);
  });

  it("limits adding and removing to thirty changes per account", async () => {
    for (let index = 0; index < 30; index++) await create().expect(201);
    const blocked = await create().expect(429);
    expect(blocked.body.code).toBe("PAYOUT_ACCOUNT_RATE_LIMITED");
    await authorize(request(app).delete(`/api/payout-accounts/${accountId}`)).expect(429);
    await authorize(request(app).get("/api/payout-accounts")).expect(200);
  });

  it("retries when the one-default index rejects a concurrent change", async () => {
    transaction
      .mockRejectedValueOnce(Object.assign(new Error("unique"), { code: "P2002" }))
      .mockImplementation((callback) => callback(tx));
    await create().expect(201);
    expect(transaction).toHaveBeenCalledTimes(2);
  });

  it("switches the default by unsetting the old one first", async () => {
    tx.payoutAccount.findFirst.mockResolvedValue(account({ isDefault: false }));
    await authorize(request(app).patch(`/api/payout-accounts/${accountId}/default`)).expect(200);
    expect(calls(tx.payoutAccount.findFirst)[0]).toEqual({
      where: { id: accountId, userId, removedAt: null },
    });
    expect(tx.payoutAccount.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      tx.payoutAccount.update.mock.invocationCallOrder[0]
    );
    expect(tx.payoutAccount.update).toHaveBeenCalledWith({
      where: { id: accountId },
      data: { isDefault: true },
    });
  });

  it("returns not found for another user's or a removed account", async () => {
    for (const path of [`/${otherId}/default`, `/${otherId}`]) {
      const test = path.endsWith("default")
        ? request(app).patch(`/api/payout-accounts${path}`)
        : request(app).delete(`/api/payout-accounts${path}`);
      const response = await authorize(test).expect(404);
      expect(response.body.code).toBe("PAYOUT_ACCOUNT_NOT_FOUND");
    }
    expect(tx.payoutAccount.update).not.toHaveBeenCalled();
    await authorize(request(app).delete("/api/payout-accounts/not-a-uuid")).expect(400);
  });

  it("soft-removes the default and promotes the oldest remaining account", async () => {
    tx.payoutAccount.findFirst
      .mockResolvedValueOnce(account())
      .mockResolvedValueOnce(account({ id: otherId, isDefault: false }));
    const response = await authorize(
      request(app).delete(`/api/payout-accounts/${accountId}`)
    ).expect(200);
    expect(calls(tx.payoutAccount.update)).toEqual([
      { where: { id: accountId }, data: { removedAt: expect.any(Date), isDefault: false } },
      { where: { id: otherId }, data: { isDefault: true } },
    ]);
    expect(calls(tx.payoutAccount.findFirst)[1]).toEqual({
      where: { userId, removedAt: null },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    expect(response.body).toHaveProperty("accounts");
  });

  it("removes a non-default account without changing the default", async () => {
    tx.payoutAccount.findFirst.mockResolvedValueOnce(account({ isDefault: false }));
    await authorize(request(app).delete(`/api/payout-accounts/${accountId}`)).expect(200);
    expect(tx.payoutAccount.update).toHaveBeenCalledTimes(1);
    expect(tx.payoutAccount.findFirst).toHaveBeenCalledTimes(1);
  });
});
