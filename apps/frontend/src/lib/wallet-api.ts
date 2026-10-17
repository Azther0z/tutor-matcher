import { getAuthToken } from "@/src/lib/auth";

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

export function subscribeToWalletBalance(callback: (balance: string) => void) {
  function handleBalanceChanged(event: Event) {
    const balance = (event as CustomEvent<{ balance?: string }>).detail?.balance;
    if (balance) callback(balance);
  }

  window.addEventListener(WALLET_BALANCE_CHANGED_EVENT, handleBalanceChanged);
  return () => window.removeEventListener(WALLET_BALANCE_CHANGED_EVENT, handleBalanceChanged);
}

async function walletRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const response = await fetch(`/api/wallet${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  const body = (await response.json().catch(() => ({}))) as { message?: string } & T;
  if (!response.ok) throw new Error(body.message || "Could not complete the wallet top-up.");
  return body;
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
    body: JSON.stringify({ amount, reference, simulation }),
  });

  window.dispatchEvent(
    new CustomEvent(WALLET_BALANCE_CHANGED_EVENT, { detail: { balance: confirmed.balance } })
  );
  return confirmed;
}
