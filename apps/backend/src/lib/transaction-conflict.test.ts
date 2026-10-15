import { describe, expect, it } from "@jest/globals";
import { Prisma } from "../generated/prisma/client.ts";
import { isTransactionConflict } from "./transaction-conflict.ts";

describe("PostgreSQL transaction conflicts", () => {
  it("recognizes Prisma's normalized conflict", () => {
    expect(
      isTransactionConflict(
        new Prisma.PrismaClientKnownRequestError("conflict", {
          code: "P2034",
          clientVersion: "7.10.0",
        })
      )
    ).toBe(true);
  });
  it.each(["40001", "40P01"])("recognizes adapter COMMIT conflict %s", (originalCode) => {
    const error = new Error("TransactionWriteConflict", {
      cause: { kind: "TransactionWriteConflict", originalCode },
    });
    error.name = "DriverAdapterError";
    expect(isTransactionConflict(error)).toBe(true);
  });
  it("does not mask unrelated adapter or application errors", () => {
    const error = new Error("database unavailable", {
      cause: { kind: "ConnectionClosed", originalCode: "08006" },
    });
    error.name = "DriverAdapterError";
    expect(isTransactionConflict(error)).toBe(false);
    expect(isTransactionConflict(new Error("failure"))).toBe(false);
    expect(isTransactionConflict(null)).toBe(false);
  });
});
