import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Prisma } from "../../generated/prisma/client.ts";
import request from "supertest";

type Fn = jest.Mock<(...args: unknown[]) => Promise<unknown>>;
const mock = (): Fn => jest.fn<(...args: unknown[]) => Promise<unknown>>();
const findUser = mock();
const topupRequest = { create: mock(), findMany: mock() };
const tx = {
  user: { findUnique: mock(), updateMany: mock(), findUniqueOrThrow: mock() },
  topupRequest: { findUnique: mock(), updateMany: mock(), findUniqueOrThrow: mock() },
  walletTransaction: { create: mock() },
};
const transaction =
  jest.fn<(callback: (client: typeof tx) => Promise<unknown>) => Promise<unknown>>();
jest.unstable_mockModule("../../lib/db.ts", () => ({
  prisma: {
    // SAFE-1: requireAuth checks for a suspension or ban on every request.
    accountAction: { findFirst: async () => null },
    user: { findUnique: findUser },
    topupRequest,
    $transaction: transaction,
  },
}));
const { app } = await import("../../app.ts");
const { topupRateLimiter } = await import("./wallet.routes.ts");
const { signAuthToken } = await import("../../lib/jwt.ts");
const { env } = await import("../../lib/env.ts");

const userId = "11111111-1111-4111-8111-111111111111";
const adminId = "44444444-4444-4444-8444-444444444444";
const requestId = "22222222-2222-4222-8222-222222222222";
const slipUrl = "https://example.com/slips/500.jpg";
const topup = (overrides: object = {}) => ({
  id: requestId,
  amount: new Prisma.Decimal(500),
  slipUrl,
  status: "PENDING",
  createdAt: new Date("2026-11-03T04:00:00Z"),
  reviewedAt: null,
  rejectionReason: null,
  userId,
  reviewedById: null,
  ...overrides,
});
const as = (test: request.Test, sub = userId) =>
  test.set(
    "Authorization",
    `Bearer ${signAuthToken({ sub, email: `${sub}@example.com`, isAdmin: sub === adminId })}`
  );
const submit = (body: object = {}, sub = userId) =>
  as(request(app).post("/api/wallet/topups"), sub).send({ amount: 500, slipUrl, ...body });
const review = (body: object, sub = adminId) =>
  as(request(app).post(`/api/admin/topups/${requestId}/review`), sub).send(body);

beforeEach(() => {
  topupRateLimiter.resetKey(userId);
  topupRateLimiter.resetKey(adminId);
  jest.clearAllMocks();
  for (const fn of [
    ...Object.values(topupRequest),
    ...Object.values(tx.user),
    ...Object.values(tx.topupRequest),
    tx.walletTransaction.create,
  ])
    fn.mockReset();
  findUser.mockReset().mockImplementation(async (args) => {
    const id = (args as { where: { id: string } }).where.id;
    return { balance: new Prisma.Decimal(250), isAdmin: id === adminId };
  });
  tx.user.findUnique.mockImplementation(findUser);
  topupRequest.create.mockResolvedValue(topup());
  topupRequest.findMany.mockResolvedValue([]);
  tx.topupRequest.findUnique.mockResolvedValue(topup());
  tx.topupRequest.updateMany.mockResolvedValue({ count: 1 });
  tx.topupRequest.findUniqueOrThrow.mockResolvedValue(topup({ status: "APPROVED" }));
  tx.user.updateMany.mockResolvedValue({ count: 1 });
  tx.user.findUniqueOrThrow.mockResolvedValue({ balance: new Prisma.Decimal(750) });
  tx.walletTransaction.create.mockResolvedValue({});
  transaction.mockReset().mockImplementation((callback) => callback(tx));
});

