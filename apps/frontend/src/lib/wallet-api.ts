import { apiRequest as sharedRequest } from "@/src/lib/api-client";

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

// One request path for the wallet and its admin review endpoints; failures keep the status and code.
function apiRequest<T>(
  url: string,
  init?: Omit<RequestInit, "body"> & { json?: unknown },
  fallback = "Could not complete the wallet request."
) {
  return sharedRequest<T>(url, {
    ...init,
    auth: "optional",
    emptyBody: () => ({}) as T,
    errorMessage: fallback,
    makeError: ({ body, response }) => {
      const failure = body as { message?: string; code?: string } | null;
      return new WalletApiError(failure?.message || fallback, response.status, failure?.code);
    },
  });
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
    json: { amount, slipUrl },
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
    json: { decision, ...(rejectionReason ? { rejectionReason } : {}) },
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

export function getWalletOverview() {
  return apiRequest<WalletOverview>(
    "/api/wallet/overview",
    undefined,
    "Could not load your wallet."
  );
}

export function getWalletTransactions(type: WalletTransactionType | null, page: number) {
  const query = new URLSearchParams({ page: String(page) });
  if (type) query.set("type", type);
  return apiRequest<WalletTransactionPage>(
    `/api/wallet/transactions?${query}`,
    undefined,
    "Could not load your transactions."
  );
}

export function getWalletTransaction(id: string) {
  return apiRequest<WalletTransaction>(
    `/api/wallet/transactions/${encodeURIComponent(id)}`,
    undefined,
    "Could not load this transaction."
  );
}
