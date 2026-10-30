import type { WalletTransaction, WalletTransactionType } from "@/src/lib/wallet-api";

export const WALLET_TIME_ZONE = "Asia/Bangkok";

export const transactionTypeLabels: Record<WalletTransactionType, string> = {
  TOP_UP: "Top-up",
  LESSON_PAYMENT: "Lesson payment",
  LESSON_EARNING: "Lesson earning",
  REFUND: "Refund",
  PAYOUT: "Payout",
};

// Filter order follows docs/user-journeys.md §4.
export const transactionFilters: { type: WalletTransactionType | null; label: string }[] = [
  { type: null, label: "All" },
  { type: "TOP_UP", label: "Top-ups" },
  { type: "LESSON_PAYMENT", label: "Lesson payments" },
  { type: "LESSON_EARNING", label: "Lesson earnings" },
  { type: "PAYOUT", label: "Payouts" },
  { type: "REFUND", label: "Refunds" },
];

export function isTransactionType(value: string | null): value is WalletTransactionType {
  return value !== null && value in transactionTypeLabels;
}

const amountFormat = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function money(value: string | number) {
  return `฿${amountFormat.format(Number(value))}`;
}

export function signedAmount(transaction: Pick<WalletTransaction, "amount" | "direction">) {
  return `${transaction.direction === "IN" ? "+" : "−"}${money(transaction.amount)}`;
}

export const walletDateTime = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: WALLET_TIME_ZONE,
});
