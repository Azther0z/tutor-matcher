import { Prisma } from "../generated/prisma/client.ts";
import { prisma } from "./db.ts";
import { isTransactionConflict } from "./transaction-conflict.ts";

const ATTEMPTS = 3;

// Runs `work` in a serializable transaction and retries it when it loses a race. Each retry
// re-reads the latest state. When every attempt conflicts, `retryError` is thrown so the
// client gets the caller's "try again" response instead of a raw Prisma error.
export async function runSerializable<T>(
  work: (tx: Prisma.TransactionClient) => Promise<T>,
  options: {
    retryError: () => Error;
    // Also retry a unique-key violation (P2002) when a concurrent insert can cause one.
    retryOnUniqueViolation?: boolean;
  }
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      const uniqueViolation =
        options.retryOnUniqueViolation && (error as { code?: string }).code === "P2002";
      if (!isTransactionConflict(error) && !uniqueViolation) throw error;
      if (attempt >= ATTEMPTS) throw options.retryError();
    }
  }
}
