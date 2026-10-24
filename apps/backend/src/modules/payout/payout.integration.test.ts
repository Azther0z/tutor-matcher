import { randomUUID } from "node:crypto";
import { URL } from "node:url";
import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import request from "supertest";
import { app } from "../../app.ts";
import { prisma } from "../../lib/db.ts";
import { signAuthToken } from "../../lib/jwt.ts";
import { topupRateLimiter } from "../wallet/wallet.routes.ts";
import { payoutRateLimiter } from "./payout.routes.ts";

const enabled = process.env.RUN_DATABASE_INTEGRATION === "true";
if (enabled) {
  const target = new URL(process.env.DATABASE_URL ?? "");
  if (
    !["localhost", "127.0.0.1"].includes(target.hostname) ||
    target.pathname !== "/tutor_matcher_pay7_test"
  ) {
    throw new Error(
      "PAY-7 integration tests require the dedicated local tutor_matcher_pay7_test database"
    );
  }
}

const STUDENT = "77000000-0000-4000-8000-000000000001";
const OTHER = "77000000-0000-4000-8000-000000000002";
const ACCOUNT = "77000000-0000-4000-8000-000000000003";
const SECOND_ACCOUNT = "77000000-0000-4000-8000-000000000004";
const OTHER_ACCOUNT = "77000000-0000-4000-8000-000000000005";
const userIds = [STUDENT, OTHER];
const authorize = (test: request.Test, userId = STUDENT) =>
  test.set(
    "Authorization",
    `Bearer ${signAuthToken({ sub: userId, email: `${userId}@example.com`, isAdmin: false })}`
  );

async function cleanFixtures() {
  await prisma.walletTransaction.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.payoutAccount.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

function payout(body: { amount: number; payoutAccountId?: string; reference?: string }) {
  return authorize(
    request(app)
      .post("/api/payouts")
      .send({ payoutAccountId: ACCOUNT, reference: randomUUID(), ...body })
  );
}

async function snapshot(userId = STUDENT) {
  const [user, movements] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { balance: true } }),
    prisma.walletTransaction.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
  ]);
  return { balance: user.balance.toFixed(2), movements };
}

