import { Prisma } from "../generated/prisma/client.ts";

export function isTransactionConflict(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) return error.code === "P2034";
  // Prisma 7 can expose adapter errors directly when SERIALIZABLE fails at COMMIT.
  if (!(error instanceof Error) || error.name !== "DriverAdapterError") return false;
  const cause = error.cause;
  return (
    typeof cause === "object" &&
    cause !== null &&
    "kind" in cause &&
    cause.kind === "TransactionWriteConflict" &&
    "originalCode" in cause &&
    ["40001", "40P01"].includes(String(cause.originalCode))
  );
}
