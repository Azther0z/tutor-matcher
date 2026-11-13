"use client";

import { useEffect, useRef, useState } from "react";
import { RequireAuth } from "@/src/components/require-auth";
import { TutorDialog } from "@/src/components/tutor-dialog";
import { TutorRefreshButton } from "@/src/components/tutor-refresh-button";
import {
  getFlaggedReviews,
  moderateReview,
  type FlaggedReview,
  type ReviewQueueStatus,
} from "@/src/lib/review-moderation-api";
import { TutorApiError } from "@/src/lib/tutor-application";

const shell = "mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-16";
const button =
  "h-9 rounded-full border border-black/[.12] px-4 text-sm font-medium disabled:opacity-60 dark:border-white/[.18]";
const badge = "inline-flex rounded-md px-2 py-1 text-xs font-medium";
const dateFormat: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" };
const when = (iso: string) => new Date(iso).toLocaleString(undefined, dateFormat);

type Decision = "KEEP" | "REMOVE";

export default function FlaggedReviewsPage() {
  return (
    <RequireAuth>
      <FlaggedReviews />
    </RequireAuth>
  );
}

function FlaggedReviews() {
  const [reviews, setReviews] = useState<FlaggedReview[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [status, setStatus] = useState<ReviewQueueStatus>("PENDING");

  useEffect(() => {
    let active = true;
    getFlaggedReviews(status)
      .then((result) => {
        if (!active) return;
        setReviews(result);
        setError(null);
      })
      .catch((failure: unknown) => {
        if (!active) return;
        setError(failure instanceof Error ? failure.message : "Could not load flagged reviews.");
        setForbidden(failure instanceof TutorApiError && failure.status === 403);
      });
    return () => {
      active = false;
    };
  }, [reload, status]);

  function refresh() {
    setReviews(null);
    setError(null);
    setReload((value) => value + 1);
  }

  return (
    <main className={shell}>
      <div>
        <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">Admin</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Flagged reviews</h1>
        <p className="mt-3 text-zinc-500">
          Members flag review comments they find inappropriate. Keep a review that follows the
          rules, or remove the whole review with a reason the author will see. Everyone who flagged
          it is told the outcome.
        </p>
      </div>
      {error && (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {forbidden
            ? "Admin access required. You do not have permission to moderate reviews."
            : error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {!forbidden && (
        <section
          aria-label="Flagged reviews"
          className="overflow-hidden rounded-lg border border-black/[.12] dark:border-white/[.18]"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[.12] px-4 py-3 dark:border-white/[.18]">
            <TutorRefreshButton label="Refresh flagged reviews" onClick={refresh} />
            <label className="ml-auto flex items-center gap-2 text-sm">
              <span>Status</span>
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as ReviewQueueStatus);
                  setReviews(null);
                  setMessage(null);
                }}
                className="rounded-md border border-black/[.12] bg-background py-2 pl-3 pr-3 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 dark:border-white/[.18] dark:[color-scheme:dark]"
              >
                <option value="PENDING">Pending</option>
                <option value="DECIDED">Decided</option>
              </select>
            </label>
          </div>
          <div className="px-4">
            {!reviews && !error && (
              <p className="py-5 text-sm text-zinc-500">Loading flagged reviews…</p>
            )}
            {reviews?.length === 0 && (
              <p className="py-5 text-sm text-zinc-500">
                {status === "PENDING"
                  ? "No flagged reviews waiting for a decision."
                  : "No decisions yet."}
              </p>
            )}
            <ul className="divide-y divide-black/[.12] dark:divide-white/[.18]">
              {reviews?.map((review) => (
                <li key={review.id}>
                  <FlaggedReviewRow
                    review={review}
                    onDecided={(decided, decision) => {
                      setReviews(
                        (current) => current?.filter(({ id }) => id !== decided.id) ?? null
                      );
                      setMessage(
                        decision === "KEEP"
                          ? `Kept the review by ${review.author}. The reporters were told.`
                          : `Removed the review by ${review.author}. The reporters and the author were told.`
                      );
                    }}
                    onStale={(stale) => {
                      setMessage(stale);
                      refresh();
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

function FlaggedReviewRow({
  review,
  onDecided,
  onStale,
}: {
  review: FlaggedReview;
  onDecided: (review: FlaggedReview, decision: Decision) => void;
  onStale: (message: string) => void;
}) {
  const [decision, setDecision] = useState<Decision | null>(null);
  const pending = review.pendingFlags > 0;

  return (
    <section aria-label={`Review by ${review.author}`} className="flex flex-col gap-2 py-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="min-w-0 text-sm">
          <span className="font-medium">{review.author}</span>
          <span className="text-zinc-500">
            {" "}
            reviewed {review.tutor} · {review.subject} ·{" "}
          </span>
          <span aria-label={`${review.rating} out of 5 stars`} className="text-amber-500">
            {"★".repeat(review.rating)}
          </span>
        </p>
        {pending ? (
          <span className={`${badge} bg-amber-500/10 text-amber-800 dark:text-amber-300`}>
            {review.pendingFlags === 1 ? "1 flag" : `${review.pendingFlags} flags`}
          </span>
        ) : review.removed ? (
          <span className={`${badge} bg-rose-500/10 text-rose-800 dark:text-rose-300`}>
            Removed
          </span>
        ) : (
          <span className={`${badge} bg-emerald-500/10 text-emerald-800 dark:text-emerald-300`}>
            Kept
          </span>
        )}
      </div>
      {review.comment && (
        <p className="whitespace-pre-line rounded-md bg-black/[.04] p-2 text-sm dark:bg-white/[.06]">
          {review.comment}
        </p>
      )}
      <ul aria-label="Flags" className="flex flex-col gap-1 text-sm">
        {review.flags.map((flag) => (
          <li key={flag.id}>
            <span className="font-medium">{flag.reporter}</span>: {flag.reason}{" "}
            <span className="text-xs text-zinc-500">
              · <time dateTime={flag.createdAt}>{when(flag.createdAt)}</time>
              {flag.outcome && flag.decidedAt && (
                <>
                  {" "}
                  · {flag.outcome === "KEPT" ? "Kept" : "Removed"} by {flag.decidedBy} on{" "}
                  <time dateTime={flag.decidedAt}>{when(flag.decidedAt)}</time>
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
      {review.removed && (
        <p className="text-sm">
          Removed by {review.removed.by} on{" "}
          <time dateTime={review.removed.removedAt}>{when(review.removed.removedAt)}</time>. Reason:{" "}
          {review.removed.reason}
        </p>
      )}
      {pending && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={button} onClick={() => setDecision("KEEP")}>
            Keep review
          </button>
          <button
            type="button"
            className={`${button} border-transparent bg-red-600 text-white`}
            onClick={() => setDecision("REMOVE")}
          >
            Remove review
          </button>
        </div>
      )}
      {decision && (
        <DecisionDialog
          review={review}
          decision={decision}
          onClose={() => setDecision(null)}
          onDecided={(decided) => onDecided(decided, decision)}
          onStale={onStale}
        />
      )}
    </section>
  );
}

function DecisionDialog({
  review,
  decision,
  onClose,
  onDecided,
  onStale,
}: {
  review: FlaggedReview;
  decision: Decision;
  onClose: () => void;
  onDecided: (review: FlaggedReview) => void;
  onStale: (message: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [reasonMissing, setReasonMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const remove = decision === "REMOVE";
  const formId = `moderation-${review.id}`;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const trimmed = reason.trim();
    setError(null);
    setReasonMissing(remove && !trimmed);
    if (remove && !trimmed) return;
    inFlight.current = true;
    setBusy(true);
    try {
      onDecided(await moderateReview(review.id, decision, remove ? trimmed : undefined));
    } catch (failure) {
      inFlight.current = false;
      setBusy(false);
      // Another Admin decided first: refresh the queue instead of acting twice.
      if (failure instanceof TutorApiError && failure.status === 409) {
        onStale(failure.message);
        return;
      }
      setError(failure instanceof Error ? failure.message : "Could not save this decision.");
    }
  }

  return (
    <TutorDialog
      title={remove ? "Remove this review" : "Keep this review"}
      titleId={`${formId}-title`}
      onClose={onClose}
      busy={busy}
      footer={
        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" className={button} disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form={formId}
            disabled={busy}
            className={`${button} border-transparent ${remove ? "bg-red-600 text-white" : "bg-foreground text-background"}`}
          >
            {busy ? "Saving…" : remove ? "Remove review" : "Keep review"}
          </button>
        </div>
      }
    >
      <form id={formId} noValidate onSubmit={submit} className="flex flex-col gap-4">
        <p>
          {remove
            ? `The whole review by ${review.author} disappears from ${review.tutor}'s profile and stops counting in ratings. The author is emailed your reason.`
            : `The review by ${review.author} stays published. Everyone who flagged it is told; other members can still flag it later.`}
        </p>
        {remove && (
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Reason (sent to the author)
            <textarea
              rows={3}
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              aria-invalid={reasonMissing}
              className="rounded-lg border border-black/[.12] bg-transparent p-3 text-base font-normal dark:border-white/[.18]"
            />
          </label>
        )}
        {reasonMissing && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            Enter a reason.
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </form>
    </TutorDialog>
  );
}
