"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { getTutorDashboard, type TutorDashboard } from "@/src/lib/dashboard-api";
import { ReviewFlag } from "./review-flag";
import { ReviewReply } from "./review-reply";

const dateFormat = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Bangkok",
});
const panel = "min-w-0 border-t border-line pt-3";

export function TutorDashboardStats({ children }: { children?: ReactNode }) {
  const [data, setData] = useState<TutorDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getTutorDashboard()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(
            reason instanceof Error ? reason.message : "Could not load your teaching overview."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  function refresh() {
    setLoading(true);
    setError(null);
    setReload((value) => value + 1);
  }

  return (
    <>
      <section aria-label="Teaching overview" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Teaching overview</h3>
            <p className="mt-0.5 text-xs text-muted">
              All-time activity, except classes this week. Each lesson is one booking.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/settings/tutor"
              className="text-xs font-semibold text-brand-link underline"
            >
              Manage subjects and listing
            </Link>
            <button
              type="button"
              onClick={refresh}
              disabled={loading}
              className="rounded-lg border border-line px-3 py-2 text-xs font-semibold disabled:opacity-50"
            >
              Refresh overview
            </button>
          </div>
        </div>
        {loading && (
          <p role="status" className="text-sm text-muted">
            Loading teaching overview…
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        {!loading && !error && data && (
          <div className="grid gap-5 border-t border-line pt-4 lg:grid-cols-3 lg:gap-6">
            <section className="min-w-0" aria-labelledby="teaching-activity-heading">
              <h4 id="teaching-activity-heading" className="text-sm font-semibold">
                Teaching activity
              </h4>
              <dl className="mt-3 grid gap-2 text-sm">
                {[
                  ["Classes this week", data.classesThisWeek],
                  ["Completed lessons", data.lessons.completed],
                  ["Students", data.students.total],
                  [
                    "Average rating",
                    data.reviews.averageRating === null
                      ? "Unrated"
                      : `${data.reviews.averageRating.toFixed(1)} / 5`,
                  ],
                ].map(([label, value]) => (
                  <div key={label} className="flex min-w-0 items-baseline justify-between gap-4">
                    <dt className="text-secondary">{label}</dt>
                    <dd className="shrink-0 font-semibold tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <div className="grid gap-5 sm:grid-cols-2 lg:col-span-2 lg:gap-6 lg:border-l lg:border-line lg:pl-6">
              <section className="min-w-0" aria-labelledby="lesson-status-heading">
                <h4 id="lesson-status-heading" className="text-sm font-semibold">
                  Lesson status
                </h4>
                <dl className="mt-3 grid gap-2 text-sm">
                  {[
                    ["Confirmed", data.lessons.confirmed],
                    ["Completed", data.lessons.completed],
                    ["Awaiting payment", data.lessons.pendingPayment],
                    ["Cancelled", data.lessons.cancelled],
                  ].map(([label, count]) => (
                    <div key={label} className="flex justify-between gap-3">
                      <dt className="text-secondary">{label}</dt>
                      <dd className="shrink-0 font-semibold tabular-nums">{count}</dd>
                    </div>
                  ))}
                </dl>
              </section>
              <section
                className="min-w-0 lg:border-l lg:border-line lg:pl-6"
                aria-labelledby="student-engagement-heading"
              >
                <h4 id="student-engagement-heading" className="text-sm font-semibold">
                  Student engagement
                </h4>
                <dl className="mt-3 grid gap-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-secondary">Students taught</dt>
                    <dd className="shrink-0 font-semibold tabular-nums">
                      {data.students.withCompletedLessons}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-secondary">Returning students</dt>
                    <dd className="shrink-0 font-semibold tabular-nums">
                      {data.students.returning}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-secondary">Returning student rate</dt>
                    <dd className="shrink-0 font-semibold tabular-nums">
                      {data.students.returningRate === null
                        ? "—"
                        : `${data.students.returningRate}%`}
                    </dd>
                  </div>
                </dl>
              </section>
            </div>
          </div>
        )}
      </section>
      {children}
      {!loading && !error && data && (
        <section className={panel} aria-labelledby="tutor-reviews-heading">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 id="tutor-reviews-heading" className="font-semibold">
              Recent reviews
            </h3>
            {data.reviews.count > 0 && (
              <Link
                href={`/tutors/${data.tutorId}`}
                className="text-sm font-semibold text-brand-link underline"
              >
                View public profile
              </Link>
            )}
          </div>
          {data.reviews.count === 0 ? (
            <p className="mt-4 text-sm text-muted">
              No reviews yet. Students can leave a review after you confirm their lesson is
              complete.
            </p>
          ) : (
            <ul aria-label="Recent tutor reviews" className="mt-4 divide-y divide-line">
              {data.reviews.recent.map((review) => (
                <li key={review.id} className="py-4 first:pt-0">
                  <div className="flex flex-wrap justify-between gap-2 text-sm">
                    <span className="font-semibold">{review.studentName}</span>
                    <span
                      aria-label={`${review.ratingStars} out of 5 stars`}
                      className="font-semibold text-amber-700 dark:text-amber-400"
                    >
                      ★ {review.ratingStars} / 5
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {review.subject.name} · {dateFormat.format(new Date(review.createdAt))}
                  </p>
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">
                    {review.text || "Rating only · no written comment"}
                  </p>
                  {review.text && (
                    <ReviewFlag
                      reviewId={review.id}
                      reviewer={review.studentName}
                      flagged={review.flaggedByMe}
                    />
                  )}
                  <ReviewReply reviewId={review.id} reply={review.reply} canReply />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}
