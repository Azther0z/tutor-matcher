"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { RequireAuth } from "@/src/components/require-auth";
import { getWalletTransaction, WalletApiError, type WalletTransaction } from "@/src/lib/wallet-api";
import {
  money,
  signedAmount,
  transactionTypeLabels,
  walletDateTime,
} from "@/src/lib/wallet-transactions";

const bookingStatusLabels: Record<NonNullable<WalletTransaction["booking"]>["status"], string> = {
  PENDING_PAYMENT: "Payment due",
  CONFIRMED: "Confirmed",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-3 px-6 py-4">
      <dt className="text-sm text-zinc-500">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}

function TransactionContent() {
  const { id } = useParams<{ id: string }>();
  const [transaction, setTransaction] = useState<WalletTransaction | null>(null);
  const [error, setError] = useState<{ notFound: boolean; message: string } | null>(null);

  const fetchTransaction = useCallback(
    () =>
      getWalletTransaction(id)
        .then(setTransaction)
        .catch((reason) =>
          setError(
            reason instanceof WalletApiError && (reason.status === 404 || reason.status === 400)
              ? { notFound: true, message: "This transaction was not found in your wallet." }
              : { notFound: false, message: "Could not load this transaction." }
          )
        ),
    [id]
  );

  useEffect(() => {
    fetchTransaction();
  }, [fetchTransaction]);

  function retry() {
    setError(null);
    fetchTransaction();
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12 lg:py-16">
      <Link href="/wallet" className="text-sm font-medium text-violet-600 hover:text-violet-500">
        ← Back to wallet
      </Link>
      <h1 className="mt-4 text-4xl font-bold tracking-tight">Transaction</h1>
      <p className="mt-3 text-zinc-500">A read-only record of a completed wallet movement.</p>

      {error ? (
        <div
          role="alert"
          className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-red-50 p-4 text-sm text-red-700"
        >
          {error.message}
          {!error.notFound && (
            <button type="button" onClick={retry} className="font-semibold underline">
              Try again
            </button>
          )}
        </div>
      ) : !transaction ? (
        <p className="mt-8 text-zinc-500">Loading transaction…</p>
      ) : (
        <>
          <section className="mt-8 overflow-hidden rounded-3xl border border-black/10 bg-white shadow-sm dark:border-white/15 dark:bg-zinc-950">
            <div className="border-b border-black/10 px-6 py-6 dark:border-white/15">
              <p className="text-sm text-zinc-500">{transactionTypeLabels[transaction.type]}</p>
              <p
                className={`mt-1 text-3xl font-semibold ${
                  transaction.direction === "IN" ? "text-emerald-700 dark:text-emerald-400" : ""
                }`}
              >
                {signedAmount(transaction)}
              </p>
            </div>
            <dl className="divide-y divide-black/10 dark:divide-white/10">
              <Row label="Type">{transactionTypeLabels[transaction.type]}</Row>
              <Row label="Amount">{money(transaction.amount)}</Row>
              <Row label="Direction">
                {transaction.direction === "IN" ? "In (added to balance)" : "Out (from balance)"}
              </Row>
              <Row label="Status">Completed</Row>
              <Row label="Date">{walletDateTime.format(new Date(transaction.createdAt))}</Row>
              <Row label="Balance after">{money(transaction.balanceAfter)}</Row>
              <Row label="Reference">
                <span className="break-all font-mono text-sm">{transaction.id}</span>
              </Row>
              {transaction.payoutAccount && (
                <Row label="Payout account">
                  {transaction.payoutAccount.bankName}{" "}
                  {transaction.payoutAccount.maskedAccountNumber}
                </Row>
              )}
              <Row label="Related booking">
                {transaction.booking ? (
                  <Link
                    href={`/bookings/${transaction.booking.id}`}
                    className="text-violet-600 hover:text-violet-500"
                  >
                    {transaction.booking.subjectName} ·{" "}
                    {walletDateTime.format(new Date(transaction.booking.startedAt))} (
                    {bookingStatusLabels[transaction.booking.status]})
                  </Link>
                ) : (
                  "None"
                )}
              </Row>
            </dl>
          </section>

          {transaction.type === "LESSON_PAYMENT" && transaction.booking && (
            <p className="mt-6 rounded-2xl bg-zinc-100 p-4 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
              Lesson payments are made only on the booking page. To pay for a booking, open{" "}
              <Link
                href={`/bookings/${transaction.booking.id}`}
                className="font-semibold text-violet-600 hover:text-violet-500"
              >
                the booking
              </Link>
              ; the wallet never takes payment.
            </p>
          )}
        </>
      )}
    </main>
  );
}

export default function WalletTransactionPage() {
  return (
    <RequireAuth>
      <TransactionContent />
    </RequireAuth>
  );
}
