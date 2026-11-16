"use client";

import { useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/src/components/require-auth";
import { StatusBadge } from "@/src/components/status-badge";
import { formatBangkokDateTime } from "@/src/lib/date-time";
import { isPromptPayId, promptPayPayload } from "@/src/lib/promptpay";
import { getMyTopups, getWallet, submitTopup, type TopupRequest } from "@/src/lib/wallet-api";

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

function isHttpUrl(value: string) {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

function TopupContent() {
  const searchParams = useSearchParams();
  const [balance, setBalance] = useState<string | null>(null);
  const [requests, setRequests] = useState<TopupRequest[]>([]);
  const [promptPayId, setPromptPayId] = useState<string | null>(null);
  const [amount, setAmount] = useState(() => safeAmount(searchParams.get("amount")));
  const [stage, setStage] = useState<"amount" | "slip">("amount");
  const [slipUrl, setSlipUrl] = useState("");
  const [slipError, setSlipError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const fromBooking = searchParams.get("returnTo")?.startsWith("/bookings/");
  const pending = requests.find((request) => request.status === "PENDING");

  useEffect(() => {
    Promise.all([getWallet(), getMyTopups()])
      .then(([wallet, topups]) => {
        setBalance(wallet.balance);
        setRequests(topups.requests);
        setPromptPayId(topups.promptPayId);
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

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto w-full max-w-3xl flex-1 px-6 py-12 lg:py-16"
    >
      <p className="text-sm font-semibold text-brand-link">PromptPay</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">Top up your wallet</h1>
      <p className="mt-3 text-muted">
        Transfer by PromptPay, then send us the slip. An admin checks it and adds the money to the
        same balance you use to confirm lessons.
      </p>

      <section className="mt-8 overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
        <div className="flex items-center justify-between border-b border-line px-6 py-5">
          <span className="text-sm text-muted">Current balance</span>
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
              <StatusBadge status="PENDING" />
            </div>
            <p className="mt-2 text-muted">
              Your balance updates once an admin approves the slip. You can send another top-up
              after this one is reviewed.
            </p>
            {fromBooking && (
              <p className="mt-2 text-sm text-amber-800 dark:text-amber-300">
                Your booking is held for a limited time. If it expires before approval, book the
                slot again once your balance is updated.
              </p>
            )}
            <p className="mt-4 text-sm">
              Sent {formatBangkokDateTime(pending.createdAt)} ·{" "}
              <a
                href={pending.slipUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-brand-link underline"
              >
                View slip
              </a>
            </p>
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
                  className={`rounded-2xl border px-4 py-3 font-semibold transition-colors ${
                    amount === preset
                      ? "border-brand-navy bg-brand-navy text-white"
                      : "border-line hover:border-brand-navy"
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
              className="mt-2 h-12 w-full rounded-2xl border border-line bg-transparent px-4 text-lg focus-visible:outline-2 focus-visible:outline-brand-link focus:border-brand-navy"
            />
            {balance !== null && !isPromptPayId(promptPayId) && (
              <p role="alert" className="mt-6 text-sm text-red-700 dark:text-red-400">
                Top-up is not available right now because the PromptPay account is not set up
                correctly.
              </p>
            )}
            <button
              type="button"
              disabled={balance === null || !isPromptPayId(promptPayId)}
              onClick={showQr}
              className="mt-6 h-12 w-full rounded-lg bg-brand-navy font-semibold text-white transition-colors hover:bg-brand-navy-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              Show PromptPay QR
            </button>
          </div>
        )}

        {!loading && !pending && stage === "slip" && isPromptPayId(promptPayId) && (
          <div className="flex flex-col items-center p-6 text-center sm:p-8">
            <QRCodeSVG
              role="img"
              aria-label="PromptPay QR code"
              value={promptPayPayload(promptPayId, amount)}
              size={208}
              marginSize={2}
              level="M"
              className="rounded-2xl"
            />
            <h2 className="mt-5 text-2xl font-semibold">Transfer {money(amount)}</h2>
            <p className="mt-2 text-sm text-muted">
              Scan with your banking app. The amount is already filled in.
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
                className="mt-2 h-12 w-full rounded-2xl border border-line bg-transparent px-4 focus-visible:outline-2 focus-visible:outline-brand-link focus:border-brand-navy aria-[invalid=true]:border-red-500"
              />
              {slipError ? (
                <span id="slip-url-error" className="mt-1 text-sm text-red-600">
                  {slipError}
                </span>
              ) : (
                <span id="slip-url-help" className="mt-1 text-sm text-muted">
                  Upload the slip image (for example to Google Drive, shared with anyone who has the
                  link) and paste the link here.
                </span>
              )}
              <button
                type="submit"
                disabled={busy}
                className="mt-6 h-12 w-full rounded-lg bg-brand-navy font-semibold text-white transition-colors hover:bg-brand-navy-dark disabled:opacity-50"
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
              className="mt-3 h-11 font-semibold text-brand-link hover:underline"
            >
              Change amount
            </button>
          </div>
        )}
      </section>

      {requests.length > 0 && (
        <section aria-label="Recent top-ups" className="mt-8">
          <h2 className="text-lg font-semibold">Recent top-ups</h2>
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-surface">
            {requests.map((request) => (
              <li key={request.id} className="flex flex-col gap-1 px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="font-medium">{money(Number(request.amount))}</span>
                  <StatusBadge status={request.status} />
                </div>
                <span className="text-sm text-muted">
                  Sent {formatBangkokDateTime(request.createdAt)}
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
