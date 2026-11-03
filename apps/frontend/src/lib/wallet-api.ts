import { getAuthToken } from "@/src/lib/auth";

export type WalletSummary = { balance: string };
export type TopupStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
// PAY-1: a top-up is credited only after an admin checks its transfer slip.
export type TopupRequest = {
  id: string;
  amount: string;
  slipUrl: string;
  status: TopupStatus;
  createdAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
};
export type AdminTopupRequest = TopupRequest & {
  user: { id: string; firstName: string; lastName: string; email: string };
};

export class WalletApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string
  ) {
    super(message);
  }
}

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

async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
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
    message?: string;
    code?: string;
  } & T;
  if (!response.ok) {
    throw new WalletApiError(
      body.message || "Could not complete the wallet request.",
      response.status,
      body.code
    );
  }
  return body;
}

export function getWallet() {
  return apiRequest<WalletSummary>("/api/wallet");
}

export async function getMyTopups() {
  return (await apiRequest<{ requests: TopupRequest[] }>("/api/wallet/topups")).requests;
}

export function submitTopup(amount: number, slipUrl: string) {
  return apiRequest<TopupRequest>("/api/wallet/topups", {
    method: "POST",
    body: JSON.stringify({ amount, slipUrl }),
  });
}

export function cancelTopup(id: string) {
  return apiRequest<TopupRequest>(`/api/wallet/topups/${id}/cancel`, { method: "POST" });
}

export async function getTopupsForReview(status: TopupStatus) {
  return (
    await apiRequest<{ requests: AdminTopupRequest[] }>(
      `/api/admin/topups?${new URLSearchParams({ status }).toString()}`
    )
  ).requests;
}

export function reviewTopup(
  id: string,
  decision: "APPROVED" | "REJECTED",
  rejectionReason?: string
) {
  return apiRequest<TopupRequest>(`/api/admin/topups/${id}/review`, {
    method: "POST",
    body: JSON.stringify({ decision, ...(rejectionReason ? { rejectionReason } : {}) }),
  });
}