describe("PAY-1 slip top-up requests", () => {
  it("requires authentication", async () => {
    await request(app).post("/api/wallet/topups").send({ amount: 500, slipUrl }).expect(401);
    await request(app).get("/api/wallet/topups").expect(401);
    await request(app).get("/api/admin/topups").expect(401);
    expect(topupRequest.create).not.toHaveBeenCalled();
  });

  it("saves a pending request without crediting the wallet", async () => {
    const response = await submit().expect(201);
    expect(topupRequest.create).toHaveBeenCalledWith({
      data: { userId, amount: new Prisma.Decimal(500), slipUrl },
    });
    expect(response.body).toEqual({
      id: requestId,
      amount: "500.00",
      slipUrl,
      status: "PENDING",
      createdAt: "2026-11-03T04:00:00.000Z",
      reviewedAt: null,
      rejectionReason: null,
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  it.each([
    [{ amount: 0 }],
    [{ amount: 100001 }],
    [{ amount: 1.001 }],
    [{ slipUrl: "not a url" }],
    [{ slipUrl: "javascript:alert(1)" }],
    [{ slipUrl: undefined }],
  ])("rejects invalid input %j without saving", async (body) => {
    await submit(body).expect(400);
    expect(topupRequest.create).not.toHaveBeenCalled();
  });

  it("allows only one pending request per user", async () => {
    topupRequest.create.mockRejectedValue(Object.assign(new Error("unique"), { code: "P2002" }));
    const response = await submit().expect(409);
    expect(response.body.code).toBe("TOPUP_PENDING_EXISTS");
  });

  it("limits each account to ten attempts without blocking reads", async () => {
    for (let index = 0; index < 10; index++) await submit().expect(201);
    const blocked = await submit().expect(429);
    expect(blocked.body.code).toBe("TOPUP_RATE_LIMITED");
    await as(request(app).get("/api/wallet")).expect(200);
    await as(request(app).get("/api/wallet/topups")).expect(200);
  });

  it("lists the user's own recent requests, newest first", async () => {
    topupRequest.findMany.mockResolvedValue([topup({ status: "REJECTED", rejectionReason: "x" })]);
    const response = await as(request(app).get("/api/wallet/topups")).expect(200);
    expect(topupRequest.findMany).toHaveBeenCalledWith({
      where: { userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 10,
    });
    expect(response.body.requests[0]).toMatchObject({ status: "REJECTED", rejectionReason: "x" });
  });

  it("tells the page which PromptPay ID to pay, or the placeholder when none is set", async () => {
    const list = () => as(request(app).get("/api/wallet/topups")).expect(200);
    env.promptPayId = "0812345678";
    expect((await list()).body.promptPayId).toBe("0812345678");
    env.promptPayId = "";
    expect((await list()).body.promptPayId).toBe("0000000000");
  });
});

describe("PAY-1 admin slip review", () => {
  it("is for admins only", async () => {
    await as(request(app).get("/api/admin/topups")).expect(403);
    const response = await review({ decision: "APPROVED" }, userId).expect(403);
    expect(response.body.code).toBe("ADMIN_REQUIRED");
    expect(tx.topupRequest.updateMany).not.toHaveBeenCalled();
  });

  it("lists every request by default, or one status, with the requester", async () => {
    topupRequest.findMany.mockResolvedValue([
      { ...topup(), user: { id: userId, firstName: "Sam", lastName: "Lee", email: "s@x.com" } },
    ]);
    const response = await as(request(app).get("/api/admin/topups"), adminId).expect(200);
    expect(topupRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      })
    );
    expect(response.body.requests[0]).toMatchObject({
      amount: "500.00",
      slipUrl,
      user: { firstName: "Sam", email: "s@x.com" },
    });
    await as(request(app).get("/api/admin/topups?status=PENDING"), adminId).expect(200);
    expect(topupRequest.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { status: "PENDING" }, orderBy: [{ createdAt: "asc" }] })
    );
    await as(request(app).get("/api/admin/topups?status=APPROVED"), adminId).expect(200);
    expect(topupRequest.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { status: "APPROVED" }, orderBy: [{ createdAt: "desc" }] })
    );
    await as(request(app).get("/api/admin/topups?status=DONE"), adminId).expect(400);
  });

  it("approves by appending one TOP_UP with the request id in the same transaction", async () => {
    const response = await review({ decision: "APPROVED" }).expect(200);
    expect(response.body.status).toBe("APPROVED");
    expect(tx.topupRequest.updateMany).toHaveBeenCalledWith({
      where: { id: requestId, status: "PENDING" },
      data: {
        status: "APPROVED",
        reviewedAt: expect.any(Date),
        reviewedById: adminId,
        rejectionReason: null,
      },
    });
    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: userId },
      data: { balance: { increment: new Prisma.Decimal(500) } },
    });
    expect(tx.walletTransaction.create).toHaveBeenCalledWith({
      data: {
        id: requestId,
        userId,
        type: "TOP_UP",
        amount: new Prisma.Decimal(500),
        balanceAfter: new Prisma.Decimal(750),
      },
    });
  });

  it("rejects with a required reason and credits nothing", async () => {
    await review({ decision: "REJECTED" }).expect(400);
    await review({ decision: "REJECTED", rejectionReason: "   " }).expect(400);
    expect(transaction).not.toHaveBeenCalled();

    tx.topupRequest.findUniqueOrThrow.mockResolvedValue(
      topup({ status: "REJECTED", rejectionReason: "Slip amount is ฿50" })
    );
    const response = await review({
      decision: "REJECTED",
      rejectionReason: " Slip amount is ฿50 ",
    }).expect(200);
    expect(response.body).toMatchObject({
      status: "REJECTED",
      rejectionReason: "Slip amount is ฿50",
    });
    expect(tx.topupRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ rejectionReason: "Slip amount is ฿50" }),
      })
    );
    expect(tx.walletTransaction.create).not.toHaveBeenCalled();
    expect(tx.user.updateMany).not.toHaveBeenCalled();
  });

  it("does not let an admin review their own top-up", async () => {
    tx.topupRequest.findUnique.mockResolvedValue(topup({ userId: adminId }));
    const response = await review({ decision: "APPROVED" }).expect(403);
    expect(response.body.code).toBe("TOPUP_SELF_REVIEW");
    expect(tx.topupRequest.updateMany).not.toHaveBeenCalled();
  });

  it("refuses a request that is already reviewed", async () => {
    tx.topupRequest.updateMany.mockResolvedValue({ count: 0 });
    const response = await review({ decision: "APPROVED" }).expect(409);
    expect(response.body.code).toBe("TOPUP_NOT_PENDING");
    expect(tx.walletTransaction.create).not.toHaveBeenCalled();

    tx.topupRequest.findUnique.mockResolvedValue(null);
    expect((await review({ decision: "APPROVED" }).expect(404)).body.code).toBe("TOPUP_NOT_FOUND");
  });
});
