"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { submitReview } from "@/src/lib/reviews-api";
import type { Booking, BookingReview } from "@/src/types/booking";

const MAX_COMMENT_LENGTH = 2000;
const RATINGS = [1, 2, 3, 4, 5] as const;

function Stars({ rating }: { rating: number }) {
  return (
    <span aria-label={`${rating} out of 5 stars`} className="text-amber-500">
      {"★".repeat(rating)}
      <span className="text-zinc-300 dark:text-zinc-600">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

// REV-1: the Student rates their own completed lesson; the review is published for that
// tutor and subject. Before completion this explains why a review is not possible yet.
export function BookingReviewSection({
  booking,
  onPublished,
}: {
  booking: Booking;
  onPublished: (review: BookingReview) => void;
}) {
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const subjectHref = `/tutors/${booking.subject.tutor.id}/${booking.subject.id}`;

  if (booking.viewerRole === "TUTOR") return null;

  async function publish() {
    if (inFlight.current) return;
    if (rating === null) {
      setError("Choose a rating from 1 to 5 stars.");
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const trimmed = comment.trim();
      onPublished(
        await submitReview({
          bookingId: booking.id,
          rating,
          ...(trimmed ? { comment: trimmed } : {}),
        })
      );
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not publish your review.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const sectionClass = "mt-5 border-t border-zinc-200 pt-5 dark:border-zinc-800";

  if (booking.review?.removed) {
    return (
      <section aria-label="Your review" className={sectionClass}>
        <h3 className="font-semibold">Your review</h3>
        <p className="mt-2 text-sm">
          Your review was removed by an admin. Reason: {booking.review.removed.reason}
        </p>
        <p className="mt-2 text-sm text-zinc-500">
          It no longer shows on {booking.subject.tutor.name}&apos;s profile or counts in ratings.
          Each lesson can be reviewed once, so a new review can&apos;t be written.
        </p>
      </section>
    );
  }

  if (booking.review) {
    return (
      <section aria-label="Your review" className={sectionClass}>
        <h3 className="font-semibold">Your review</h3>
        <p className="mt-2">
          <Stars rating={booking.review.rating} />
        </p>
        {booking.review.comment && (
          <p className="mt-2 whitespace-pre-line text-sm">{booking.review.comment}</p>
        )}
        <p className="mt-2 text-sm text-zinc-500">
          Published for {booking.subject.tutor.name} on the{" "}
          <Link href={subjectHref} className="font-semibold text-violet-600 underline">
            {booking.subject.name}
          </Link>{" "}
          page.
        </p>
      </section>
    );
  }

  if (booking.actions.canReview) {
    return (
      <section aria-label="Write a review" className={sectionClass}>
        <h3 className="font-semibold">Review this lesson</h3>
        <p className="mt-2 text-sm text-zinc-500">
          Your review is published for {booking.subject.tutor.name}&apos;s {booking.subject.name}{" "}
          lessons.
        </p>
        <fieldset disabled={busy} className="mt-3">
          <legend className="text-sm font-medium">Rating</legend>
          <div role="radiogroup" aria-label="Rating" className="mt-1 flex gap-1">
            {RATINGS.map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={rating === value}
                aria-label={`${value} ${value === 1 ? "star" : "stars"}`}
                onClick={() => {
                  setRating(value);
                  setError(null);
                }}
                className={`text-2xl leading-none ${
                  rating !== null && value <= rating
                    ? "text-amber-500"
                    : "text-zinc-300 dark:text-zinc-600"
                }`}
              >
                ★
              </button>
            ))}
          </div>
          <label className="mt-3 block text-sm font-medium">
            Comment <span className="font-normal text-zinc-500">(optional)</span>
            <textarea
              value={comment}
              maxLength={MAX_COMMENT_LENGTH}
              rows={4}
              onChange={(event) => setComment(event.target.value)}
              className="mt-2 w-full rounded-xl border border-zinc-300 bg-transparent p-3 dark:border-zinc-700"
            />
          </label>
        </fieldset>
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {error}
          </p>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => void publish()}
          className="mt-3 h-10 w-full rounded-full bg-violet-600 font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Publishing…" : "Publish review"}
        </button>
      </section>
    );
  }

  if (booking.status === "CONFIRMED") {
    return (
      <section aria-label="Review eligibility" className={sectionClass}>
        <h3 className="font-semibold">Review not yet eligible</h3>
        <p className="mt-2 text-sm text-zinc-500">
          Your Tutor must confirm completion before you can review this lesson.
        </p>
      </section>
    );
  }

  return null;
}
