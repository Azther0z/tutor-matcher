"use client";

import { useId, useState, useSyncExternalStore } from "react";
import { TutorDialog } from "@/src/components/tutor-dialog";
import { getAuthToken, subscribeToAuth } from "@/src/lib/auth";
import { flagReview, ReviewFlagApiError } from "@/src/lib/review-flags-api";

const button =
  "rounded-full border border-black/[.12] px-5 py-2.5 font-medium disabled:opacity-60 dark:border-white/[.18]";

// REV-3: a signed-in member flags a review's comment; the flagger then sees a Flagged marker
// instead of the button, and the comment stays public until an Admin decides.
export function ReviewFlag({
  reviewId,
  reviewer,
  flagged = false,
  own = false,
}: {
  reviewId: string;
  reviewer: string;
  flagged?: boolean;
  own?: boolean;
}) {
  const signedIn = useSyncExternalStore(
    subscribeToAuth,
    () => !!getAuthToken(),
    () => false
  );
  const id = useId();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonMissing, setReasonMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!signedIn || own) return null;
  if (flagged || done) {
    return (
      <p className="mt-1">
        <span className="inline-flex rounded-md bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-800 dark:text-amber-300">
          Flagged
        </span>
      </p>
    );
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const trimmed = reason.trim();
    setError(null);
    setReasonMissing(!trimmed);
    if (!trimmed) return;
    setBusy(true);
    try {
      await flagReview(reviewId, trimmed);
      setDone(true);
      setOpen(false);
    } catch (failure) {
      // Flagging twice is refused by the server; the member just sees the review as Flagged.
      if (failure instanceof ReviewFlagApiError && failure.code === "ALREADY_FLAGGED") {
        setDone(true);
        setOpen(false);
        return;
      }
      setError(failure instanceof Error ? failure.message : "Could not flag this review.");
      setBusy(false);
    }
  }

  return (
    <>
      <p className="mt-1">
        <button
          type="button"
          aria-label={`Flag review by ${reviewer}`}
          onClick={() => setOpen(true)}
          className="text-sm text-zinc-500 underline underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500"
        >
          Flag
        </button>
      </p>
      {open && (
        <TutorDialog
          title="Flag this review"
          titleId={`${id}-title`}
          onClose={() => setOpen(false)}
          busy={busy}
          footer={
            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                className={button}
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                form={`${id}-form`}
                className={`${button} bg-foreground text-background`}
                disabled={busy}
              >
                {busy ? "Flagging…" : "Flag review"}
              </button>
            </div>
          }
        >
          <form id={`${id}-form`} noValidate onSubmit={submit} className="flex flex-col gap-4">
            <p>
              Tell us why the comment by {reviewer} is inappropriate. An admin will review it. The
              comment stays visible until they decide.
            </p>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Reason
              <textarea
                rows={3}
                maxLength={500}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                aria-invalid={reasonMissing}
                className="rounded-lg border border-black/[.12] bg-transparent p-3 text-base font-normal dark:border-white/[.18]"
              />
            </label>
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
      )}
    </>
  );
}
