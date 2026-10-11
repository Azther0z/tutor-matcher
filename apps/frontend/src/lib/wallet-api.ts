import { getAuthToken } from "@/src/lib/auth";

export type WalletSummary = { balance: string };
export type ConfirmedTopup = WalletSummary & {
  transaction: {
    id: string;
    type: "TOPUP";
    method: "PROMPTPAY";
    amount: string;
    status: string;
    createdAt: string;
    completedAt: string | null;
  };
};

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

export function confirmTopup(amount: number, reference: string) {
  return walletRequest<ConfirmedTopup>("/topups/confirm", {
    method: "POST",
    body: JSON.stringify({ amount, reference }),
  });
}
