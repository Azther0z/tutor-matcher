import { getAuthToken } from "@/src/lib/auth";

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
  const token = getAuthToken();
  const response = await fetch(`/api/payout-accounts${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  const body = (await response.json().catch(() => ({}))) as { message?: string } & T;
  if (!response.ok) throw new Error(body.message || "Could not update your payout accounts.");
  return body;
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
