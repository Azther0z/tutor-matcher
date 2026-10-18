"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getAuthSnapshot, getAuthToken, subscribeToAuth } from "@/src/lib/auth";
import {
  getTutorProfile,
  groupOpeningsByDay,
  openingDateTime,
  openingTime,
  videoSource,
  type ProfileResult,
  type ProfileReview,
  type ProfileSubject,
  type TutorProfile,
} from "@/src/lib/tutor-profile-api";

const card = "flex flex-col gap-4 rounded-3xl border border-black/10 p-6 dark:border-white/15";
const shell = "mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12";
const rateFormat = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const formatRate = (rate: string | number) => `฿${rateFormat.format(Number(rate))}`;

export default function TutorDetailPage() {
  const params = useParams<{ id: string }>();
  const [loaded, setLoaded] = useState<{
    key: string;
    result: ProfileResult | null;
    error: string | null;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${params.id}#${attempt}`;

  useEffect(() => {
    const controller = new AbortController();
    getTutorProfile(params.id, controller.signal)
      .then((result) => setLoaded({ key: requestKey, result, error: null }))
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setLoaded({
          key: requestKey,
          result: null,
          error: reason instanceof Error ? reason.message : "Could not load this tutor's profile.",
        });
      });
    return () => controller.abort();
  }, [params.id, requestKey]);

  if (loaded?.key !== requestKey) {
    return (
      <main className={shell}>
        <p className="text-zinc-500">Loading…</p>
      </main>
    );
  }

  if (loaded.error) {
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

  if (loaded.result?.kind !== "profile") return <UnavailableProfile />;
  return <ProfileView profile={loaded.result.profile} />;
}

