import { getAuthToken } from "@/src/lib/auth";
import { publishWalletBalance } from "@/src/lib/wallet-api";

export type PayoutAccountSummary = {
  id: string;
  bankCode: string;
  bankName: string;
  accountHolderName: string;
  maskedAccountNumber: string;
  isDefault: boolean;
  createdAt: string;
};

export type CompletedPayout = {
  balance: string;
  simulated: true;
  transaction: {
    id: string;
    type: "PAYOUT";
    amount: string;
    balanceAfter: string;
    createdAt: string;
    payoutAccount: PayoutAccountSummary;
  };
};

export class PayoutApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = "PayoutApiError";
  }
}

async function payoutRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  const body = (await response.json().catch(() => ({}))) as {
    code?: string;
    message?: string;
  } & T;
  if (!response.ok) {
    throw new PayoutApiError(
      body.message || "Could not complete the payout.",
      response.status,
      body.code
    );
  }
  return body;
}

export function listPayoutAccounts() {
  return payoutRequest<{ accounts: PayoutAccountSummary[] }>("/api/payout-accounts");
}

export async function requestPayout(amount: number, payoutAccountId: string, reference: string) {
  const payout = await payoutRequest<CompletedPayout>("/api/payouts", {
    method: "POST",
    body: JSON.stringify({ amount, payoutAccountId, reference }),
  });

  publishWalletBalance(payout.balance);
  return payout;
}
