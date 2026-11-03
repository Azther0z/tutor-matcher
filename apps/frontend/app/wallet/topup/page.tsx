"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/src/components/require-auth";
import { TopupStatusBadge } from "@/src/components/topup-status";
import {
  cancelTopup,
  getMyTopups,
  getWallet,
  submitTopup,
  type TopupRequest,
} from "@/src/lib/wallet-api";

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

function isHttpUrl(value: string) {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

// A placeholder QR: TutorMatcher has no account to receive money yet.
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
  const [requests, setRequests] = useState<TopupRequest[]>([]);
  const [amount, setAmount] = useState(() => safeAmount(searchParams.get("amount")));
  const [stage, setStage] = useState<"amount" | "slip">("amount");
  const [slipUrl, setSlipUrl] = useState("");
  const [slipError, setSlipError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const returnTo = safeReturnTo(searchParams.get("returnTo"));
  const fromBooking = returnTo.startsWith("/bookings/");
  const pending = requests.find((request) => request.status === "PENDING");

  useEffect(() => {
    Promise.all([getWallet(), getMyTopups()])
      .then(([wallet, recent]) => {
        setBalance(wallet.balance);
        setRequests(recent);
      })
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
    setMessage(null);
    setStage("slip");
  }

  async function sendSlip(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const url = slipUrl.trim();
    if (!isHttpUrl(url)) {
      setSlipError("Paste a link that starts with http:// or https://.");
      return;
    }
    setSlipError(null);
    setError(null);
    setBusy(true);
    try {
      const request = await submitTopup(amount, url);
      setRequests((current) => [request, ...current]);
      setSlipUrl("");
      setStage("amount");
      setMessage("Slip sent. An admin will check it and add the money to your balance.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not send your slip.");
    } finally {
      setBusy(false);
    }
  }

  async function cancelPending(request: TopupRequest) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const cancelled = await cancelTopup(request.id);
      setRequests((current) =>
        current.map((item) => (item.id === cancelled.id ? cancelled : item))
      );
      setMessage("Top-up cancelled. No money was added.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not cancel this top-up.");
      // The request may have been reviewed meanwhile; show its real status.
      getMyTopups()
        .then(setRequests)
        .catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12 lg:py-16">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-600">PromptPay</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">Top up your wallet</h1>
      <p className="mt-3 text-zinc-500">
        Transfer by PromptPay, then send us the slip. An admin checks it and adds the money to the
        same balance you use to confirm lessons.
      </p>

      <section className="mt-8 overflow-hidden rounded-3xl border border-black/10 bg-white shadow-sm dark:border-white/15 dark:bg-zinc-950">
        <div className="flex items-center justify-between border-b border-black/10 px-6 py-5 dark:border-white/15">
          <span className="text-sm text-zinc-500">Current balance</span>
          <strong className="text-xl">
            {loading ? "Loading…" : balance === null ? "—" : money(Number(balance))}
          </strong>
        </div>

        {error && (
          <p role="alert" className="mx-6 mt-6 rounded-2xl bg-red-50 p-4 text-sm text-red-700">
            {error}
          </p>
        )}
        {message && (
          <p
            role="status"
            className="mx-6 mt-6 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
          >
            {message}
          </p>
        )}

        {!loading && pending && (
          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Top-up of {money(Number(pending.amount))}</h2>
              <TopupStatusBadge status="PENDING" />
            </div>
            <p className="mt-2 text-zinc-500">
              Your balance updates once an admin approves the slip. You can send another top-up
              after this one is reviewed or cancelled.
            </p>
            {fromBooking && (
              <p className="mt-2 text-sm text-amber-800 dark:text-amber-300">
                Your booking is held for a limited time. If it expires before approval, book the
                slot again once your balance is updated.
              </p>
            )}
            <p className="mt-4 text-sm">
              Sent {new Date(pending.createdAt).toLocaleString()} ·{" "}
              <a
                href={pending.slipUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-violet-700 underline dark:text-violet-300"
              >
                View slip
              </a>
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={returnTo}
                className="inline-flex h-11 items-center justify-center rounded-full bg-violet-600 px-6 font-semibold text-white transition hover:bg-violet-500"
              >
                {fromBooking ? "Return to booking" : "Back to bookings"}
              </Link>
              <button
                type="button"
                disabled={busy}
                onClick={() => void cancelPending(pending)}
                className="h-11 rounded-full border border-red-600/40 px-6 font-semibold text-red-700 disabled:opacity-50 dark:border-red-400/40 dark:text-red-400"
              >
                {busy ? "Cancelling…" : "Cancel top-up"}
              </button>
            </div>
          </div>
        )}

        {!loading && !pending && stage === "amount" && (
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
              disabled={balance === null}
              onClick={showQr}
              className="mt-6 h-12 w-full rounded-full bg-violet-600 font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Show PromptPay QR
            </button>
          </div>
        )}

        {!loading && !pending && stage === "slip" && (
          <div className="flex flex-col items-center p-6 text-center sm:p-8">
            <PromptPayQr value={`promptpay:${amount.toFixed(2)}`} />
            <h2 className="mt-5 text-2xl font-bold">Transfer {money(amount)}</h2>
            <p className="mt-2 text-xs text-zinc-500">
              Demo QR: TutorMatcher has no receiving account yet, so this QR does not collect money.
            </p>
            <form onSubmit={sendSlip} noValidate className="mt-6 flex w-full flex-col text-left">
              <label className="text-sm font-medium" htmlFor="slip-url">
                Link to your transfer slip
              </label>
              <input
                id="slip-url"
                type="url"
                inputMode="url"
                autoComplete="off"
                placeholder="https://"
                value={slipUrl}
                onChange={(event) => setSlipUrl(event.target.value)}
                aria-invalid={!!slipError}
                aria-describedby={slipError ? "slip-url-error" : "slip-url-help"}
                className="mt-2 h-12 w-full rounded-2xl border border-black/15 bg-transparent px-4 outline-none focus:border-violet-600 aria-[invalid=true]:border-red-500 dark:border-white/20"
              />
              {slipError ? (
                <span id="slip-url-error" className="mt-1 text-sm text-red-600">
                  {slipError}
                </span>
              ) : (
                <span id="slip-url-help" className="mt-1 text-sm text-zinc-500">
                  Upload the slip image (for example to Google Drive, shared with anyone who has the
                  link) and paste the link here.
                </span>
              )}
              <button
                type="submit"
                disabled={busy}
                className="mt-6 h-12 w-full rounded-full bg-violet-600 font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
              >
                {busy ? "Sending…" : "Send slip for review"}
              </button>
            </form>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setError(null);
                setSlipError(null);
                setStage("amount");
              }}
              className="mt-3 h-11 font-semibold text-violet-700 hover:underline dark:text-violet-300"
            >
              Change amount
            </button>
          </div>
        )}
      </section>

      {requests.length > 0 && (
        <section aria-label="Recent top-ups" className="mt-8">
          <h2 className="text-lg font-semibold">Recent top-ups</h2>
          <ul className="mt-3 divide-y divide-black/10 rounded-2xl border border-black/10 dark:divide-white/15 dark:border-white/15">
            {requests.map((request) => (
              <li key={request.id} className="flex flex-col gap-1 px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="font-medium">{money(Number(request.amount))}</span>
                  <TopupStatusBadge status={request.status} />
                </div>
                <span className="text-sm text-zinc-500">
                  Sent {new Date(request.createdAt).toLocaleString()}
                </span>
                {request.rejectionReason && (
                  <span className="text-sm">Reason: {request.rejectionReason}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
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
