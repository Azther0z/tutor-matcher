"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, useSyncExternalStore } from "react";
import { SubjectDateCalendar } from "@/src/components/subject-date-calendar";
import { SubjectDayCalendar } from "@/src/components/subject-day-calendar";
import { formatRate, Rating, ReviewList } from "@/src/components/tutor-public";
import { getAuthSnapshot, subscribeToAuth } from "@/src/lib/auth";
import {
  getTutorSubjectPage,
  openingDateTime,
  type ProfileSubject,
  type SubjectPage,
  type SubjectPageResult,
} from "@/src/lib/tutor-profile-api";

const card = "flex flex-col gap-4 rounded-3xl border border-black/10 p-6 dark:border-white/15";
const shell = "mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12";
const FORMAT_LABELS: Record<ProfileSubject["format"], string> = { ONLINE: "Online" };
const DAY_MS = 86_400_000;
const BANGKOK_MS = 7 * 60 * 60 * 1000;
// Students browse up to three months ahead, the same 92-day window the API serves.
const WINDOW_DAYS = 92;
const bangkokDay = (instant: number) => new Date(instant + BANGKOK_MS).toISOString().slice(0, 10);
const isDay = (value: string | null): value is string =>
  !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));

// DISC-4: the subject reads its day from the URL, so it renders on the client inside Suspense.
export default function TutorSubjectPage() {
  return (
    <Suspense
      fallback={
        <main className={shell}>
          <p className="text-zinc-500">Loading…</p>
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
      <main className={shell}>
        <p role="alert" className="text-red-600 dark:text-red-400">
          {loaded.error}
        </p>
        <button
          type="button"
          onClick={() => setAttempt((count) => count + 1)}
          className="w-fit rounded-full border border-black/15 px-5 py-2 font-medium dark:border-white/20"
        >
          Try again
        </button>
      </main>
    );
  }
  if (!loading && loaded?.result?.kind === "unavailable") return <UnavailableSubject />;
  if (!page) {
    return (
      <main className={shell}>
        <p className="text-zinc-500">Loading…</p>
      </main>
    );
  }

  return (
    <SubjectView
      page={page}
      selected={date ?? page.date}
      loading={loading}
      onSelect={(day) =>
        router.replace(`/tutors/${params.id}/${params.subjectId}?date=${day}`, { scroll: false })
      }
    />
  );
}

// An unpublished tutor, another tutor's subject or a missing one shows this and nothing else.
function UnavailableSubject() {
  return (
    <main className={shell}>
      <h1 className="text-3xl font-semibold tracking-tight">This subject is unavailable</h1>
      <p role="status" className="text-zinc-600 dark:text-zinc-400">
        This subject isn’t available right now. Try another tutor or subject.
      </p>
      <Link
        href="/search"
        className="flex h-11 w-fit items-center rounded-full bg-foreground px-5 font-medium text-background"
      >
        Find a tutor
      </Link>
    </main>
  );
}

function SubjectView({
  page,
  selected,
  loading,
  onSelect,
}: {
  page: SubjectPage;
  selected: string;
  loading: boolean;
  onSelect: (date: string) => void;
}) {
  const { tutor, subject } = page;
  const tutorName = `${tutor.firstName} ${tutor.lastName}`;
  // The browsable window is fixed when the page opens.
  const [now] = useState(() => Date.now());

  return (
    <main className={shell}>
      <Link
        href={`/tutors/${tutor.id}`}
        className="w-fit text-sm text-zinc-600 hover:underline dark:text-zinc-400"
      >
        ← Back to {tutorName}
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h1 className="text-4xl font-semibold tracking-tight">{subject.name}</h1>
          <p className="flex flex-wrap items-center gap-3 text-zinc-600 dark:text-zinc-400">
            <span>with {tutorName}</span>
            {tutor.verified && (
              <span className="rounded-full bg-green-500/10 px-3 py-1 text-sm font-medium text-green-700 dark:text-green-300">
                Verified
              </span>
            )}
            <Rating rating={subject.rating} count={subject.reviewCount} />
          </p>
        </div>
        <p>
          <span className="text-2xl font-bold">{formatRate(subject.hourlyRate)}</span>
          <span className="text-zinc-500"> / hr</span>
        </p>
      </header>

      <section aria-labelledby="subject-heading" className={card}>
        <h2 id="subject-heading" className="text-xl font-semibold">
          About this subject
        </h2>
        {subject.description ? (
          <p className="whitespace-pre-wrap text-zinc-600 dark:text-zinc-400">
            {subject.description}
          </p>
        ) : (
          <p className="text-zinc-500">This subject has no description yet.</p>
        )}
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">Format</dt>
            <dd className="font-medium">{FORMAT_LABELS[subject.format]}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Next opening</dt>
            <dd className="font-medium">
              {subject.nextOpening
                ? openingDateTime(subject.nextOpening)
                : "No openings in the next three months"}
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="availability-heading" className={card}>
        <h2 id="availability-heading" className="text-xl font-semibold">
          Availability
        </h2>
        <p className="text-sm text-zinc-500">
          Times in Asia/Bangkok (UTC+7). Days with a dot have open times.
        </p>
        <SubjectDateCalendar
          key={selected.slice(0, 7)}
          selected={selected}
          today={bangkokDay(now)}
          lastDay={bangkokDay(now + WINDOW_DAYS * DAY_MS)}
          openDates={page.openDates}
          onSelect={onSelect}
        />
        {loading ? (
          <p className="text-zinc-500">Loading availability…</p>
        ) : (
          <>
            <SubjectDayCalendar date={page.date} openSlots={page.openSlots} />
            <BookButton
              subjectId={subject.id}
              date={page.date}
              available={page.openSlots.length > 0}
            />
          </>
        )}
      </section>

      <section aria-labelledby="reviews-heading" className={card}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="reviews-heading" className="text-xl font-semibold">
            Reviews for {subject.name}
          </h2>
          <Rating rating={subject.rating} count={subject.reviewCount} />
        </div>
        <ReviewList reviews={page.reviews} />
      </section>
    </main>
  );
}

// Starts the subject-locked booking for the selected day; logged-out visitors log in first.
function BookButton({
  subjectId,
  date,
  available,
}: {
  subjectId: string;
  date: string;
  available: boolean;
}) {
  const signedIn = useSyncExternalStore(subscribeToAuth, getAuthSnapshot, () => null);
  const bookingPath = `/bookings/s/${subjectId}?date=${date}`;
  const buttonClass =
    "flex h-11 w-fit items-center rounded-full bg-foreground px-5 font-medium text-background disabled:opacity-50";

  if (!available) {
    return (
      <div className="flex flex-col gap-2">
        <button type="button" disabled aria-describedby="book-hint" className={buttonClass}>
          Book this subject
        </button>
        <p id="book-hint" className="text-sm text-zinc-500">
          No open times on this day. Pick a day marked with a dot.
        </p>
      </div>
    );
  }
  return (
    <Link
      href={signedIn === false ? `/login?next=${encodeURIComponent(bookingPath)}` : bookingPath}
      className={buttonClass}
    >
      Book this subject
    </Link>
  );
}
