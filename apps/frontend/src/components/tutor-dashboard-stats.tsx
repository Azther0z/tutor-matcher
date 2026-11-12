"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getTutorDashboard, type TutorDashboard } from "@/src/lib/dashboard-api";
import { ReviewReply } from "./review-reply";

const dateFormat = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Bangkok",
});
const panel = "rounded-2xl border border-black/[.12] p-5 dark:border-white/[.18]";

export function TutorDashboardStats() {
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
    <section aria-label="Teaching overview" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold">Teaching overview</h3>
          <p className="mt-1 text-sm text-zinc-500">
            All-time activity, except classes this week. Each lesson is one booking.
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="rounded-full border border-black/15 px-4 py-2 text-sm font-semibold disabled:opacity-50 dark:border-white/20"
        >
          Refresh overview
        </button>
      </div>
      {loading && (
        <p role="status" className="text-sm text-zinc-500">
          Loading teaching overview…
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {!loading && !error && data && (
        <>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Classes this week", data.classesThisWeek, "Mon–Sun · Bangkok time"],
              ["Completed lessons", data.lessons.completed, "Confirmed complete by you"],
              ["Students", data.students.total, "With a paid or completed lesson"],
              [
                "Average rating",
                data.reviews.averageRating === null
                  ? "Unrated"
                  : `${data.reviews.averageRating.toFixed(1)} / 5`,
                `${data.reviews.count} published ${data.reviews.count === 1 ? "review" : "reviews"}`,
              ],
            ].map(([label, value, help]) => (
              <div key={label} className={panel}>
                <dt className="text-sm text-zinc-500">{label}</dt>
                <dd className="mt-2 text-3xl font-semibold tracking-tight">{value}</dd>
                <dd className="mt-2 text-xs leading-5 text-zinc-500">{help}</dd>
              </div>
            ))}
          </dl>
          <div className="grid gap-4 sm:grid-cols-2">
            <section className={panel} aria-labelledby="lesson-status-heading">
              <h4 id="lesson-status-heading" className="font-semibold">
                Lesson status
              </h4>
              <dl className="mt-4 grid gap-3 text-sm">
                {[
                  ["Confirmed", data.lessons.confirmed],
                  ["Completed", data.lessons.completed],
                  ["Awaiting payment", data.lessons.pendingPayment],
                  ["Cancelled", data.lessons.cancelled],
                ].map(([label, count]) => (
                  <div key={label} className="flex justify-between gap-3">
                    <dt className="text-zinc-600 dark:text-zinc-400">{label}</dt>
                    <dd className="font-semibold">{count}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-xs leading-5 text-zinc-500">
                Confirmed includes ended lessons awaiting your completion confirmation.
              </p>
            </section>
            <section className={panel} aria-labelledby="student-engagement-heading">
              <h4 id="student-engagement-heading" className="font-semibold">
                Student engagement
              </h4>
              <dl className="mt-4 grid gap-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-600 dark:text-zinc-400">Students taught</dt>
                  <dd className="font-semibold">{data.students.withCompletedLessons}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-600 dark:text-zinc-400">Returning students</dt>
                  <dd className="font-semibold">{data.students.returning}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-600 dark:text-zinc-400">Returning student rate</dt>
                  <dd className="font-semibold">
                    {data.students.returningRate === null ? "—" : `${data.students.returningRate}%`}
                  </dd>
                </div>
              </dl>
              <p className="mt-4 text-xs leading-5 text-zinc-500">
                Returning students have completed at least two lessons with you. The rate is out of
                students taught.
              </p>
            </section>
          </div>
          <section className={panel} aria-labelledby="tutor-reviews-heading">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h4 id="tutor-reviews-heading" className="font-semibold">
                Recent reviews
              </h4>
              {data.reviews.count > 0 && (
                <Link
                  href={`/tutors/${data.tutorId}`}
                  className="text-sm font-semibold text-violet-700 underline dark:text-violet-300"
                >
                  View public profile
                </Link>
              )}
            </div>
            {data.reviews.count === 0 ? (
              <p className="mt-4 text-sm text-zinc-500">
                No reviews yet. Students can leave a review after you confirm their lesson is
                complete.
              </p>
            ) : (
              <ul
                aria-label="Recent tutor reviews"
                tabIndex={0}
                className="themed-scrollbar mt-4 max-h-[32rem] space-y-4 overflow-y-auto overscroll-y-contain rounded-xl pr-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-500"
              >
                {data.reviews.recent.map((review) => (
                  <li
                    key={review.id}
                    className="rounded-xl border border-black/10 p-4 dark:border-white/15"
                  >
                    <div className="flex flex-wrap justify-between gap-2 text-sm">
                      <span className="font-semibold">{review.studentName}</span>
                      <span
                        aria-label={`${review.ratingStars} out of 5 stars`}
                        className="font-semibold text-amber-700 dark:text-amber-400"
                      >
                        ★ {review.ratingStars} / 5
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">
                      {review.subject.name} · {dateFormat.format(new Date(review.createdAt))}
                    </p>
                    <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">
                      {review.text || "Rating only · no written comment"}
                    </p>
                    <ReviewReply reviewId={review.id} reply={review.reply} canReply />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </section>
  );
}
