import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { Prisma } from "../../generated/prisma/client.ts";
import { prisma } from "../../lib/db.ts";
import { appendWalletMovement } from "./wallet-ledger.ts";
import { confirmTopup } from "./wallet.service.ts";

const databaseTests = process.env.RUN_DATABASE_INTEGRATION === "true" ? describe : describe.skip;
const userId = randomUUID();
const serializable = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable };

databaseTests("PAY-1 PostgreSQL ledger atomicity", () => {
  beforeAll(async () => {
    await prisma.user.create({
      data: {
        id: userId,
        email: `wallet-${userId}@example.com`,
        firstName: "Wallet",
        lastName: "Fixture",
        password: "fixture",
      },
    });
  });
  afterAll(async () => {
    // Fixture teardown only; application ledger operations never delete entries.
    await prisma.walletTransaction.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
  });

  it("credits one time for concurrent retries of the same confirmed reference", async () => {
    const input = { amount: 500, reference: randomUUID(), simulation: "confirmed" as const };
    const results = await Promise.all([confirmTopup(userId, input), confirmTopup(userId, input)]);
    expect(results.map((result) => result.transaction.id)).toEqual([
      input.reference,
      input.reference,
    ]);
    expect(await prisma.walletTransaction.count({ where: { userId } })).toBe(1);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).balance.toFixed(2)
    ).toBe("500.00");
  });

  it("writes nothing for an unsuccessful simulated payment", async () => {
    await expect(
      confirmTopup(userId, {
        amount: 100,
        reference: randomUUID(),
        simulation: "failed",
      })
    ).rejects.toMatchObject({ code: "TOPUP_NOT_CONFIRMED" });
    expect(await prisma.walletTransaction.count({ where: { userId } })).toBe(1);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).balance.toFixed(2)
    ).toBe("500.00");
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
