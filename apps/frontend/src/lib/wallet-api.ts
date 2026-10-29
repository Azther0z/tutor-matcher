import { apiRequest } from "@/src/lib/api-client";

export type WalletSummary = { balance: string };
export type ConfirmedTopup = WalletSummary & {
  transaction: {
    id: string;
    type: "TOP_UP";
    amount: string;
    balanceAfter: string;
    userId: string;
    bookingId: string | null;
    createdAt: string;
  };
};

const WALLET_BALANCE_CHANGED_EVENT = "tutor-matcher-wallet-balance-changed";

export function publishWalletBalance(balance: string) {
  window.dispatchEvent(new CustomEvent(WALLET_BALANCE_CHANGED_EVENT, { detail: { balance } }));
}

export function subscribeToWalletBalance(callback: (balance: string) => void) {
  function handleBalanceChanged(event: Event) {
    const balance = (event as CustomEvent<{ balance?: string }>).detail?.balance;
    if (balance) callback(balance);
  }

  window.addEventListener(WALLET_BALANCE_CHANGED_EVENT, handleBalanceChanged);
  return () => window.removeEventListener(WALLET_BALANCE_CHANGED_EVENT, handleBalanceChanged);
}

async function walletRequest<T>(path: string, init?: RequestInit): Promise<T> {
  return apiRequest<T>(`/api/wallet${path}`, {
    ...init,
    auth: "optional",
    emptyBody: () => ({}) as T,
    errorMessage: "Could not complete the wallet top-up.",
    makeError: ({ body }) => {
      const message = (body as { message?: string } | null)?.message;
      return new Error(message || "Could not complete the wallet top-up.");
    },
  });
}

export function getWallet() {
  return walletRequest<WalletSummary>("");
}

export async function confirmTopup(
  amount: number,
  reference: string,
  simulation: "confirmed" | "failed" = "confirmed"
) {
  const confirmed = await walletRequest<ConfirmedTopup>("/topups/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount, reference, simulation }),
  });

  publishWalletBalance(confirmed.balance);
  return confirmed;
}
