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

  publishWalletBalance(confirmed.balance);
  return confirmed;
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
  earningsThisMonth: string;
  totalPaidOut: string;
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

export class WalletApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "WalletApiError";
  }
}

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
