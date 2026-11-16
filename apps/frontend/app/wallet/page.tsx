"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { RequireAuth } from "@/src/components/require-auth";
import {
  getWalletOverview,
  getWalletTransactions,
  publishWalletBalance,
  type WalletOverview,
  type WalletTransactionPage,
  type WalletTransactionType,
} from "@/src/lib/wallet-api";
import {
  isTransactionType,
  money,
  signedAmount,
  transactionFilters,
  transactionTypeLabels,
  walletDateTime,
} from "@/src/lib/wallet-transactions";

const primaryButton =
  "inline-flex h-11 items-center justify-center rounded-lg bg-brand-navy px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-navy-dark";
const secondaryButton =
  "inline-flex h-11 items-center justify-center rounded-lg border border-line px-5 text-sm font-semibold transition-colors hover:border-brand-navy hover:text-brand-link";

function SummaryCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
    </div>
  );
}

function WalletContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [overview, setOverview] = useState<WalletOverview | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  // Students never earn or pay out, so their wallet drops the Tutor-only filters.
  const filters =
    overview?.isTutor === false
      ? transactionFilters.filter((filter) => !filter.tutorOnly)
      : transactionFilters;
  const typeParam = searchParams.get("type");
  const type: WalletTransactionType | null =
    isTransactionType(typeParam) && filters.some((filter) => filter.type === typeParam)
      ? typeParam
      : null;
  const pageParam = Number(searchParams.get("page"));
  const page = Number.isInteger(pageParam) && pageParam > 1 ? pageParam : 1;
  const [listAttempt, setListAttempt] = useState(0);
  // Each result remembers the request it answers, so loading is derived, not set in effects.
  const requestKey = `${type ?? "ALL"}:${page}:${listAttempt}`;
  const [listResult, setListResult] = useState<{
    key: string;
    data?: WalletTransactionPage;
    error?: string;
  } | null>(null);
  const listLoading = listResult?.key !== requestKey;
  const list = listResult?.data ?? null;
  const listError = listLoading ? null : (listResult?.error ?? null);

  const fetchOverview = useCallback(
    () =>
      getWalletOverview()
        .then((loaded) => {
          setOverview(loaded);
          // Keep the navbar on the same balance this page shows.
          publishWalletBalance(loaded.balance);
        })
        .catch(() => setOverviewError("Could not load your wallet balance.")),
    []
  );

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  function retryOverview() {
    setOverviewError(null);
    fetchOverview();
  }

  useEffect(() => {
    let current = true;
    getWalletTransactions(type, page)
      .then((data) => current && setListResult({ key: requestKey, data }))
      .catch(
        () =>
          current && setListResult({ key: requestKey, error: "Could not load your transactions." })
      );
    return () => {
      current = false;
    };
  }, [type, page, requestKey]);

  function show(nextType: WalletTransactionType | null, nextPage = 1) {
    const query = new URLSearchParams();
    if (nextType) query.set("type", nextType);
    if (nextPage > 1) query.set("page", String(nextPage));
    const search = query.toString();
    router.replace(search ? `/wallet?${search}` : "/wallet");
  }

  const pages = list ? Math.max(1, Math.ceil(list.total / list.pageSize)) : 1;
  const activeFilter = filters.find((filter) => filter.type === type)!;

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto w-full max-w-4xl flex-1 px-6 py-12 lg:py-16"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-brand-link">Wallet</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">Your wallet</h1>
          <p className="mt-3 text-muted">
            {overview?.isTutor === false
              ? "One balance for top-ups, lesson payments and refunds."
              : "One balance for top-ups, lesson payments, earnings, refunds and payouts."}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {overview?.isTutor && (
            <Link href="/wallet/payout" className={secondaryButton}>
              Request payout
            </Link>
          )}
          <Link href="/settings/wallet" className={secondaryButton}>
            Wallet settings
          </Link>
          <Link href="/wallet/topup" className={primaryButton}>
            Top up
          </Link>
        </div>
      </div>

      {overviewError ? (
        <div
          role="alert"
          className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-red-50 p-4 text-sm text-red-700"
        >
          {overviewError}
          <button type="button" onClick={retryOverview} className="font-semibold underline">
            Try again
          </button>
        </div>
      ) : (
        <section
          aria-label="Wallet summary"
          className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <SummaryCard
            label="Available balance"
            value={overview ? money(overview.balance) : "Loading…"}
          />
          {overview?.pendingEarnings != null && (
            <SummaryCard
              label="Pending earnings"
              value={money(overview.pendingEarnings)}
              note="After the 15% platform fee. Stays pending after lesson completion."
            />
          )}
          {overview?.earningsThisMonth != null && (
            <SummaryCard
              label="Earnings this month"
              value={money(overview.earningsThisMonth)}
              note="Lesson earnings added to your balance this month."
            />
          )}
          {overview?.totalPaidOut != null && (
            <SummaryCard
              label="Total paid out"
              value={money(overview.totalPaidOut)}
              note="All payouts sent from your wallet to your bank account."
            />
          )}
        </section>
      )}

      <section className="mt-10" aria-labelledby="transactions-heading">
        <h2 id="transactions-heading" className="text-2xl font-semibold">
          Transactions
        </h2>
        <div role="group" aria-label="Filter transactions" className="mt-4 flex flex-wrap gap-2">
          {filters.map((filter) => {
            const active = filter.type === type;
            return (
              <button
                key={filter.label}
                type="button"
                aria-pressed={active}
                onClick={() => show(filter.type)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-brand-navy text-white"
                    : "border border-line text-secondary hover:border-brand-navy"
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
          {listError ? (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 p-6">
              <p className="text-sm text-red-700">{listError}</p>
              <button
                type="button"
                onClick={() => setListAttempt((attempt) => attempt + 1)}
                className="text-sm font-semibold underline"
              >
                Try again
              </button>
            </div>
          ) : listLoading && !list ? (
            <p className="p-6 text-muted">Loading transactions…</p>
          ) : list && list.transactions.length === 0 ? (
            <div className="p-8 text-center">
              <p className="font-semibold">
                {type ? `No ${activeFilter.label.toLowerCase()} yet` : "No transactions yet"}
              </p>
              <p className="mt-1 text-sm text-muted">
                Money moves appear here once they are completed.
              </p>
            </div>
          ) : (
            <ul aria-busy={listLoading} className="divide-y divide-line ">
              {list?.transactions.map((transaction) => (
                <li key={transaction.id}>
                  <Link
                    href={`/wallet/transactions/${transaction.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 transition-colors hover:bg-surface-muted"
                  >
                    <div>
                      <p className="font-semibold">{transactionTypeLabels[transaction.type]}</p>
                      <p className="text-sm text-muted">
                        {walletDateTime.format(new Date(transaction.createdAt))}
                        {transaction.booking && ` · ${transaction.booking.subjectName}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`font-semibold ${
                          transaction.direction === "IN"
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-foreground"
                        }`}
                      >
                        {signedAmount(transaction)}
                      </p>
                      <p className="text-xs text-muted">
                        Balance {money(transaction.balanceAfter)}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {list && pages > 1 && (
          <nav aria-label="Transaction pages" className="mt-4 flex items-center justify-between">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => show(type, page - 1)}
              className={`${secondaryButton} disabled:opacity-40`}
            >
              Previous
            </button>
            <span className="text-sm text-muted">
              Page {page} of {pages}
            </span>
            <button
              type="button"
              disabled={page >= pages}
              onClick={() => show(type, page + 1)}
              className={`${secondaryButton} disabled:opacity-40`}
            >
              Next
            </button>
          </nav>
        )}
      </section>
    </main>
  );
}

// The filter and page live in the URL, so the page renders on the client inside Suspense.
export default function WalletPage() {
  return (
    <RequireAuth>
      <Suspense
        fallback={
          <main
            id="main-content"
            tabIndex={-1}
            className="mx-auto w-full max-w-4xl flex-1 px-6 py-12 text-muted"
          >
            Loading wallet…
          </main>
        }
      >
        <WalletContent />
      </Suspense>
    </RequireAuth>
  );
}
