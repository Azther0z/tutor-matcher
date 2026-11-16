import { apiRequest } from "@/src/lib/api-client";

export type PayoutBank = { code: string; name: string };
// The API only returns the masked number; the full number never reaches the browser.
export type PayoutAccount = {
  id: string;
  bankCode: string;
  bankName: string;
  accountHolderName: string;
  maskedAccountNumber: string;
  isDefault: boolean;
  createdAt: string;
};
export type NewPayoutAccount = {
  bankCode: string;
  accountHolderName: string;
  accountNumber: string;
  makeDefault?: boolean;
};

export const MAX_PAYOUT_ACCOUNTS = 5;

async function payoutAccountsRequest<T>(path: string, init?: RequestInit): Promise<T> {
  return apiRequest<T>(`/api/payout-accounts${path}`, {
    ...init,
    auth: "optional",
    emptyBody: () => ({}) as T,
    errorMessage: "Could not update your payout accounts.",
    makeError: ({ body }) => {
      const message = (body as { message?: string } | null)?.message;
      return new Error(message || "Could not update your payout accounts.");
    },
  });
}

export async function getPayoutAccounts() {
  return (await payoutAccountsRequest<{ accounts: PayoutAccount[] }>("")).accounts;
}

export async function getPayoutBanks() {
  return (await payoutAccountsRequest<{ banks: PayoutBank[] }>("/banks")).banks;
}

export async function addPayoutAccount(input: NewPayoutAccount) {
  return (
    await payoutAccountsRequest<{ accounts: PayoutAccount[] }>("", {
      method: "POST",
      body: JSON.stringify(input),
    })
  ).accounts;
}

export async function setDefaultPayoutAccount(id: string) {
  return (
    await payoutAccountsRequest<{ accounts: PayoutAccount[] }>(`/${id}/default`, {
      method: "PATCH",
    })
  ).accounts;
}

export async function removePayoutAccount(id: string) {
  return (
    await payoutAccountsRequest<{ accounts: PayoutAccount[] }>(`/${id}`, { method: "DELETE" })
  ).accounts;
}
