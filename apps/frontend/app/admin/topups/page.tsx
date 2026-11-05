"use client";

import { useEffect, useRef, useState } from "react";
import { RequireAuth } from "@/src/components/require-auth";
import { TopupStatusBadge } from "@/src/components/topup-status";
import { TutorRefreshButton } from "@/src/components/tutor-refresh-button";
import {
  getTopupsForReview,
  reviewTopup,
  WalletApiError,
  type AdminTopupRequest,
  type TopupRequest,
  type TopupStatus,
} from "@/src/lib/wallet-api";

const shell = "mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-16";
const button =
  "h-9 rounded-full border border-black/[.12] px-4 text-sm font-medium disabled:opacity-60 dark:border-white/[.18]";
const amountFormat = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const dateFormat: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" };

export default function TopupRequestsPage() {
  return (
    <RequireAuth>
      <TopupRequests />
    </RequireAuth>
  );
}

function TopupRequests() {
  const [requests, setRequests] = useState<AdminTopupRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [status, setStatus] = useState<TopupStatus | "ALL">("ALL");

  useEffect(() => {
    let active = true;
    getTopupsForReview(status === "ALL" ? undefined : status)
      .then((result) => {
        if (!active) return;
        setRequests(result);
        setError(null);
      })
      .catch((failure: unknown) => {
        if (!active) return;
        setError(failure instanceof Error ? failure.message : "Could not load top-ups.");
        setForbidden(failure instanceof WalletApiError && failure.status === 403);
      });
    return () => {
      active = false;
    };
  }, [reload, status]);

  function refresh() {
    setRequests(null);
    setError(null);
    setReload((value) => value + 1);
  }

  return (
    <main className={shell}>
      <div>
        <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">Admin</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Top-up requests</h1>
        <p className="mt-3 text-zinc-500">
          Open each slip and check the amount before approving. Approval adds the amount to the
          user&apos;s wallet; a rejection needs a reason the user will see.
        </p>
      </div>
      {error && (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {forbidden
            ? "Admin access required. You do not have permission to review top-ups."
            : error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {!forbidden && (
        <section
          aria-label="Top-up requests"
          className="overflow-hidden rounded-lg border border-black/[.12] dark:border-white/[.18]"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[.12] px-4 py-3 dark:border-white/[.18]">
            <TutorRefreshButton label="Refresh top-ups" onClick={refresh} />
            <label className="ml-auto flex items-center gap-2 text-sm">
              <span>Status</span>
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as TopupStatus | "ALL");
                  setRequests(null);
                  setMessage(null);
                }}
                className="rounded-md border border-black/[.12] bg-background py-2 pl-3 pr-3 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 dark:border-white/[.18] dark:[color-scheme:dark]"
              >
                <option value="ALL">All</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </label>
          </div>
          <div className="px-4">
            {!requests && !error && <p className="py-5 text-sm text-zinc-500">Loading top-ups…</p>}
            {requests?.length === 0 && (
              <p className="py-5 text-sm text-zinc-500">
                {status === "PENDING"
                  ? "No top-ups waiting for review."
                  : status === "ALL"
                    ? "No top-ups yet."
                    : "No matching top-ups."}
              </p>
            )}
            <ul className="divide-y divide-black/[.12] dark:divide-white/[.18]">
              {requests?.map((request) => (
                <li key={request.id}>
                  <TopupRow
                    request={request}
                    onReviewed={(reviewed) => {
                      // A reviewed request leaves the pending list and updates in place elsewhere.
                      setRequests(
                        (current) =>
                          current?.flatMap((item) => {
                            if (item.id !== reviewed.id) return [item];
                            return status === "PENDING" ? [] : [{ ...item, ...reviewed }];
                          }) ?? null
                      );
                      setMessage(
                        `฿${amountFormat.format(Number(reviewed.amount))} top-up ${
                          reviewed.status === "APPROVED" ? "approved" : "rejected"
                        } for ${request.user.firstName} ${request.user.lastName}.`
                      );
                    }}
                    onStale={refresh}
                  />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </main>
  );
}

function TopupRow({
  request,
  onReviewed,
  onStale,
}: {
  request: AdminTopupRequest;
  onReviewed: (reviewed: TopupRequest) => void;
  onStale: () => void;
}) {
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const name = `${request.user.firstName} ${request.user.lastName}`;

  async function review(decision: "APPROVED" | "REJECTED") {
    if (busyRef.current) return;
    setError(null);
    setReasonError(false);
    if (decision === "REJECTED" && !reason.trim()) {
      setReasonError(true);
      return;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      onReviewed(
        await reviewTopup(request.id, decision, decision === "REJECTED" ? reason.trim() : undefined)
      );
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not review this top-up.");
      if (failure instanceof WalletApiError && failure.code === "TOPUP_NOT_PENDING") onStale();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <section aria-label={`Top-up from ${name}`} className="flex flex-col gap-1.5 py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="min-w-0 text-sm">
          <span className="font-medium">{name}</span>{" "}
          <span className="break-all text-zinc-500">{request.user.email}</span>
        </p>
        <div className="flex items-center gap-2">
          <TopupStatusBadge status={request.status} />
          <span className="font-semibold">฿{amountFormat.format(Number(request.amount))}</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
        <a
          href={request.slipUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="max-w-full truncate font-medium text-foreground underline sm:max-w-sm"
        >
          Open slip: {request.slipUrl}
        </a>
        <time dateTime={request.createdAt}>
          Sent {new Date(request.createdAt).toLocaleString(undefined, dateFormat)}
        </time>
        {request.reviewedAt && (
          <time dateTime={request.reviewedAt}>
            Reviewed {new Date(request.reviewedAt).toLocaleString(undefined, dateFormat)}
          </time>
        )}
      </div>
      {request.rejectionReason && <p className="text-sm">Reason: {request.rejectionReason}</p>}
      {request.status === "PENDING" && (
        <fieldset disabled={busy} className="mt-1 flex flex-col gap-1.5">
          <label htmlFor={`reason-${request.id}`} className="sr-only">
            Rejection reason (required to reject)
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id={`reason-${request.id}`}
              type="text"
              maxLength={500}
              placeholder="Reason (required to reject)"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              aria-invalid={reasonError}
              aria-describedby={reasonError ? `reason-error-${request.id}` : undefined}
              className="h-9 min-w-48 flex-1 rounded-lg border border-black/[.12] bg-transparent px-3 text-sm dark:border-white/[.18]"
            />
            <button className={button} disabled={busy} onClick={() => void review("REJECTED")}>
              Reject top-up
            </button>
            <button
              className={`${button} bg-foreground text-background`}
              disabled={busy}
              onClick={() => void review("APPROVED")}
            >
              {busy ? "Reviewing…" : "Approve top-up"}
            </button>
          </div>
          {reasonError && (
            <p id={`reason-error-${request.id}`} role="alert" className="text-sm text-red-600">
              Enter a rejection reason.
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
        </fieldset>
      )}
    </section>
  );
}
