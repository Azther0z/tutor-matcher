"use client";

import Link from "next/link";
import { VerifiedIcon } from "@/src/components/verified-icon";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { SubjectBookingPanel } from "@/src/components/subject-booking-panel";
import { formatRate, Rating, ReviewList } from "@/src/components/tutor-public";
import {
  getTutorSubjectPage,
  openingDateTime,
  type ProfileSubject,
  type SubjectPage,
  type SubjectPageResult,
} from "@/src/lib/tutor-profile-api";

const card = "flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:p-5";
const shell =
  "mx-auto flex w-full max-w-[68rem] min-w-0 flex-1 flex-col gap-6 px-4 pt-6 pb-40 sm:px-6 lg:px-8";
const FORMAT_LABELS: Record<ProfileSubject["format"], string> = { ONLINE: "Online" };
const isDay = (value: string | null): value is string =>
  !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));

// DISC-4: the subject reads its day from the URL, so it renders on the client inside Suspense.
export default function TutorSubjectPage() {
  return (
    <Suspense
      fallback={
        <main id="main-content" tabIndex={-1} className={shell}>
          <p className="text-muted">Loading…</p>
        </main>
      }
    >
      <SubjectPageContent />
    </Suspense>
  );
}

function SubjectPageContent() {
  const params = useParams<{ id: string; subjectId: string }>();
  const router = useRouter();
  const requested = useSearchParams().get("date");
  const date = isDay(requested) ? requested : null;
  const [loaded, setLoaded] = useState<{
    key: string;
    result: SubjectPageResult | null;
    error: string | null;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${params.id}#${params.subjectId}#${date ?? ""}#${attempt}`;

  useEffect(() => {
    const controller = new AbortController();
    getTutorSubjectPage(params.id, params.subjectId, date ?? undefined, controller.signal)
      .then((result) => setLoaded({ key: requestKey, result, error: null }))
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setLoaded({
          key: requestKey,
          result: null,
          error: reason instanceof Error ? reason.message : "Could not load this subject.",
        });
      });
    return () => controller.abort();
  }, [params.id, params.subjectId, date, requestKey]);

  const loading = loaded?.key !== requestKey;
  // Keep the last loaded page on screen while another day loads.
  const page = loaded?.result?.kind === "subject" ? loaded.result.page : null;

  if (!loading && loaded?.error) {
    return (
      <main id="main-content" tabIndex={-1} className={shell}>
        <p role="alert" className="text-red-600 dark:text-red-400">
          {loaded.error}
        </p>
        <button
          type="button"
          onClick={() => setAttempt((count) => count + 1)}
          className="w-fit rounded-lg border border-line px-5 py-2 font-medium"
        >
          Try again
        </button>
      </main>
    );
  }
  if (!loading && loaded?.result?.kind === "unavailable") return <UnavailableSubject />;
  if (!page) {
    return (
      <main id="main-content" tabIndex={-1} className={shell}>
        <p className="text-muted">Loading…</p>
      </main>
    );
  }

  return (
    <SubjectView
      page={page}
      selected={date ?? page.date}
      onSelect={(day) =>
        router.replace(`/tutors/${params.id}/${params.subjectId}?date=${day}`, { scroll: false })
      }
    />
  );
}

// An unpublished tutor, another tutor's subject or a missing one shows this and nothing else.
function UnavailableSubject() {
  return (
    <main id="main-content" tabIndex={-1} className={shell}>
      <h1 className="text-3xl font-semibold tracking-tight">This subject is unavailable</h1>
      <p role="status" className="text-secondary">
        This subject isn’t available right now. Try another tutor or subject.
      </p>
      <Link
        href="/search"
        className="flex h-11 w-fit items-center rounded-lg bg-brand-navy px-5 font-medium text-white"
      >
        Find a tutor
      </Link>
    </main>
  );
}

function SubjectView({
  page,
  selected,
  onSelect,
}: {
  page: SubjectPage;
  selected: string;
  onSelect: (date: string) => void;
}) {
  const { tutor, subject } = page;
  const tutorName = `${tutor.firstName} ${tutor.lastName}`;

  return (
    <main id="main-content" tabIndex={-1} className={shell}>
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-2xl font-semibold leading-tight tracking-tight">{subject.name}</h1>
          <Link
            href={`/tutors/${tutor.id}`}
            className="flex items-center gap-1.5 text-sm font-semibold text-secondary hover:underline"
          >
            With {tutorName}
            {tutor.verified && <VerifiedIcon />}
          </Link>
        </div>
        <p className="text-sm text-muted">
          {FORMAT_LABELS[subject.format]}
          {subject.learningAreas.length > 0 &&
            ` · ${subject.learningAreas.map((area) => area.name).join(", ")}`}
        </p>
        {subject.description && (
          <p className="whitespace-pre-wrap text-sm leading-6 text-secondary">
            {subject.description}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p>
            <span className="text-lg font-semibold">{formatRate(subject.hourlyRate)}</span>
            <span className="text-sm text-muted"> / hr</span>
          </p>
          <Rating rating={subject.rating} count={subject.reviewCount} />
        </div>
        <p className="text-sm text-muted">
          Next opening:{" "}
          {subject.nextOpening
            ? openingDateTime(subject.nextOpening)
            : "No openings in the next three months"}
        </p>
      </header>
      <div className="flex flex-col gap-6">
        <SubjectBookingPanel page={page} date={selected} onSelect={onSelect} />
        <div>
          <section aria-labelledby="rating-breakdown-heading" className={`${card} mb-6`}>
            <h2 id="rating-breakdown-heading" className="text-xl font-semibold">
              Rating breakdown
            </h2>
            {page.reviews.length !== subject.reviewCount && (
              <p className="text-sm text-muted">Based on the reviews shown below.</p>
            )}
            <div className="flex w-full flex-col gap-3">
              {[5, 4, 3, 2, 1].map((stars) => {
                const count = page.reviews.filter((review) => review.rating === stars).length;
                return (
                  <div key={stars} className="flex items-center gap-3 text-sm text-muted">
                    <span className="w-12 shrink-0">
                      {stars} {stars === 1 ? "star" : "stars"}
                    </span>
                    <div
                      role="meter"
                      aria-label={`${stars} stars`}
                      aria-valuemin={0}
                      aria-valuemax={Math.max(page.reviews.length, 1)}
                      aria-valuenow={count}
                      className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-muted"
                    >
                      <div
                        className="h-full bg-amber-400"
                        style={{
                          width: `${page.reviews.length ? (count / page.reviews.length) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <span className="w-6 text-right tabular-nums">{count}</span>
                  </div>
                );
              })}
            </div>
          </section>
          <section aria-labelledby="reviews-heading" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="reviews-heading" className="text-xl font-semibold">
                Reviews ({subject.reviewCount})
              </h2>
              <Rating rating={subject.rating} count={subject.reviewCount} />
            </div>
            <ReviewList tutorId={page.tutor.id} reviews={page.reviews} />
          </section>
        </div>
      </div>
    </main>
  );
}
