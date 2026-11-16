"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/src/components/require-auth";
import { getPayoutAccounts, type PayoutAccount } from "@/src/lib/payout-accounts-api";
import {
  isTutor,
  PayoutApiError,
  requestPayout,
  type CompletedPayout,
} from "@/src/lib/payouts-api";
import { getWallet } from "@/src/lib/wallet-api";

const amountFormat = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function money(value: number) {
  return `฿${amountFormat.format(value)}`;
}

function accountLabel(account: PayoutAccount) {
  return `${account.bankName} ${account.maskedAccountNumber}`;
}

function PayoutContent() {
  const [balance, setBalance] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<PayoutAccount[]>([]);
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [stage, setStage] = useState<"form" | "confirm" | "done" | "unavailable" | "tutorOnly">(
    "form"
  );
  const [reference, setReference] = useState("");
  const [result, setResult] = useState<CompletedPayout | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const account = accounts.find((item) => item.id === accountId);

  useEffect(() => {
    // Payout accounts are tutor-only too, so load them only after the Tutor check.
    Promise.all([getWallet(), isTutor()])
      .then(async ([wallet, tutor]) => {
        if (!tutor) {
          setStage("tutorOnly");
          setBalance(wallet.balance);
          return;
        }
        const saved = await getPayoutAccounts();
        setBalance(wallet.balance);
        setAccounts(saved);
        setAccountId((saved.find((item) => item.isDefault) ?? saved[0])?.id ?? "");
      })
      .catch(() => setError("Could not load your wallet. Please refresh and try again."))
      .finally(() => setLoading(false));
  }, []);

  function review() {
    const value = Number(amount);
    if (
      amount === "" ||
      !Number.isFinite(value) ||
      value < 0.01 ||
      value > 100_000 ||
      Math.abs(value * 100 - Math.round(value * 100)) > 0.000001
    ) {
      setError("Enter an amount between ฿0.01 and ฿100,000 with at most two decimals.");
      return;
    }
    if (value > Number(balance)) {
      setError(`The amount is more than your available balance of ${money(Number(balance))}.`);
      return;
    }
    if (!account) {
      setError("Choose a payout account.");
      return;
    }
    setError(null);
    setReference(crypto.randomUUID());
    setStage("confirm");
  }

  async function confirm() {
    setSending(true);
    setError(null);
    try {
      const payout = await requestPayout(Number(amount), accountId, reference);
      setResult(payout);
      setBalance(payout.balance);
      setStage("done");
    } catch (reason) {
      if (reason instanceof PayoutApiError && reason.code === "MOCK_PAYMENT_DISABLED") {
        setStage("unavailable");
        return;
      }
      if (reason instanceof PayoutApiError && reason.code === "PAYOUT_TUTOR_ONLY") {
        setStage("tutorOnly");
        return;
      }
      setError(
        reason instanceof Error
          ? reason.message
          : "The payout was not completed. Your balance was not changed."
      );
      if (reason instanceof PayoutApiError && reason.code === "INSUFFICIENT_BALANCE") {
        setStage("form");
        getWallet()
          .then((wallet) => setBalance(wallet.balance))
          .catch(() => undefined);
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto w-full max-w-3xl flex-1 px-6 py-12 lg:py-16"
    >
      <p className="text-sm font-semibold text-brand-link">Payout</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">Request a payout</h1>
      <p className="mt-3 text-muted">
        Send money from your available wallet balance to a saved payout account.
      </p>
      <p className="mt-4 inline-flex rounded-full bg-amber-500/10 px-3 py-1 text-sm font-medium text-amber-800 dark:text-amber-300">
        Simulated payout, no real money is transferred.
      </p>

      <section className="mt-8 overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
        <div className="flex items-center justify-between border-b border-line px-6 py-5">
          <span className="text-sm text-muted">Available balance</span>
          <strong className="text-xl">
            {loading ? "Loading…" : balance === null ? "Unavailable" : money(Number(balance))}
          </strong>
        </div>

        {error && (
          <p role="alert" className="mx-6 mt-6 rounded-2xl bg-red-50 p-4 text-sm text-red-700">
            {error}
          </p>
        )}

        {!loading && balance !== null && stage !== "tutorOnly" && accounts.length === 0 && (
          <div className="p-8 text-center">
            <h2 className="text-xl font-semibold">No saved payout account</h2>
            <p className="mt-2 text-muted">
              Add a payout account in Wallet settings, then come back to request a payout.
            </p>
            <Link
              href="/settings/wallet"
              className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-lg bg-brand-navy font-semibold text-white transition-colors hover:bg-brand-navy-dark"
            >
              Go to Wallet settings
            </Link>
          </div>
        )}

        {stage === "form" && accounts.length > 0 && (
          <div className="p-6 sm:p-8">
            <fieldset>
              <legend className="text-xl font-semibold">Send to</legend>
              <div className="mt-5 grid gap-3">
                {accounts.map((item) => (
                  <label
                    key={item.id}
                    className={`flex cursor-pointer items-center gap-4 rounded-2xl border px-4 py-3 transition-colors ${
                      accountId === item.id
                        ? "border-brand-navy bg-brand-navy/5"
                        : "border-line hover:border-brand-navy"
                    }`}
                  >
                    <input
                      type="radio"
                      name="payout-account"
                      value={item.id}
                      checked={accountId === item.id}
                      onChange={() => setAccountId(item.id)}
                      className="accent-brand-navy"
                    />
                    <span className="min-w-0 flex-1 break-words">
                      <span className="block break-words font-semibold">{accountLabel(item)}</span>
                      <span className="block text-sm text-muted">{item.accountHolderName}</span>
                    </span>
                    {item.isDefault && (
                      <span className="rounded-full bg-brand-navy/10 px-2 py-0.5 text-xs font-semibold text-brand-link">
                        Default
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="mt-6 block text-sm font-medium" htmlFor="payout-amount">
              Amount (฿)
            </label>
            <input
              id="payout-amount"
              type="number"
              min="0.01"
              max={balance ?? undefined}
              step="0.01"
              value={amount}
              onChange={(event) =>
                setAmount(event.target.value === "" ? "" : Number(event.target.value))
              }
              className="mt-2 h-12 w-full rounded-2xl border border-line bg-transparent px-4 text-lg focus-visible:outline-2 focus-visible:outline-brand-link focus:border-brand-navy"
            />
            <button
              type="button"
              onClick={review}
              className="mt-6 h-12 w-full rounded-lg bg-brand-navy font-semibold text-white transition-colors hover:bg-brand-navy-dark"
            >
              Review payout
            </button>
          </div>
        )}

        {stage === "confirm" && account && (
          <div className="p-6 text-center sm:p-8">
            <h2 className="text-2xl font-semibold">Pay out {money(Number(amount))}?</h2>
            <p className="mt-2 text-muted">
              To {accountLabel(account)} · {account.accountHolderName}
            </p>
            <p className="mt-1 text-muted">
              Balance after payout {money(Number(balance) - Number(amount))}
            </p>
            <button
              type="button"
              disabled={sending}
              onClick={() => void confirm()}
              className="mt-6 h-12 w-full rounded-lg bg-brand-navy font-semibold text-white transition-colors hover:bg-brand-navy-dark disabled:opacity-50"
            >
              {sending ? "Sending payout…" : "Confirm payout"}
            </button>
            <button
              type="button"
              disabled={sending}
              onClick={() => {
                setError(null);
                setStage("form");
              }}
              className="mt-3 h-11 font-semibold text-brand-link hover:underline"
            >
              Change details
            </button>
          </div>
        )}

        {stage === "done" && result && (
          <div className="p-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-700">
              ✓
            </div>
            <h2 className="mt-5 text-2xl font-semibold">Payout complete</h2>
            <p className="mt-2 text-muted">
              Sent {money(Number(result.transaction.amount))} to{" "}
              {accountLabel(result.transaction.payoutAccount)} · new balance{" "}
              {money(Number(result.balance))}
            </p>
            <p className="mt-2 text-xs text-muted">Reference {result.transaction.id}</p>
            <button
              type="button"
              onClick={() => {
                setResult(null);
                setReference("");
                setAmount("");
                setStage("form");
              }}
              className="mt-6 h-12 w-full rounded-lg bg-brand-navy font-semibold text-white transition-colors hover:bg-brand-navy-dark"
            >
              Request another payout
            </button>
          </div>
        )}

        {stage === "tutorOnly" && (
          <div role="alert" className="p-8 text-center">
            <h2 className="text-xl font-semibold">Payouts are for Tutors</h2>
            <p className="mt-2 text-muted">
              Only Tutors can request a payout from their wallet balance.
            </p>
          </div>
        )}

        {stage === "unavailable" && (
          <div role="alert" className="p-8 text-center">
            <h2 className="text-xl font-semibold">Payouts are not available here yet</h2>
            <p className="mt-2 text-muted">
              Simulated payouts are turned off in production. Your balance was not changed.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

export default function WalletPayoutPage() {
  return (
    <RequireAuth>
      <PayoutContent />
    </RequireAuth>
  );
}