// DISC-3: an unpublished or missing tutor shows this and nothing else about them.
function UnavailableProfile() {
  return (
    <main className={shell}>
      <h1 className="text-3xl font-semibold tracking-tight">This tutor profile is unavailable</h1>
      <p role="status" className="text-zinc-600 dark:text-zinc-400">
        This tutor isn’t available right now. Try another tutor.
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

function Stars({ rating }: { rating: number }) {
  const stars = Number.isFinite(rating) ? Math.max(0, Math.min(5, Math.round(rating))) : 0;
  return (
    <span role="img" aria-label={`${stars} out of 5 stars`} className="text-amber-400">
      {"★".repeat(stars)}
      <span className="text-zinc-300 dark:text-zinc-700">{"★".repeat(5 - stars)}</span>
    </span>
  );
}

function Rating({ rating, count }: { rating: number | null; count: number }) {
  if (rating === null) return <span className="text-sm text-zinc-500">No reviews yet</span>;
  return (
    <span className="text-sm text-zinc-500">
      <span className="font-semibold text-foreground">★ {rating.toFixed(1)}</span> ({count}{" "}
      {count === 1 ? "review" : "reviews"})
    </span>
  );
}

function ProfileView({ profile }: { profile: TutorProfile }) {
  const fullName = `${profile.firstName} ${profile.lastName}`;
  const lowestRate = profile.subjects.length
    ? Math.min(...profile.subjects.map((subject) => Number(subject.hourlyRate)))
    : null;

  return (
    <main className={shell}>
      <header className="flex flex-wrap items-center gap-4">
        {profile.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatarUrl}
            alt={`${fullName} profile photo`}
            className="h-20 w-20 rounded-3xl object-cover"
          />
        ) : (
          <div
            aria-hidden
            className="flex h-20 w-20 items-center justify-center rounded-3xl bg-violet-100 text-2xl font-bold text-violet-700 dark:bg-violet-950 dark:text-violet-300"
          >
            {profile.firstName.charAt(0).toUpperCase()}
            {profile.lastName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="text-4xl font-semibold tracking-tight">{fullName}</h1>
          <div className="flex flex-wrap items-center gap-3">
            {profile.verified && (
              <span className="rounded-full bg-green-500/10 px-3 py-1 text-sm font-medium text-green-700 dark:text-green-300">
                Verified
              </span>
            )}
            <Rating rating={profile.rating} count={profile.reviewCount} />
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {lowestRate !== null && (
            <p>
              <span className="text-sm text-zinc-500">From </span>
              <span className="text-2xl font-bold">{formatRate(lowestRate)}</span>
              <span className="text-zinc-500"> / hr</span>
            </p>
          )}
          {profile.subjects.length > 0 && (
            <a
              href="#subjects"
              className="flex h-11 items-center rounded-full bg-foreground px-5 font-medium text-background"
            >
              Choose a subject
            </a>
          )}
        </div>
      </header>

      <AboutSection profile={profile} />
      <SubjectsSection tutorId={profile.id} subjects={profile.subjects} />
      <AvailabilitySection profile={profile} />
      <ReviewsSection
        reviews={profile.reviews}
        rating={profile.rating}
        count={profile.reviewCount}
      />
      <MessageSection profile={profile} />
    </main>
  );
}

function AboutSection({ profile }: { profile: TutorProfile }) {
  const video = videoSource(profile.introVideoUrl);
  return (
    <section aria-labelledby="about-heading" className={card}>
      <h2 id="about-heading" className="text-xl font-semibold">
        About {profile.firstName}
      </h2>
      {profile.bio ? (
        <p className="whitespace-pre-wrap text-zinc-600 dark:text-zinc-400">{profile.bio}</p>
      ) : (
        <p className="text-zinc-500">This tutor hasn’t added a bio yet.</p>
      )}
      {video?.kind === "embed" && (
        <iframe
          loading="lazy"
          sandbox="allow-scripts allow-same-origin allow-presentation"
          referrerPolicy="strict-origin-when-cross-origin"
          src={video.src}
          title={`${profile.firstName}’s introduction video`}
          allow="encrypted-media; picture-in-picture"
          allowFullScreen
          className="aspect-video w-full rounded-2xl border-0"
        />
      )}
      {video?.kind === "file" && (
        <video
          controls
          preload="none"
          aria-label={`${profile.firstName}’s introduction video`}
          src={video.src}
          className="aspect-video w-full rounded-2xl bg-black"
        />
      )}
      {video?.kind === "link" && (
        <a className="underline" href={video.src} target="_blank" rel="noopener noreferrer">
          Watch introduction video
        </a>
      )}
    </section>
  );
}

function SubjectsSection({ tutorId, subjects }: { tutorId: string; subjects: ProfileSubject[] }) {
  return (
    <section id="subjects" aria-labelledby="subjects-heading" className={card}>
      <h2 id="subjects-heading" className="text-xl font-semibold">
        Subjects and rates
      </h2>
      {subjects.length === 0 ? (
        <p className="text-zinc-500">This tutor hasn’t listed any subjects yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {subjects.map((subject) => (
            <li key={subject.id}>
              <Link
                href={`/tutors/${tutorId}/${subject.id}`}
                className="flex flex-col gap-2 rounded-2xl border border-black/10 p-4 transition hover:border-violet-500 dark:border-white/15"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="text-lg font-bold">{subject.name}</span>
                  <span className="shrink-0">
                    <span className="text-lg font-bold">{formatRate(subject.hourlyRate)}</span>
                    <span className="text-zinc-500"> / hr</span>
                  </span>
                </span>
                {subject.description && (
                  <span className="line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                    {subject.description}
                  </span>
                )}
                <span className="flex flex-wrap gap-x-4 text-sm text-zinc-500">
                  <Rating rating={subject.rating} count={subject.reviewCount} />
                  <span>
                    {subject.nextOpening
                      ? `Next opening ${openingDateTime(subject.nextOpening)}`
                      : "No openings right now"}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AvailabilitySection({ profile }: { profile: TutorProfile }) {
  const days = groupOpeningsByDay(profile.availability);
  const names = new Map(profile.subjects.map((subject) => [subject.id, subject.name]));
  return (
    <section aria-labelledby="availability-heading" className={card}>
      <h2 id="availability-heading" className="text-xl font-semibold">
        Availability
      </h2>
      <p className="text-sm text-zinc-500">
        Open 30-minute slots over the next two weeks (Bangkok time).
      </p>
      {days.length === 0 ? (
        <p className="text-zinc-600 dark:text-zinc-400">
          No open slots in the next two weeks. Check back soon.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {days.map(({ day, slots }) => (
            <li key={day} className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
              <span className="w-28 shrink-0 font-medium">{day}</span>
              <ul className="flex flex-wrap gap-2">
                {slots.map((slot) => (
                  <li
                    key={slot.startedAt}
                    className="rounded-full bg-violet-100 px-3 py-1 text-sm font-medium text-violet-800 dark:bg-violet-950 dark:text-violet-200"
                  >
                    <span>{openingTime(slot.startedAt)}</span>{" "}
                    <span>
                      {slot.subjectIds
                        .map((id) => names.get(id))
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ReviewsSection({
  reviews,
  rating,
  count,
}: {
  reviews: ProfileReview[];
  rating: number | null;
  count: number;
}) {
  return (
    <section aria-labelledby="reviews-heading" className={card}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="reviews-heading" className="text-xl font-semibold">
          Reviews
        </h2>
        <Rating rating={rating} count={count} />
      </div>
      {reviews.length === 0 ? (
        <p className="text-zinc-500">No reviews yet.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {reviews.map((review) => (
            <li
              key={review.id}
              className="flex flex-col gap-1 border-t border-black/10 pt-4 first:border-0 first:pt-0 dark:border-white/15"
            >
              <p className="flex flex-wrap items-center gap-2 text-sm">
                <Stars rating={review.rating} />
                <span className="font-medium">{review.reviewer}</span>
                <span className="text-zinc-500">
                  · {review.subjectName} ·{" "}
                  {new Date(review.createdAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    timeZone: "Asia/Bangkok",
                  })}
                </span>
              </p>
              {review.text && <p className="text-zinc-600 dark:text-zinc-400">{review.text}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function MessageSection({ profile }: { profile: TutorProfile }) {
  const router = useRouter();
  const signedIn = useSyncExternalStore(subscribeToAuth, getAuthSnapshot, () => null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const [sendError, setSendError] = useState<string | null>(null);

  async function handleSend() {
    if (sending || sendingRef.current || !draft.trim()) return;
    const token = getAuthToken();
    if (!token) return;

    sendingRef.current = true;
    setSending(true);
    setSendError(null);

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ toUserId: profile.userId, message: draft.trim() }),
      });

      const data = (await res.json().catch(() => null)) as { message?: string } | null;

      if (!res.ok) {
        setSendError(data?.message ?? "Could not send your message. Please try again.");
        return;
      }

      const name = encodeURIComponent(`${profile.firstName} ${profile.lastName}`);
      router.push(`/messages?with=${profile.userId}&name=${name}`);
    } catch {
      setSendError("Could not reach the server. Please try again.");
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  if (signedIn === null) return null;

  return (
    <section className={card}>
      <h2 className="text-xl font-semibold">Message {profile.firstName}</h2>
      {signedIn ? (
        <>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                handleSend();
              }
            }}
            placeholder={`Ask ${profile.firstName} a question before booking…`}
            rows={4}
            className="h-28 resize-none overflow-y-auto rounded-lg border border-black/[.12] bg-transparent px-3 py-2.5 text-base outline-none focus:border-foreground dark:border-white/[.18]"
          />
          {sendError && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {sendError}
            </p>
          )}
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !draft.trim()}
            className="flex h-11 w-fit items-center justify-center rounded-full bg-foreground px-5 font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-60 dark:hover:bg-[#ccc]"
          >
            {sending ? "Sending…" : `Message ${profile.firstName}`}
          </button>
        </>
      ) : (
        <p className="text-zinc-600 dark:text-zinc-400">
          <Link
            className="underline"
            href={`/login?next=${encodeURIComponent(`/tutors/${profile.id}`)}`}
          >
            Log in
          </Link>{" "}
          to message {profile.firstName} before booking.
        </p>
      )}
    </section>
  );
}
