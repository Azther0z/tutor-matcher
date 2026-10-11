"use client";

import { useEffect, useRef, useState } from "react";
import { RequireAuth } from "@/src/components/require-auth";
import { TutorProfileComparison } from "@/src/components/tutor-profile-comparison";
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
        <>
          <button
            className={`${button} self-start`}
            onClick={() => {
              setRequests(null);
              setError(null);
              setReload((value) => value + 1);
            }}
          >
            Refresh requests
          </button>
          {!requests && !error && <p>Loading requests…</p>}
          {requests?.length === 0 && <p>No pending tutor requests.</p>}
          {requests?.map((request) => (
            <ReviewCard
              key={request.id}
              request={request}
              onReviewed={(decision) => {
                setRequests((current) => current?.filter((item) => item.id !== request.id) ?? null);
                setMessage(
                  `Request ${decision === "APPROVED" ? "approved" : "rejected"} for ${request.user.firstName} ${request.user.lastName}.`
                );
              }}
              onForbidden={() => {
                setForbidden(true);
                setRequests(null);
                setMessage(null);
                setError("Admin access required.");
              }}
            />
          ))}
        </>
      )}
    </main>
  );
}

function ReviewCard({
  request,
  onReviewed,
  onForbidden,
}: {
  request: TutorReviewRequest;
  onReviewed: (decision: "APPROVED" | "REJECTED") => void;
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
      await tutorApi<TutorProfileVersion>(`/api/admin/tutor-requests/${request.id}/review`, {
        method: "POST",
        body: JSON.stringify({
          decision,
          ...(decision === "REJECTED" ? { rejectionReason: reason.trim() } : {}),
        }),
      });
      onReviewed(decision);
    } catch (failure) {
      if (failure instanceof TutorApiError && failure.status === 403) onForbidden();
      else setError(failure instanceof Error ? failure.message : "Could not review this request.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <section
      className="rounded-2xl border border-black/[.12] p-6 dark:border-white/[.18]"
      aria-label={`Request from ${request.user.firstName} ${request.user.lastName}`}
    >
      <h2 className="text-xl font-semibold">
        {request.user.firstName} {request.user.lastName}
      </h2>
      <p className="mt-1 break-all text-sm text-zinc-500">{request.user.email}</p>
      <p className="my-4 text-sm">
        {request.currentProfile ? "Profile edit" : "Initial application"} · Pending Verification
        {request.submittedAt && <> · Submitted {new Date(request.submittedAt).toLocaleString()}</>}
      </p>
      <TutorProfileComparison current={request.currentProfile} proposed={request} />
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
    </section>
  );
}
