import { describe, expect, it, jest } from "@jest/globals";
import { Prisma } from "../../generated/prisma/client.ts";
import { appendWalletMovement, InsufficientWalletBalance } from "./wallet-ledger.ts";

function fixture(count = 1) {
  const updateMany = jest
    .fn<(...args: unknown[]) => Promise<unknown>>()
    .mockResolvedValue({ count });
  const create = jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue({});
  const tx = {
    user: {
      updateMany,
      findUniqueOrThrow: jest
        .fn<(...args: unknown[]) => Promise<unknown>>()
        .mockResolvedValue({ balance: new Prisma.Decimal(250) }),
    },
    walletTransaction: { create },
  };
  return { tx: tx as unknown as Prisma.TransactionClient, updateMany, create };
}
describe("shared wallet writer", () => {
  it("debits conditionally and stores the resulting balance", async () => {
    const { tx, updateMany, create } = fixture();
    await appendWalletMovement(tx, {
      userId: "student",
      type: "LESSON_PAYMENT",
      amount: 500,
      bookingId: "booking",
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "student", balance: { gte: new Prisma.Decimal(500) } },
      data: { balance: { decrement: new Prisma.Decimal(500) } },
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        userId: "student",
        type: "LESSON_PAYMENT",
        amount: new Prisma.Decimal(500),
        bookingId: "booking",
        balanceAfter: new Prisma.Decimal(250),
      },
    });
  });
  it("rejects insufficient funds without appending a row", async () => {
    const { tx, create } = fixture(0);
    await expect(
      appendWalletMovement(tx, { userId: "student", type: "LESSON_PAYMENT", amount: 500 })
    ).rejects.toBeInstanceOf(InsufficientWalletBalance);
    expect(create).not.toHaveBeenCalled();
  });
  it("writes nothing for a zero refund", async () => {
    const { tx, updateMany, create } = fixture();
    expect(
      await appendWalletMovement(tx, { userId: "student", type: "REFUND", amount: 0 })
    ).toBeNull();
    expect(updateMany).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
  it.each([-1, 1.001, Infinity, NaN])(
    "rejects invalid amount %s before writing",
    async (amount) => {
      const { tx, updateMany } = fixture();
      await expect(
        appendWalletMovement(tx, { userId: "student", type: "TOP_UP", amount })
      ).rejects.toThrow();
      expect(updateMany).not.toHaveBeenCalled();
    }
  );
});
