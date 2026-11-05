import { getAuthToken } from "@/src/lib/auth";

export type WalletSummary = { balance: string };
export type TopupStatus = "PENDING" | "APPROVED" | "REJECTED";
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
    this.name = "WalletApiError";
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

export function getMyTopups() {
  return apiRequest<{ requests: TopupRequest[]; promptPayId: string }>("/api/wallet/topups");
}

export function submitTopup(amount: number, slipUrl: string) {
  return apiRequest<TopupRequest>("/api/wallet/topups", {
    method: "POST",
    body: JSON.stringify({ amount, slipUrl }),
  });
}

// With no status, the backend returns every request, pending first.
export async function getTopupsForReview(status?: TopupStatus) {
  const query = status ? `?${new URLSearchParams({ status })}` : "";
  return (await apiRequest<{ requests: AdminTopupRequest[] }>(`/api/admin/topups${query}`))
    .requests;
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

export type WalletTransactionType =
  "TOP_UP" | "LESSON_PAYMENT" | "LESSON_EARNING" | "REFUND" | "PAYOUT";

export type PaymentDueBooking = {
  bookingId: string;
  subjectName: string;
  amount: string;
  startedAt: string;
  paymentExpiresAt: string | null;
};

export type WalletOverview = WalletSummary & {
  isTutor: boolean;
  pendingEarnings: string | null;
  earningsThisMonth: string | null;
  totalPaidOut: string | null;
  paymentDue: PaymentDueBooking[];
};

// Ledger rows are completed movements: direction follows the type and status is constant.
export type WalletTransaction = {
  id: string;
  type: WalletTransactionType;
  direction: "IN" | "OUT";
  status: "COMPLETED";
  amount: string;
  balanceAfter: string;
  createdAt: string;
  booking: {
    id: string;
    status: "PENDING_PAYMENT" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
    subjectName: string;
    startedAt: string;
    endedAt: string;
  } | null;
  payoutAccount: {
    bankName: string;
    accountHolderName: string;
    maskedAccountNumber: string;
  } | null;
};

export type WalletTransactionPage = {
  transactions: WalletTransaction[];
  page: number;
  pageSize: number;
  total: number;
};

async function walletRead<T>(path: string, fallback: string): Promise<T> {
  const token = getAuthToken();
  const response = await fetch(`/api/wallet${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const body = (await response.json().catch(() => ({}))) as { message?: string } & T;
  if (!response.ok) throw new WalletApiError(body.message || fallback, response.status);
  return body;
}

export function getWalletOverview() {
  return walletRead<WalletOverview>("/overview", "Could not load your wallet.");
}

export function getWalletTransactions(type: WalletTransactionType | null, page: number) {
  const query = new URLSearchParams({ page: String(page) });
  if (type) query.set("type", type);
  return walletRead<WalletTransactionPage>(
    `/transactions?${query}`,
    "Could not load your transactions."
  );
}

export function getWalletTransaction(id: string) {
  return walletRead<WalletTransaction>(
    `/transactions/${encodeURIComponent(id)}`,
    "Could not load this transaction."
  );
}
