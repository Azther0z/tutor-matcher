"use client";

import { useId, useRef, useState } from "react";
import {
  postReviewReply,
  ReviewReplyApiError,
  type PublicReviewReply,
} from "@/src/lib/review-replies-api";

export function ReviewReply({
  reviewId,
  reply,
  canReply = false,
}: {
  reviewId: string;
  reply?: PublicReviewReply | null;
  canReply?: boolean;
}) {
  const id = useId();
  const [published, setPublished] = useState<PublicReviewReply | null>(null);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const submitting = useRef(false);
  const displayed = published ?? reply;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting.current || !text.trim()) return;
    submitting.current = true;
    setPending(true);
    setError(null);
    try {
      setPublished(await postReviewReply(reviewId, text.trim(), displayed ?? undefined));
      setEditing(false);
      setText("");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not publish your reply. Try again."
      );
      if (
        reason instanceof ReviewReplyApiError &&
        [
          "REVIEW_NOT_FOUND",
          "REVIEW_ALREADY_REPLIED",
          "REVIEW_REPLY_CHANGED",
          "REVIEW_REPLY_NOT_FOUND",
        ].includes(reason.code ?? "")
      )
        setUnavailable(true);
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  if (displayed && (!editing || !canReply))
    return (
      <div className="mt-3 border-l-2 border-zinc-300 pl-4 dark:border-zinc-600">
        <p className="text-sm font-semibold">Tutor reply</p>
        <p className="whitespace-pre-wrap break-words text-sm text-zinc-600 dark:text-zinc-400">
          {displayed.text}
        </p>
        {displayed.editedAt && (
          <p className="mt-1 text-xs text-zinc-500">
            Edited ·{" "}
            <time dateTime={displayed.editedAt}>
              {new Date(displayed.editedAt).toLocaleString("en-GB", {
                timeZone: "Asia/Bangkok",
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </time>
          </p>
        )}
        {canReply && (
          <button
            type="button"
            disabled={unavailable}
            onClick={() => {
              setText(displayed.text);
              setError(null);
              setEditing(true);
            }}
            className="mt-2 text-sm font-medium underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 disabled:opacity-50"
          >
            Edit reply
          </button>
        )}
        <p className="mt-1 text-xs text-zinc-500">
          {new Date(displayed.repliedAt).toLocaleDateString("en-GB", {
            timeZone: "Asia/Bangkok",
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </p>
      </div>
    );
  if (!canReply) return null;
  return (
    <div className="mt-2">
      {editing ? (
        <form onSubmit={submit} className="flex flex-col gap-2">
          <label htmlFor={id} className="text-sm font-medium">
            Your public reply
          </label>
          <p className="text-sm text-zinc-500">
            Everyone can read your reply. You can edit it later; edited replies are labelled.
          </p>
          <textarea
            id={id}
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={2000}
            required
            disabled={pending}
            readOnly={unavailable}
            rows={3}
            className="rounded-xl border border-black/20 bg-transparent p-3 text-sm dark:border-white/20"
          />
          <span className="text-xs text-zinc-500">{text.length}/2000</span>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={
                pending ||
                unavailable ||
                !text.trim() ||
                (!!displayed && text.trim() === displayed.text)
              }
              className="rounded-full bg-foreground px-4 py-2 text-sm text-background disabled:opacity-50"
            >
              {pending
                ? displayed
                  ? "Saving…"
                  : "Publishing…"
                : displayed
                  ? "Save changes"
                  : "Publish reply"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setEditing(false);
                setError(null);
              }}
              className="px-3 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          disabled={unavailable}
          onClick={() => setEditing(true)}
          className="text-sm font-medium underline underline-offset-4 disabled:opacity-50"
        >
          Reply publicly
        </button>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