(enabled ? describe : describe.skip)("PAY-7 payout request acceptance", () => {
  beforeEach(async () => {
    payoutRateLimiter.resetKey(STUDENT);
    payoutRateLimiter.resetKey(OTHER);
    topupRateLimiter.resetKey(STUDENT);
    await cleanFixtures();
    await prisma.user.createMany({
      data: userIds.map((id, index) => ({
        id,
        firstName: ["Student", "Other"][index],
        lastName: "PAY7",
        email: `pay7-${index}@example.com`,
        password: "unused-fixture",
        notifyOnBooking: false,
        notifyOnPayment: false,
      })),
    });
    await prisma.payoutAccount.createMany({
      data: [
        {
          id: ACCOUNT,
          userId: STUDENT,
          bankCode: "KBANK",
          accountHolderName: "Student PAY7",
          accountNumber: "1234567890",
          isDefault: true,
        },
        {
          id: SECOND_ACCOUNT,
          userId: STUDENT,
          bankCode: "SCB",
          accountHolderName: "Student PAY7",
          accountNumber: "9876543210",
        },
        {
          id: OTHER_ACCOUNT,
          userId: OTHER,
          bankCode: "BBL",
          accountHolderName: "Other PAY7",
          accountNumber: "5555666677",
          isDefault: true,
        },
      ],
    });
    // The student only ever topped up, through the real top-up endpoint.
    await authorize(
      request(app)
        .post("/api/wallet/topups/confirm")
        .send({ amount: 500, reference: randomUUID(), simulation: "confirmed" })
    ).expect(201);
  });
  afterAll(cleanFixtures);

  it("lets a student who only topped up pay out and appends exactly one PAYOUT", async () => {
    const response = await payout({ amount: 120.5 }).expect(201);
    const after = await snapshot();
    expect(response.body).toMatchObject({
      balance: "379.50",
      simulated: true,
      transaction: {
        type: "PAYOUT",
        amount: "120.50",
        balanceAfter: "379.50",
        payoutAccount: { id: ACCOUNT, bankName: "Kasikornbank", maskedAccountNumber: "•••• 7890" },
      },
    });
    expect(JSON.stringify(response.body)).not.toContain("1234567890");
    expect(after.balance).toBe("379.50");
    expect(after.movements.map((row) => row.type)).toEqual(["TOP_UP", "PAYOUT"]);
    expect(after.movements[1]).toMatchObject({
      id: response.body.transaction.id,
      bookingId: null,
      payoutAccountId: ACCOUNT,
    });
    expect(after.movements[1].amount.toFixed(2)).toBe("120.50");
    expect(after.movements[1].balanceAfter.toFixed(2)).toBe("379.50");
  });

  it("sends a payout to another saved account the user picks", async () => {
    await payout({ amount: 100, payoutAccountId: SECOND_ACCOUNT }).expect(201);
    const after = await snapshot();
    expect(after.movements[1].payoutAccountId).toBe(SECOND_ACCOUNT);
  });

  it("allows paying out the whole balance but blocks one satang more", async () => {
    const before = await snapshot();
    const blocked = await payout({ amount: 500.01 }).expect(409);
    expect(blocked.body.code).toBe("INSUFFICIENT_BALANCE");
    expect(await snapshot()).toEqual(before);
    await payout({ amount: 500 }).expect(201);
    expect((await snapshot()).balance).toBe("0.00");
  });

  it("rejects another user's account and a removed account without changes", async () => {
    await prisma.payoutAccount.update({
      where: { id: SECOND_ACCOUNT },
      data: { removedAt: new Date() },
    });
    const before = await snapshot();
    for (const payoutAccountId of [OTHER_ACCOUNT, SECOND_ACCOUNT, randomUUID()]) {
      const response = await payout({ amount: 50, payoutAccountId }).expect(404);
      expect(response.body.code).toBe("PAYOUT_ACCOUNT_NOT_FOUND");
    }
    expect(await snapshot()).toEqual(before);
  });

  it("does not debit twice for a repeated reference", async () => {
    const reference = randomUUID();
    const first = await payout({ amount: 200, reference }).expect(201);
    const repeat = await payout({ amount: 200, reference }).expect(201);
    expect(repeat.body.transaction).toEqual(first.body.transaction);
    const after = await snapshot();
    expect(after.balance).toBe("300.00");
    expect(after.movements.filter((row) => row.type === "PAYOUT")).toHaveLength(1);
    await payout({ amount: 201, reference }).expect(409);
    await payout({ amount: 200, reference, payoutAccountId: SECOND_ACCOUNT }).expect(409);
    const otherUser = await authorize(
      request(app).post("/api/payouts").send({
        amount: 200,
        payoutAccountId: OTHER_ACCOUNT,
        reference,
      }),
      OTHER
    ).expect(409);
    expect(otherUser.body.code).toBe("PAYOUT_REFERENCE_CONFLICT");
    expect(await snapshot()).toEqual(after);
  });

  it("cannot overdraw with concurrent payouts", async () => {
    const results = await Promise.all([
      payout({ amount: 300 }),
      payout({ amount: 300 }),
      payout({ amount: 300 }),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 409, 409]);
    const after = await snapshot();
    expect(after.balance).toBe("200.00");
    expect(after.movements.filter((row) => row.type === "PAYOUT")).toHaveLength(1);
  });

  it("is disabled in production and writes nothing", async () => {
    const before = await snapshot();
    const environment = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const response = await payout({ amount: 100 }).expect(503);
      expect(response.body.code).toBe("MOCK_PAYMENT_DISABLED");
    } finally {
      process.env.NODE_ENV = environment;
    }
    expect(await snapshot()).toEqual(before);
  });

  it("requires authentication", async () => {
    await request(app)
      .post("/api/payouts")
      .send({ amount: 100, payoutAccountId: ACCOUNT, reference: randomUUID() })
      .expect(401);
  });
});
