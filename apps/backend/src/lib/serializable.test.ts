import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Prisma } from "../generated/prisma/client.ts";

const transaction = jest.fn<(work: unknown, options: unknown) => Promise<unknown>>();
jest.unstable_mockModule("./db.ts", () => ({ prisma: { $transaction: transaction } }));
const { runSerializable } = await import("./serializable.ts");

const conflict = () =>
  new Prisma.PrismaClientKnownRequestError("write conflict", {
    code: "P2034",
    clientVersion: "test",
  });
const uniqueViolation = () => Object.assign(new Error("unique"), { code: "P2002" });
const retryError = () => new Error("Please try again in a moment");
const work = async () => "done";

beforeEach(() => {
  transaction.mockReset();
});

describe("runSerializable", () => {
  it("returns the result and runs the work as a serializable transaction", async () => {
    transaction.mockResolvedValueOnce("done");
    await expect(runSerializable(work, { retryError })).resolves.toBe("done");
    expect(transaction).toHaveBeenCalledWith(work, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });

  it("retries a conflict and succeeds on a later attempt", async () => {
    transaction.mockRejectedValueOnce(conflict()).mockResolvedValueOnce("done");
    await expect(runSerializable(work, { retryError })).resolves.toBe("done");
    expect(transaction).toHaveBeenCalledTimes(2);
  });

  // Review on PR #224: the third conflict used to escape as a raw Prisma error (HTTP 500).
  it("throws the caller's retry error, not the Prisma error, when every attempt conflicts", async () => {
    transaction.mockRejectedValue(conflict());
    await expect(runSerializable(work, { retryError })).rejects.toThrow(
      "Please try again in a moment"
    );
    expect(transaction).toHaveBeenCalledTimes(3);
  });

  it("retries a unique violation only when asked", async () => {
    transaction.mockRejectedValueOnce(uniqueViolation());
    await expect(runSerializable(work, { retryError })).rejects.toThrow("unique");

    transaction.mockReset();
    transaction.mockRejectedValueOnce(uniqueViolation()).mockResolvedValueOnce("done");
    await expect(runSerializable(work, { retryError, retryOnUniqueViolation: true })).resolves.toBe(
      "done"
    );
  });

  it("rethrows any other error at once", async () => {
    transaction.mockRejectedValueOnce(new Error("domain rule"));
    await expect(runSerializable(work, { retryError })).rejects.toThrow("domain rule");
    expect(transaction).toHaveBeenCalledTimes(1);
  });
});
