"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/src/components/require-auth";
import { confirmTopup, getWallet, type ConfirmedTopup } from "@/src/lib/wallet-api";

const presets = [300, 500, 1000, 2000];
const amountFormat = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function money(value: number) {
  return `฿${amountFormat.format(value)}`;
}

function safeAmount(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0.01 && parsed <= 100_000 ? parsed : 500;
}

function safeReturnTo(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/bookings";
}

function PromptPayQr({ value }: { value: string }) {
  const cells = useMemo(() => {
    const seed = Array.from(value).reduce(
      (hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0,
      0
    );
    return Array.from({ length: 21 * 21 }, (_, index) => {
      const row = Math.floor(index / 21);
      const column = index % 21;
      const finder =
        ((row < 7 && column < 7) || (row < 7 && column > 13) || (row > 13 && column < 7)) &&
        (row % 6 === 0 || column % 6 === 0 || (row > 1 && row < 5 && column > 1 && column < 5));
      const cellHash = (Math.imul(seed ^ index, 1664525) + 1013904223) >>> 0;
      return finder || (cellHash & 3) === 0;
    });
  }, [value]);

  return (
    <svg
      role="img"
      aria-label="PromptPay QR code"
      viewBox="0 0 21 21"
      className="h-52 w-52 rounded-2xl bg-white p-3 shadow-sm"
      shapeRendering="crispEdges"
    >
      {cells.map(
        (filled, index) =>
          filled && (
            <rect
              key={index}
              x={index % 21}
              y={Math.floor(index / 21)}
              width="1"
              height="1"
              fill="#312e81"
            />
          )
      )}
    </svg>
  );
}

function TopupContent() {
  const searchParams = useSearchParams();
  const [balance, setBalance] = useState<string | null>(null);
  const [amount, setAmount] = useState(() => safeAmount(searchParams.get("amount")));
  const [stage, setStage] = useState<"amount" | "qr" | "done">("amount");
  const [reference, setReference] = useState("");
  const [result, setResult] = useState<ConfirmedTopup | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const returnTo = safeReturnTo(searchParams.get("returnTo"));

  useEffect(() => {
    getWallet()
      .then((wallet) => setBalance(wallet.balance))
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : "Could not load your wallet.")
      )
      .finally(() => setLoading(false));
  }, []);

  function showQr() {
    if (
      !Number.isFinite(amount) ||
      amount < 0.01 ||
      amount > 100_000 ||
      Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001
    ) {
      setError("Enter an amount between ฿0.01 and ฿100,000 with at most two decimals.");
      return;
    }
    setError(null);
    setReference(crypto.randomUUID());
    setStage("qr");
  }

  async function completeTransfer(simulation: "confirmed" | "failed" = "confirmed") {
    setConfirming(true);
    setError(null);
    try {
      const confirmed = await confirmTopup(amount, reference, simulation);
      setResult(confirmed);
      setBalance(confirmed.balance);
      setStage("done");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "The transfer was not confirmed. Your balance was not changed."
      );
    } finally {
      setConfirming(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12 lg:py-16">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-600">PromptPay</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">Top up your wallet</h1>
      <p className="mt-3 text-zinc-500">
        Add Thai baht to the same balance you use to confirm lessons.
      </p>

      <section className="mt-8 overflow-hidden rounded-3xl border border-black/10 bg-white shadow-sm dark:border-white/15 dark:bg-zinc-950">
        <div className="flex items-center justify-between border-b border-black/10 px-6 py-5 dark:border-white/15">
          <span className="text-sm text-zinc-500">Current balance</span>
          <strong className="text-xl">{loading ? "Loading…" : money(Number(balance))}</strong>
        </div>

        {error && (
          <p role="alert" className="mx-6 mt-6 rounded-2xl bg-red-50 p-4 text-sm text-red-700">
            {error}
          </p>
        )}

        {stage === "amount" && (
          <div className="p-6 sm:p-8">
            <h2 className="text-xl font-semibold">Choose an amount</h2>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {presets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  aria-pressed={amount === preset}
                  onClick={() => setAmount(preset)}
                  className={`rounded-2xl border px-4 py-3 font-semibold transition ${
                    amount === preset
                      ? "border-violet-600 bg-violet-600 text-white"
                      : "border-black/15 hover:border-violet-500 dark:border-white/20"
                  }`}
                >
                  ฿{preset.toLocaleString("en-US")}
                </button>
              ))}
            </div>
            <label className="mt-6 block text-sm font-medium" htmlFor="topup-amount">
              Or enter an amount (฿)
            </label>
            <input
              id="topup-amount"
              type="number"
              min="0.01"
              max="100000"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(Number(event.target.value))}
              className="mt-2 h-12 w-full rounded-2xl border border-black/15 bg-transparent px-4 text-lg outline-none focus:border-violet-600 dark:border-white/20"
            />
            <button
              type="button"
              disabled={loading || balance === null}
              onClick={showQr}
              className="mt-6 h-12 w-full rounded-full bg-violet-600 font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Show PromptPay QR
            </button>
          </div>
        )}

        {stage === "qr" && (
          <div className="flex flex-col items-center p-6 text-center sm:p-8">
            <PromptPayQr value={`promptpay:${reference}:${amount.toFixed(2)}`} />
            <h2 className="mt-5 text-2xl font-bold">Add {money(amount)}</h2>
            <p className="mt-2 text-zinc-500">
              Simulate a successful or failed PromptPay transfer below.
            </p>
            <p className="mt-1 text-xs text-zinc-400">Merchant: TutorMatcher Wallet</p>
            <button
              type="button"
              disabled={confirming}
              onClick={() => void completeTransfer()}
              className="mt-6 h-12 w-full rounded-full bg-violet-600 font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
            >
              {confirming ? "Confirming transfer…" : "Simulate successful transfer"}
            </button>
            <button
              type="button"
              disabled={confirming}
              onClick={() => void completeTransfer("failed")}
              className="mt-3 h-11 font-semibold text-red-700 disabled:opacity-50"
            >
              Simulate failed transfer
            </button>
            <button
              type="button"
              disabled={confirming}
              onClick={() => {
                setError(null);
                setStage("amount");
              }}
              className="mt-3 h-11 font-semibold text-violet-700 hover:underline dark:text-violet-300"
            >
              Change amount
            </button>
          </div>
        )}

        {stage === "done" && result && (
          <div className="p-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-700">
              ✓
            </div>
            <h2 className="mt-5 text-2xl font-bold">Wallet topped up</h2>
            <p className="mt-2 text-zinc-500">
              Added {money(Number(result.transaction.amount))} · new balance{" "}
              {money(Number(result.balance))}
            </p>
            <p className="mt-2 text-xs text-zinc-400">Reference {result.transaction.id}</p>
            <Link
              href={returnTo}
              className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-full bg-violet-600 font-semibold text-white transition hover:bg-violet-500"
            >
              {returnTo.startsWith("/bookings/") ? "Return to booking" : "Back to bookings"}
            </Link>
            <button
              type="button"
              onClick={() => {
                setResult(null);
                setReference("");
                setStage("amount");
              }}
              className="mt-4 font-semibold text-violet-700 hover:underline dark:text-violet-300"
            >
              Top up again
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

export default function WalletTopupPage() {
  return (
    <RequireAuth>
      <TopupContent />
    </RequireAuth>
  );
}
