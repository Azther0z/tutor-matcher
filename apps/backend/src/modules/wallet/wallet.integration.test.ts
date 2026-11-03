import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { Prisma } from "../../generated/prisma/client.ts";
import { prisma } from "../../lib/db.ts";
import { appendWalletMovement } from "./wallet-ledger.ts";
import { cancelTopup, createTopup, reviewTopup } from "./topup.service.ts";

const databaseTests = process.env.RUN_DATABASE_INTEGRATION === "true" ? describe : describe.skip;
const userId = randomUUID();
const adminId = randomUUID();
const otherAdminId = randomUUID();
const serializable = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable };

databaseTests("PAY-1 PostgreSQL ledger atomicity", () => {
  beforeAll(async () => {
    await prisma.user.createMany({
      data: [userId, adminId, otherAdminId].map((id, index) => ({
        id,
        email: `wallet-${id}@example.com`,
        firstName: ["Wallet", "Admin", "Other Admin"][index],
        lastName: "Fixture",
        password: "fixture",
        isAdmin: index > 0,
      })),
    });
  });
  afterAll(async () => {
    // Fixture teardown only; application ledger operations never delete entries.
    await prisma.walletTransaction.deleteMany({ where: { userId } });
    await prisma.topupRequest.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, adminId, otherAdminId] } } });
  });

  it("credits a slip top-up once when two admins approve it at the same time", async () => {
    const request = await createTopup(userId, { amount: 500, slipUrl: "https://example.com/slip" });
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).balance.toFixed(2)
    ).toBe("0.00");
    const results = await Promise.allSettled(
      [adminId, otherAdminId].map((admin) =>
        reviewTopup(admin, request.id, { decision: "APPROVED" })
      )
    );
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rows = await prisma.walletTransaction.findMany({ where: { userId } });
    expect(rows).toEqual([expect.objectContaining({ id: request.id, type: "TOP_UP" })]);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).balance.toFixed(2)
    ).toBe("500.00");
  });

  it("allows one pending top-up per user and writes nothing when one is rejected", async () => {
    const request = await createTopup(userId, { amount: 100, slipUrl: "https://example.com/a" });
    await expect(
      createTopup(userId, { amount: 200, slipUrl: "https://example.com/b" })
    ).rejects.toMatchObject({ code: "TOPUP_PENDING_EXISTS" });
    await reviewTopup(adminId, request.id, { decision: "REJECTED", rejectionReason: "No slip" });
    expect(await prisma.walletTransaction.count({ where: { userId } })).toBe(1);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).balance.toFixed(2)
    ).toBe("500.00");
    const next = await createTopup(userId, { amount: 200, slipUrl: "https://example.com/b" });
    await cancelTopup(userId, next.id);
    await expect(reviewTopup(adminId, next.id, { decision: "APPROVED" })).rejects.toMatchObject({
      code: "TOPUP_NOT_PENDING",
    });
    expect(await prisma.walletTransaction.count({ where: { userId } })).toBe(1);
  });

  it("rolls back a balance increment when the ledger insert violates a foreign key", async () => {
    await expect(
      prisma.$transaction(
        (tx) =>
          appendWalletMovement(tx, {
            userId,
            type: "REFUND",
            amount: 100,
            bookingId: randomUUID(),
          }),
        serializable
      )
    ).rejects.toBeDefined();
    expect(await prisma.walletTransaction.count({ where: { userId } })).toBe(1);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).balance.toFixed(2)
    ).toBe("500.00");
  });

  it("cannot overspend when two debits race and keeps the signed ledger equal to balance", async () => {
    const debit = () =>
      prisma.$transaction(
        (tx) =>
          appendWalletMovement(tx, {
            userId,
            type: "PAYOUT",
            amount: 400,
          }),
        serializable
      );
    const results = await Promise.allSettled([debit(), debit()]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const rows = await prisma.walletTransaction.findMany({ where: { userId } });
    expect(user.balance.toFixed(2)).toBe("100.00");
    const signed = rows.reduce(
      (sum, row) => (row.type === "PAYOUT" ? sum.minus(row.amount) : sum.plus(row.amount)),
      new Prisma.Decimal(0)
    );
    expect(signed.equals(user.balance)).toBe(true);
    expect(rows.find((row) => row.type === "PAYOUT")?.balanceAfter.equals(user.balance)).toBe(true);
  });
});
