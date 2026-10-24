import type { PayoutAccount } from "../../generated/prisma/client.ts";
import { prisma } from "../../lib/db.ts";
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
