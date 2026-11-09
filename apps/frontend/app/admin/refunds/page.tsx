"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { RequireAuth } from "@/src/components/require-auth";
import { TopupStatusBadge } from "@/src/components/topup-status";
import { TutorRefreshButton } from "@/src/components/tutor-refresh-button";
import {
  getRefundsForReview,
  refundReasonLabels,
  RefundApiError,
  reviewRefund,
  type AdminRefundRequest,
} from "@/src/lib/refunds-api";
import type { RefundRequestStatus } from "@/src/types/booking";

const shell = "mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-16";
const button =
  "h-9 rounded-full border border-black/[.12] px-4 text-sm font-medium disabled:opacity-60 dark:border-white/[.18]";
const amountFormat = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const dateFormat: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" };

export default function RefundRequestsPage() {
  return (
    <RequireAuth>
      <RefundRequests />
    </RequireAuth>
  );
}

function RefundRequests() {
  const [requests, setRequests] = useState<AdminRefundRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [status, setStatus] = useState<RefundRequestStatus | "ALL">("PENDING");

  useEffect(() => {
    let active = true;
    getRefundsForReview(status === "ALL" ? undefined : status)
      .then((result) => {
        if (!active) return;
        setRequests(result);
        setError(null);
      })
      .catch((failure: unknown) => {
        if (!active) return;
        setError(failure instanceof Error ? failure.message : "Could not load refund requests.");
        setForbidden(failure instanceof RefundApiError && failure.status === 403);
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
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Refund requests</h1>
        <p className="mt-3 text-zinc-500">
          Students ask for a refund when a lesson was unsatisfactory. Approval returns the full
          amount to the Student&apos;s wallet and cancels the lesson; a rejection needs a reason the
          Student will see. Tutor no-shows are refunded automatically and appear here as history.
        </p>
      </div>
      {error && (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {forbidden
            ? "Admin access required. You do not have permission to review refunds."
            : error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {!forbidden && (
        <section
          aria-label="Refund requests"
          className="overflow-hidden rounded-lg border border-black/[.12] dark:border-white/[.18]"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[.12] px-4 py-3 dark:border-white/[.18]">
            <TutorRefreshButton label="Refresh refund requests" onClick={refresh} />
            <label className="ml-auto flex items-center gap-2 text-sm">
              <span>Status</span>
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as RefundRequestStatus | "ALL");
                  setRequests(null);
                  setMessage(null);
                }}
                className="rounded-md border border-black/[.12] bg-background py-2 pl-3 pr-3 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 dark:border-white/[.18] dark:[color-scheme:dark]"
              >
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="ALL">All</option>
              </select>
            </label>
          </div>
          <div className="px-4">
            {!requests && !error && (
              <p className="py-5 text-sm text-zinc-500">Loading refund requests…</p>
            )}
            {requests?.length === 0 && (
              <p className="py-5 text-sm text-zinc-500">
                {status === "PENDING"
                  ? "No refund requests waiting for review."
                  : status === "ALL"
                    ? "No refund requests yet."
                    : "No matching refund requests."}
              </p>
            )}
            <ul className="divide-y divide-black/[.12] dark:divide-white/[.18]">
              {requests?.map((request) => (
                <li key={request.id}>
                  <RefundRow
                    request={request}
                    onReviewed={(reviewed) => {
                      // A reviewed request leaves the pending list and updates in place elsewhere.
                      setRequests(
                        (current) =>
                          current?.flatMap((item) => {
                            if (item.id !== reviewed.id) return [item];
                            return status === "PENDING" ? [] : [reviewed];
                          }) ?? null
                      );
                      setMessage(
                        `฿${amountFormat.format(Number(reviewed.amount))} refund ${
                          reviewed.status === "APPROVED" ? "approved" : "rejected"
                        } for ${request.student.firstName} ${request.student.lastName}.`
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

function RefundRow({
  request,
  onReviewed,
  onStale,
}: {
  request: AdminRefundRequest;
  onReviewed: (reviewed: AdminRefundRequest) => void;
  onStale: () => void;
}) {
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const name = `${request.student.firstName} ${request.student.lastName}`;

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
        await reviewRefund(
          request.id,
          decision,
          decision === "REJECTED" ? reason.trim() : undefined
        )
      );
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not review this refund.");
      if (failure instanceof RefundApiError && failure.code === "REFUND_NOT_PENDING") onStale();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <section aria-label={`Refund request from ${name}`} className="flex flex-col gap-1.5 py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="min-w-0 text-sm">
          <span className="font-medium">{name}</span>{" "}
          <span className="break-all text-zinc-500">{request.student.email}</span>
        </p>
        <div className="flex items-center gap-2">
          <TopupStatusBadge status={request.status} />
          <span className="font-semibold">฿{amountFormat.format(Number(request.amount))}</span>
        </div>
      </div>
      <p className="text-sm">
        <span className="font-medium">{refundReasonLabels[request.reason]}</span> ·{" "}
        {request.booking.subjectName} with {request.booking.tutorName},{" "}
        <time dateTime={request.booking.startedAt}>
          {new Date(request.booking.startedAt).toLocaleString(undefined, dateFormat)}
        </time>{" "}
        ·{" "}
        <Link href={`/bookings/${request.booking.id}`} className="underline">
          Booking
        </Link>
      </p>
      {request.details && (
        <p className="whitespace-pre-line rounded-md bg-black/[.04] p-2 text-sm dark:bg-white/[.06]">
          {request.details}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
        <time dateTime={request.createdAt}>
          Sent {new Date(request.createdAt).toLocaleString(undefined, dateFormat)}
        </time>
        {request.reviewedAt && (
          <time dateTime={request.reviewedAt}>
            {request.reviewedByAdmin ? "Reviewed" : "Refunded automatically"}{" "}
            {new Date(request.reviewedAt).toLocaleString(undefined, dateFormat)}
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
              Reject refund
            </button>
            <button
              className={`${button} bg-foreground text-background`}
              disabled={busy}
              onClick={() => void review("APPROVED")}
            >
              {busy ? "Reviewing…" : "Approve full refund"}
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
