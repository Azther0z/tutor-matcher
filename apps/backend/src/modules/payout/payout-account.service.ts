import { Prisma, type PayoutAccount } from "../../generated/prisma/client.ts";
import { prisma } from "../../lib/db.ts";
import { isTransactionConflict } from "../../lib/transaction-conflict.ts";
import type { CreatePayoutAccountInput } from "./payout-account.schema.ts";
import { maskAccountNumber, payoutBankName } from "./payout-banks.ts";

// The full account number never leaves the backend.
export function payoutAccountResponse(account: PayoutAccount) {
  return {
    id: account.id,
    bankCode: account.bankCode,
    bankName: payoutBankName(account.bankCode),
    accountHolderName: account.accountHolderName,
    maskedAccountNumber: maskAccountNumber(account.accountNumber),
    isDefault: account.isDefault,
    createdAt: account.createdAt.toISOString(),
  };
}

export async function listPayoutAccounts(userId: string) {
  const accounts = await prisma.payoutAccount.findMany({
    where: { userId, removedAt: null },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
  return { accounts: accounts.map(payoutAccountResponse) };
}

export const MAX_PAYOUT_ACCOUNTS = 5;

export class PayoutAccountDomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400
  ) {
    super(message);
  }
}

function notFound() {
  return new PayoutAccountDomainError("PAYOUT_ACCOUNT_NOT_FOUND", "Payout account not found", 404);
}

// The one-default index can reject a concurrent change, so retry like confirmTopup.
async function inSerializableTransaction(work: (tx: Prisma.TransactionClient) => Promise<void>) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (attempt < 2 && (isTransactionConflict(error) || code === "P2002")) continue;
      throw error;
    }
  }
  throw new PayoutAccountDomainError("PAYOUT_ACCOUNT_RETRY", "Please try again in a moment", 409);
}

export async function createPayoutAccount(userId: string, input: CreatePayoutAccountInput) {
  await inSerializableTransaction(async (tx) => {
    const accounts = await tx.payoutAccount.findMany({
      where: { userId, removedAt: null },
      select: { isDefault: true },
    });
    if (accounts.length >= MAX_PAYOUT_ACCOUNTS) {
      throw new PayoutAccountDomainError(
        "PAYOUT_ACCOUNT_LIMIT",
        `You can save up to ${MAX_PAYOUT_ACCOUNTS} payout accounts. Remove one before adding another.`,
        409
      );
    }
    // The first account, or any account added while none is default, becomes the default.
    const isDefault = input.makeDefault === true || !accounts.some((account) => account.isDefault);
    if (isDefault) {
      await tx.payoutAccount.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }
    await tx.payoutAccount.create({
      data: {
        userId,
        bankCode: input.bankCode,
        accountHolderName: input.accountHolderName,
        accountNumber: input.accountNumber,
        isDefault,
      },
    });
  });
  return listPayoutAccounts(userId);
}

export async function setDefaultPayoutAccount(userId: string, id: string) {
  await inSerializableTransaction(async (tx) => {
    const account = await tx.payoutAccount.findFirst({ where: { id, userId, removedAt: null } });
    if (!account) throw notFound();
    if (account.isDefault) return;
    await tx.payoutAccount.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });
    await tx.payoutAccount.update({ where: { id }, data: { isDefault: true } });
  });
  return listPayoutAccounts(userId);
}

// Removal is soft because payouts keep referencing the account they were sent to.
export async function removePayoutAccount(userId: string, id: string) {
  await inSerializableTransaction(async (tx) => {
    const account = await tx.payoutAccount.findFirst({ where: { id, userId, removedAt: null } });
    if (!account) throw notFound();
    await tx.payoutAccount.update({
      where: { id },
      data: { removedAt: new Date(), isDefault: false },
    });
    if (!account.isDefault) return;
    const oldest = await tx.payoutAccount.findFirst({
      where: { userId, removedAt: null },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    if (oldest)
      await tx.payoutAccount.update({ where: { id: oldest.id }, data: { isDefault: true } });
  });
  return listPayoutAccounts(userId);
}
