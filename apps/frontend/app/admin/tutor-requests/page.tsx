"use client";

import { useEffect, useRef, useState } from "react";
import { TutorRefreshButton } from "@/src/components/tutor-refresh-button";
import { TutorSubmissionStatus } from "@/src/components/tutor-submission-status";
import { RequireAuth } from "@/src/components/require-auth";
import {
  TutorProfileComparison,
  TutorProfileSnapshot,
} from "@/src/components/tutor-profile-comparison";
import {
  TutorApiError,
  tutorApi,
  type TutorProfileVersion,
  type TutorReviewRequest,
} from "@/src/lib/tutor-application";

const shell = "mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-16";
const button =
  "rounded-full border border-black/[.12] px-5 py-2.5 font-medium disabled:opacity-60 dark:border-white/[.18]";

export default function TutorRequestsPage() {
  return (
    <RequireAuth>
      <TutorRequests />
    </RequireAuth>
  );
}

function TutorRequests() {
  const [requests, setRequests] = useState<TutorReviewRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [status, setStatus] = useState("PENDING");
  const visibleRequests = requests?.filter(
    (request) => status === "ALL" || request.status === status
  );

  useEffect(() => {
    const controller = new AbortController();
    tutorApi<TutorReviewRequest[]>("/api/admin/tutor-requests", { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) {
          setRequests(result);
          setError(null);
        }
      })
      .catch((failure: unknown) => {
        if (controller.signal.aborted) return;
        setError(failure instanceof Error ? failure.message : "Could not load requests.");
        setForbidden(failure instanceof TutorApiError && failure.status === 403);
      });
    return () => controller.abort();
  }, [reload]);

  return (
    <main className={shell}>
      <div>
        <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">Admin</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Tutor requests</h1>
        <p className="mt-3 text-zinc-500">
          Review initial applications and profile edits. Approval applies the submitted version
          automatically; existing publication settings are preserved.
        </p>
      </div>
      {error && (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {forbidden
            ? "Admin access required. You do not have permission to review tutor requests."
            : error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {!forbidden && (
        <section
          aria-label="Tutor submissions"
          className="overflow-hidden rounded-lg border border-black/[.12] dark:border-white/[.18]"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[.12] px-4 py-3 dark:border-white/[.18]">
            <TutorRefreshButton
              label="Refresh requests"
              onClick={() => {
                setRequests(null);
                setError(null);
                setReload((value) => value + 1);
              }}
            />
            <label className="ml-auto flex items-center gap-2 text-sm">
              <span>Submission status</span>
              <span className="relative">
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className="appearance-none rounded-md border border-black/[.12] bg-background py-2 pl-3 pr-9 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 dark:border-white/[.18] dark:[color-scheme:dark]"
                >
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="CANCELLED">Cancelled</option>
                  <option value="ALL">All submissions</option>
                </select>
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </span>
            </label>
          </div>
          <div className="px-4">
            {!requests && !error && <p className="py-5 text-sm text-zinc-500">Loading requests…</p>}
            {visibleRequests?.length === 0 && (
              <p className="py-5 text-sm text-zinc-500">
                {status === "PENDING"
                  ? "No pending tutor requests."
                  : "No matching tutor submissions."}
              </p>
            )}
            <ul className="divide-y divide-black/[.12] dark:divide-white/[.18]">
              {visibleRequests?.map((request) => (
                <li key={request.id}>
                  <ReviewRow
                    request={request}
                    onReviewed={(reviewed) => {
                      setRequests(
                        (current) =>
                          current?.map((item) =>
                            item.id === request.id ? { ...item, ...reviewed } : item
                          ) ?? null
                      );
                      setMessage(
                        `Request ${reviewed.status === "APPROVED" ? "approved" : "rejected"} for ${request.user.firstName} ${request.user.lastName}.`
                      );
                    }}
                    onForbidden={() => {
                      setForbidden(true);
                      setRequests(null);
                      setMessage(null);
                      setError("Admin access required.");
                    }}
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

function ReviewRow({
  request,
  onReviewed,
  onForbidden,
}: {
  request: TutorReviewRequest;
  onReviewed: (reviewed: TutorProfileVersion) => void;
  onForbidden: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reasonError, setReasonError] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

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
      const reviewed = await tutorApi<TutorProfileVersion>(
        `/api/admin/tutor-requests/${request.id}/review`,
        {
          method: "POST",
          body: JSON.stringify({
            decision,
            ...(decision === "REJECTED" ? { rejectionReason: reason.trim() } : {}),
          }),
        }
      );
      onReviewed(reviewed);
    } catch (failure) {
      if (failure instanceof TutorApiError && failure.status === 403) onForbidden();
      else setError(failure instanceof Error ? failure.message : "Could not review this request.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <section aria-label={`Request from ${request.user.firstName} ${request.user.lastName}`}>
      <details>
        <summary className="cursor-pointer py-4 marker:text-zinc-500">
          <span className="inline-flex w-[calc(100%_-_1.5rem)] flex-wrap items-center justify-between gap-3 align-middle">
            <span className="min-w-0">
              <span className="block font-medium">
                {request.user.firstName} {request.user.lastName}
              </span>
              <span className="block break-all text-sm text-zinc-500">{request.user.email}</span>
            </span>
            <span className="text-sm sm:text-right">
              <TutorSubmissionStatus status={request.status} />
              {request.submittedAt && (
                <time dateTime={request.submittedAt} className="block text-xs text-zinc-500">
                  Submitted {new Date(request.submittedAt).toLocaleString()}
                </time>
              )}
            </span>
          </span>
        </summary>
        <div className="pb-5">
          {request.status === "PENDING" ? (
            <TutorProfileComparison current={request.currentProfile} proposed={request} />
          ) : (
            <TutorProfileSnapshot profile={request} />
          )}
          {request.reviewedAt && (
            <p className="mt-3 text-sm">Reviewed {new Date(request.reviewedAt).toLocaleString()}</p>
          )}
          {request.rejectionReason && <p className="mt-3">Reason: {request.rejectionReason}</p>}
          {request.status === "PENDING" && (
            <fieldset disabled={busy} className="mt-5 flex flex-col gap-3">
              <label htmlFor={`reason-${request.id}`} className="text-sm font-medium">
                Rejection reason (required to reject)
              </label>
              <textarea
                id={`reason-${request.id}`}
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                aria-invalid={reasonError}
                aria-describedby={reasonError ? `reason-error-${request.id}` : undefined}
                className="rounded-lg border border-black/[.12] bg-transparent p-3 dark:border-white/[.18]"
              />
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
              <div className="flex flex-wrap justify-end gap-3">
                <button className={button} disabled={busy} onClick={() => void review("REJECTED")}>
                  Reject request
                </button>
                <button
                  className={`${button} bg-foreground text-background`}
                  disabled={busy}
                  onClick={() => void review("APPROVED")}
                >
                  {busy ? "Reviewing…" : "Approve request"}
                </button>
              </div>
            </fieldset>
          )}
        </div>
      </details>
    </section>
  );
}
