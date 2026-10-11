import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Prisma } from "../../generated/prisma/client.ts";
import request from "supertest";

const paymentFindUnique = jest.fn<(args: unknown) => Promise<unknown>>();
const userFindUnique = jest.fn<(args: unknown) => Promise<unknown>>();
const userUpdate = jest.fn<(args: unknown) => Promise<unknown>>();
const paymentCreate = jest.fn<(args: unknown) => Promise<unknown>>();
type MockTransaction = {
  user: { update: typeof userUpdate };
  payment: { create: typeof paymentCreate };
};
const runTransaction =
  jest.fn<(callback: (tx: MockTransaction) => Promise<unknown>) => Promise<unknown>>();

jest.unstable_mockModule("../../lib/db.ts", () => ({
  prisma: {
    payment: { findUnique: paymentFindUnique },
    user: { findUnique: userFindUnique },
    $transaction: runTransaction,
  },
}));

const { app } = await import("../../app.ts");
const { signAuthToken } = await import("../../lib/jwt.ts");

const userId = "11111111-1111-4111-8111-111111111111";
const reference = "22222222-2222-4222-8222-222222222222";
const completedAt = new Date("2026-10-11T04:00:00.000Z");

function token() {
  return signAuthToken({ sub: userId, email: "student@example.com", isAdmin: false });
}

describe("wallet top-up API", () => {
  beforeEach(() => {
    paymentFindUnique.mockReset();
    userFindUnique.mockReset();
    userUpdate.mockReset();
    paymentCreate.mockReset();
    runTransaction.mockReset();
    runTransaction.mockImplementation(async (callback) =>
      callback({ user: { update: userUpdate }, payment: { create: paymentCreate } })
    );
  });

  it("requires authentication", async () => {
    await request(app).get("/api/wallet").expect(401);
    await request(app)
      .post("/api/wallet/topups/confirm")
      .send({ amount: 500, reference })
      .expect(401);
    expect(userFindUnique).not.toHaveBeenCalled();
    expect(runTransaction).not.toHaveBeenCalled();
  });

  it("returns the current wallet balance", async () => {
    userFindUnique.mockResolvedValue({ balance: new Prisma.Decimal("250") });

    const response = await request(app)
      .get("/api/wallet")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);

    expect(response.body).toEqual({ balance: "250.00" });
  });

  it("credits a confirmed PromptPay top-up and records its transaction atomically", async () => {
    paymentFindUnique.mockResolvedValue(null);
    userUpdate.mockResolvedValue({ balance: new Prisma.Decimal("750") });
    paymentCreate.mockResolvedValue({
      id: reference,
      type: "TRANSFER",
      amount: new Prisma.Decimal("500"),
      status: "COMPLETED",
      createdAt: completedAt,
      completedAt,
      fromUserId: null,
      toUserId: userId,
      bookingId: null,
    });

    const response = await request(app)
      .post("/api/wallet/topups/confirm")
      .set("Authorization", `Bearer ${token()}`)
      .send({ amount: 500, reference })
      .expect(201);

    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: userId },
      data: { balance: { increment: 500 } },
      select: { balance: true },
    });
    expect(paymentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: reference,
        type: "TRANSFER",
        amount: 500,
        status: "COMPLETED",
        fromUserId: null,
        toUserId: userId,
      }),
    });
    expect(response.body).toMatchObject({
      balance: "750.00",
      transaction: {
        id: reference,
        type: "TOPUP",
        method: "PROMPTPAY",
        amount: "500.00",
        status: "COMPLETED",
      },
    });
  });

  it("does not credit the same confirmation reference twice", async () => {
    paymentFindUnique.mockResolvedValue({
      id: reference,
      type: "TRANSFER",
      amount: new Prisma.Decimal("500"),
      status: "COMPLETED",
      createdAt: completedAt,
      completedAt,
      fromUserId: null,
      toUserId: userId,
      bookingId: null,
    });
    userFindUnique.mockResolvedValue({ balance: new Prisma.Decimal("750") });

    const response = await request(app)
      .post("/api/wallet/topups/confirm")
      .set("Authorization", `Bearer ${token()}`)
      .send({ amount: 500, reference })
      .expect(201);

    expect(response.body.balance).toBe("750.00");
    expect(runTransaction).not.toHaveBeenCalled();
  });

  it("rejects invalid amounts without adding balance or recording a transaction", async () => {
    await request(app)
      .post("/api/wallet/topups/confirm")
      .set("Authorization", `Bearer ${token()}`)
      .send({ amount: 0, reference })
      .expect(400);

    expect(runTransaction).not.toHaveBeenCalled();
    expect(userUpdate).not.toHaveBeenCalled();
    expect(paymentCreate).not.toHaveBeenCalled();
  });
});
