import { apiRequest } from "@/src/lib/api-client";
import type { PayoutAccount } from "@/src/lib/payout-accounts-api";
import { publishWalletBalance } from "@/src/lib/wallet-api";

export type CompletedPayout = {
  balance: string;
  simulated: true;
  transaction: {
    id: string;
    type: "PAYOUT";
    amount: string;
    balanceAfter: string;
    createdAt: string;
    payoutAccount: PayoutAccount;
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
  return apiRequest<T>(url, {
    ...init,
    auth: "optional",
    emptyBody: () => ({}) as T,
    errorMessage: "Could not complete the payout.",
    makeError: ({ body, response }) => {
      const data = body as { code?: string; message?: string } | null;
      return new PayoutApiError(
        data?.message || "Could not complete the payout.",
        response.status,
        data?.code
      );
    },
  });
}

// Payouts are tutor-only. The tutor application reports APPROVED once the user is a Tutor.
// A failed request throws, so an error is never mistaken for "not a Tutor".
export async function isTutor() {
  const { status } = await payoutRequest<{ status?: string }>("/api/profiles/me/tutor");
  return status === "APPROVED";
}

export async function requestPayout(amount: number, payoutAccountId: string, reference: string) {
  const payout = await payoutRequest<CompletedPayout>("/api/payouts", {
    method: "POST",
    body: JSON.stringify({ amount, payoutAccountId, reference }),
  });

  publishWalletBalance(payout.balance);
  return payout;
}
