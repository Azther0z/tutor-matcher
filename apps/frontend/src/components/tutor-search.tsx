"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useEffectEvent, useMemo, useState } from "react";
import {
  defaultFilters,
  filtersFromParams,
  filtersToQuery,
  getLearningAreas,
  getPriceRange,
  searchTutors,
  sortOptions,
  type LearningArea,
  type PriceRange,
  type SubjectSearchResult,
  type TutorSearchFilters,
  type TutorSearchResponse,
} from "@/src/lib/discovery-api";
import { getAuthToken, subscribeToAuth } from "@/src/lib/auth";

const TYPING_DELAY = 300;

const formatOptions = [
  { value: "", label: "Any" },
  { value: "ONLINE", label: "Online" },
];

const field =
  "mt-1 w-full rounded-xl border border-black/15 bg-transparent px-3 py-2 outline-none focus:border-violet-500 dark:border-white/20";

const thumb =
  "pointer-events-none absolute inset-0 h-6 w-full appearance-none bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-violet-600 [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-600";

// Fields that are typed or dragged wait for a pause before they search.
type Draft = Pick<TutorSearchFilters, "q" | "tutorName" | "minPrice" | "maxPrice">;
const draftKeys = ["q", "tutorName", "minPrice", "maxPrice"] as const;
const draftOf = (filters: TutorSearchFilters): Draft => ({
  q: filters.q,
  tutorName: filters.tutorName,
  minPrice: filters.minPrice,
  maxPrice: filters.maxPrice,
});

// Round the real price range outward, to hundreds or to thousands once prices pass ฿10,000.
function sliderBounds(range: PriceRange) {
  if (!range) return null;
  const max = Number(range.max);
  const unit = max >= 10_000 ? 1000 : 100;
  const low = Math.floor(Number(range.min) / unit) * unit;
  const high = Math.max(Math.ceil(max / unit) * unit, low + unit);
  return { low, high, step: unit / 10 };
}

const baht = (amount: number) => `฿${amount.toLocaleString("en-US")}`;

export function TutorSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const filters = useMemo(() => filtersFromParams(new URLSearchParams(query)), [query]);

  const [draft, setDraft] = useState<Draft>(() => draftOf(filters));
  const [syncedDraft, setSyncedDraft] = useState<Draft>(() => draftOf(filters));
  const [learningAreas, setLearningAreas] = useState<LearningArea[]>([]);
  const [loaded, setLoaded] = useState<{
    key: string;
    data: TutorSearchResponse | null;
    error: string | null;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [bounds, setBounds] = useState<ReturnType<typeof sliderBounds>>(null);
  const [authRevision, setAuthRevision] = useState(0);

  // Keep the typed fields in step when the URL changes from elsewhere (back, clear filters),
  // without undoing what is still being typed.
  const fromUrl = draftOf(filters);
  if (draftKeys.some((key) => fromUrl[key] !== syncedDraft[key])) {
    setSyncedDraft(fromUrl);
    const next = { ...draft };
    for (const key of draftKeys) {
      if (fromUrl[key] !== syncedDraft[key] && draft[key].trim() !== fromUrl[key]) {
        next[key] = fromUrl[key];
      }
    }
    setDraft(next);
  }

  function apply(changes: Partial<TutorSearchFilters>) {
    // Any filter change starts again from the first page.
    const nextQuery = filtersToQuery({ ...filters, page: 1, ...changes });
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }

  useEffect(
    () =>
      subscribeToAuth(() => {
        setLoaded(null);
        setAuthRevision((revision) => revision + 1);
        if (filters.page > 1) {
          const nextQuery = filtersToQuery({ ...filters, page: 1 });
          router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
        }
      }),
    [filters, pathname, router]
  );

  useEffect(() => {
    getLearningAreas()
      .then(setLearningAreas)
      .catch(() => setLearningAreas([]));
    // Without a range the slider just stays hidden.
    getPriceRange()
      .then((range) => setBounds(sliderBounds(range)))
      .catch(() => setBounds(null));
  }, []);

  // Runs with the filters current when the timer fires, so a filter picked while typing stays.
  const applyDraft = useEffectEvent(() => apply(draft));

  useEffect(() => {
    if (draftKeys.every((key) => draft[key].trim() === filters[key])) return;
    const timer = setTimeout(applyDraft, TYPING_DELAY);
    return () => clearTimeout(timer);
  }, [draft, filters]);

  const requestKey = `${query}#${attempt}#${authRevision}`;
  useEffect(() => {
    const controller = new AbortController();
    searchTutors(filters, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setLoaded({ key: requestKey, data, error: null });
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted || (reason instanceof Error && reason.name === "AuthError"))
          return;
        setLoaded({
          key: requestKey,
          data: null,
          error: reason instanceof Error ? reason.message : "Could not load tutors.",
        });
      });
    return () => controller.abort();
  }, [filters, requestKey, authRevision]);

  // The previous results stay on screen until the new page arrives.
  const loading = loaded?.key !== requestKey;
  const result = loaded?.data ?? null;
  const error = loading ? null : (loaded?.error ?? null);

  // A page past the end (an old link, or fewer results now) goes to the last page instead.
  const goToPage = useEffectEvent((page: number) => apply({ page }));
  const lastPage = !loading && result && result.total > 0 ? result.totalPages : null;
  useEffect(() => {
    if (lastPage !== null && filters.page > lastPage) goToPage(lastPage);
  }, [lastPage, filters.page]);

  const lowPrice = bounds ? Number(draft.minPrice || bounds.low) : 0;
  const highPrice = bounds ? Number(draft.maxPrice || bounds.high) : 0;
  function setPrice(low: number, high: number) {
    if (!bounds) return;
    // At either end of the slider the price is not limited on that side.
    setDraft({
      ...draft,
      minPrice: low > bounds.low ? String(low) : "",
      maxPrice: high < bounds.high ? String(high) : "",
    });
  }
  const percent = (value: number) =>
    bounds ? ((value - bounds.low) / (bounds.high - bounds.low)) * 100 : 0;

  const areaName = learningAreas.find(({ id }) => id === filters.learningAreaId)?.name;
  const suggestions: Array<{ label: string; changes: Partial<TutorSearchFilters> }> = [];
  if (filters.q) suggestions.push({ label: `Remove keyword "${filters.q}"`, changes: { q: "" } });
  if (filters.tutorName)
    suggestions.push({
      label: `Any tutor, not just "${filters.tutorName}"`,
      changes: { tutorName: "" },
    });
  if (filters.learningAreaId)
    suggestions.push({
      label: areaName ? `Search all areas, not just ${areaName}` : "Search all learning areas",
      changes: { learningAreaId: "" },
    });
  if (filters.minPrice || filters.maxPrice)
    suggestions.push({
      label: "Remove the price range",
      changes: { minPrice: "", maxPrice: "" },
    });
  if (filters.minRating) suggestions.push({ label: "Any rating", changes: { minRating: "" } });
  if (filters.format) suggestions.push({ label: "Any format", changes: { format: "" } });

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 lg:px-10 lg:py-14">
      <header className="border-b border-black/10 pb-6 dark:border-white/15">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-500">
          Tutor search
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">Find a tutor</h1>
        <p className="mt-2 text-zinc-500">
          Filter by subject, tutor, price, rating and format, then open a tutor to see more.
        </p>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[18rem_1fr]">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <form
            role="search"
            aria-label="Tutor filters"
            onSubmit={(event) => event.preventDefault()}
            className="space-y-5 rounded-3xl border border-black/10 p-5 dark:border-white/15"
          >
            <div>
              <label htmlFor="search-keyword" className="text-sm font-semibold">
                Keyword
              </label>
              <input
                id="search-keyword"
                type="search"
                className={field}
                placeholder="Subject or topic"
                maxLength={100}
                value={draft.q}
                onChange={(event) => setDraft({ ...draft, q: event.target.value })}
              />
            </div>
            <div>
              <label htmlFor="search-tutor-name" className="text-sm font-semibold">
                Tutor name
              </label>
              <input
                id="search-tutor-name"
                type="search"
                className={field}
                placeholder="First or last name"
                maxLength={100}
                value={draft.tutorName}
                onChange={(event) => setDraft({ ...draft, tutorName: event.target.value })}
              />
            </div>
            <div>
              <label htmlFor="search-area" className="text-sm font-semibold">
                Learning area
              </label>
              <select
                id="search-area"
                className={field}
                value={filters.learningAreaId}
                onChange={(event) => apply({ learningAreaId: event.target.value })}
              >
                <option value="">All learning areas</option>
                {learningAreas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </select>
            </div>
            {bounds && (
              <fieldset>
                <legend className="text-sm font-semibold">Price (฿ / hr)</legend>
                <p className="mt-1 text-sm text-zinc-500" aria-live="polite">
                  {baht(lowPrice)} to {baht(highPrice)} / hr
                </p>
                <div className="relative mt-2 h-6">
                  <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-black/10 dark:bg-white/15" />
                  <div
                    className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-violet-600"
                    style={{ left: `${percent(lowPrice)}%`, right: `${100 - percent(highPrice)}%` }}
                  />
                  <input
                    type="range"
                    aria-label="Minimum price"
                    className={thumb}
                    min={bounds.low}
                    max={bounds.high}
                    step={bounds.step}
                    value={lowPrice}
                    onChange={(event) =>
                      setPrice(Math.min(Number(event.target.value), highPrice), highPrice)
                    }
                  />
                  <input
                    type="range"
                    aria-label="Maximum price"
                    className={thumb}
                    min={bounds.low}
                    max={bounds.high}
                    step={bounds.step}
                    value={highPrice}
                    onChange={(event) =>
                      setPrice(lowPrice, Math.max(Number(event.target.value), lowPrice))
                    }
                  />
                </div>
              </fieldset>
            )}
            <fieldset>
              <legend className="text-sm font-semibold">Minimum rating</legend>
              <RatingStars
                value={Number(filters.minRating) || 0}
                onChange={(value) => apply({ minRating: value ? String(value) : "" })}
              />
            </fieldset>
            <fieldset>
              <legend className="text-sm font-semibold">Format</legend>
              <div className="mt-1 flex gap-2">
                {formatOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={filters.format === option.value}
                    onClick={() => apply({ format: option.value })}
                    className={`flex-1 rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                      filters.format === option.value
                        ? "border-violet-600 bg-violet-600 text-white"
                        : "border-black/15 hover:border-violet-500 dark:border-white/20"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>
            <button
              type="button"
              onClick={() => apply({ ...defaultFilters, sort: filters.sort })}
              className="w-full rounded-full border border-black/15 px-4 py-2 text-sm font-semibold transition hover:border-violet-500 dark:border-white/20"
            >
              Clear filters
            </button>
          </form>
        </aside>

        <section aria-label="Search results" aria-busy={loading}>
          {filters.sort === "recommended" && !loading && result && (
            <div className="mb-4 rounded-2xl bg-violet-50 p-4 text-sm dark:bg-violet-950/30">
              <p className="font-semibold">
                {result.recommendationMode === "personalized"
                  ? "Recommended for you"
                  : "Recommended tutors"}
              </p>
              {result.recommendationMode === "fallback" && getAuthToken() && (
                <p className="mt-1 text-zinc-600 dark:text-zinc-300">
                  <Link className="font-semibold underline" href="/settings/student">
                    Add learning areas to your profile
                  </Link>{" "}
                  for recommendations tailored to you.
                </p>
              )}
              {result.recommendationMode === "fallback" && !getAuthToken() && (
                <p className="mt-1 text-zinc-600 dark:text-zinc-300">
                  Ranked by rating and upcoming availability.{" "}
                  <Link className="font-semibold underline" href="/login">
                    Log in
                  </Link>{" "}
                  to get recommendations based on your learning areas.
                </p>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-zinc-500" role="status">
              {loading
                ? "Searching…"
                : result && `${result.total} ${result.total === 1 ? "subject" : "subjects"} found`}
            </p>
            <label className="flex items-center gap-2 text-sm text-zinc-500">
              Sort
              <select
                className="rounded-xl border border-black/15 bg-transparent px-3 py-1.5 text-foreground dark:border-white/20"
                value={filters.sort}
                onChange={(event) =>
                  apply({ sort: event.target.value as TutorSearchFilters["sort"] })
                }
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-6 rounded-2xl bg-red-50 p-5 text-red-700 dark:bg-red-950/30"
            >
              <p>{error}</p>
              <button
                type="button"
                className="mt-3 font-semibold underline"
                onClick={() => setAttempt((count) => count + 1)}
              >
                Try again
              </button>
            </div>
          )}

          {!error && result && result.total === 0 && !loading && (
            <section className="mt-6 rounded-3xl border border-dashed border-black/25 px-6 py-12 text-center dark:border-white/25">
              <h2 className="text-xl font-semibold">No tutors match these filters</h2>
              {suggestions.length > 0 ? (
                <>
                  <p className="mt-2 text-zinc-500">Try broadening your search:</p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion.label}
                        type="button"
                        onClick={() => apply(suggestion.changes)}
                        className="rounded-full border border-black/15 px-4 py-1.5 text-sm font-semibold transition hover:border-violet-500 dark:border-white/20"
                      >
                        {suggestion.label}
                      </button>
                    ))}
                    {suggestions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => apply({ ...defaultFilters, sort: filters.sort })}
                        className="rounded-full bg-violet-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-violet-500"
                      >
                        Clear all filters
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <p className="mt-2 text-zinc-500">No tutors are listed yet. Check back soon.</p>
              )}
            </section>
          )}

          {result && result.results.length > 0 && (
            <ul className="mt-6 grid gap-4 sm:grid-cols-2">
              {result.results.map((subject) => (
                <li key={subject.id}>
                  <SubjectCard subject={subject} />
                </li>
              ))}
            </ul>
          )}

          {result && result.totalPages > 1 && (
            <nav aria-label="Pages" className="mt-8 flex items-center justify-center gap-4">
              <button
                type="button"
                disabled={filters.page <= 1}
                onClick={() => apply({ page: filters.page - 1 })}
                className="rounded-full border border-black/15 px-4 py-2 text-sm font-semibold disabled:opacity-40 dark:border-white/20"
              >
                Previous
              </button>
              <span className="text-sm text-zinc-500">
                Page {filters.page} of {result.totalPages}
              </span>
              <button
                type="button"
                disabled={filters.page >= result.totalPages}
                onClick={() => apply({ page: filters.page + 1 })}
                className="rounded-full border border-black/15 px-4 py-2 text-sm font-semibold disabled:opacity-40 dark:border-white/20"
              >
                Next
              </button>
            </nav>
          )}
        </section>
      </div>
    </main>
  );
}

// Five stars in half steps; picking the selected value again clears the filter.
function RatingStars({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="mt-1">
      <div className="flex">
        {[1, 2, 3, 4, 5].map((star) => {
          const fill = Math.min(Math.max(value - (star - 1), 0), 1);
          return (
            // Each star gets an equal share of the row, and its two half-star buttons fill that
            // share, so the buttons cover the whole row in ten even parts.
            <span key={star} className="relative flex h-7 flex-1 justify-center">
              <span aria-hidden className="relative h-7 w-7 text-[28px] leading-7">
                <span className="text-zinc-300 dark:text-zinc-700">★</span>
                <span
                  className="absolute inset-y-0 left-0 overflow-hidden text-amber-400"
                  style={{ width: `${fill * 100}%` }}
                >
                  ★
                </span>
              </span>
              {[star - 0.5, star].map((stars, half) => (
                <button
                  key={stars}
                  type="button"
                  aria-label={`${stars} stars and up`}
                  aria-pressed={value === stars}
                  onClick={() => onChange(value === stars ? 0 : stars)}
                  className={`absolute inset-y-0 w-1/2 cursor-pointer ${half ? "right-0" : "left-0"}`}
                />
              ))}
            </span>
          );
        })}
      </div>
      <p className="mt-1 text-sm text-zinc-500">
        {value ? `${value.toFixed(1)} and up` : "Any rating"}
      </p>
    </div>
  );
}

function SubjectCard({ subject }: { subject: SubjectSearchResult }) {
  const tutorName = `${subject.tutor.firstName} ${subject.tutor.lastName}`;
  return (
    <Link
      href={`/tutors/${subject.tutor.id}`}
      aria-label={`${subject.name} with ${tutorName}`}
      className="flex h-full flex-col gap-3 rounded-3xl border border-black/10 p-5 transition hover:-translate-y-0.5 hover:border-violet-500 hover:shadow-lg dark:border-white/15"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-lg font-bold text-violet-700 dark:bg-violet-950 dark:text-violet-300">
          {subject.tutor.firstName.charAt(0).toUpperCase()}
          {subject.tutor.lastName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-bold">{subject.name}</h2>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="truncate">{tutorName}</span>
            {subject.tutor.verified && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                Verified
              </span>
            )}
          </div>
        </div>
      </div>
      <p className="text-sm text-zinc-500">
        {subject.rating === null ? (
          "New subject"
        ) : (
          <>
            <span className="font-semibold text-foreground">★ {subject.rating.toFixed(1)}</span> (
            {subject.reviewCount} {subject.reviewCount === 1 ? "review" : "reviews"})
          </>
        )}
        {subject.classesTaught > 0 &&
          ` · ${subject.classesTaught} ${subject.classesTaught === 1 ? "class" : "classes"} taught`}
      </p>
      <p className="text-sm text-zinc-500">
        {subject.nextAvailableAt
          ? `Next available ${new Intl.DateTimeFormat("en", {
              timeZone: "Asia/Bangkok",
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(subject.nextAvailableAt))} (Bangkok time)`
          : "No availability in the next 30 days"}
      </p>
      {subject.description && (
        <p className="line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
          {subject.description}
        </p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {subject.learningAreas.map((area) => (
          <span
            key={area.id}
            className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium dark:bg-zinc-800"
          >
            {area.name}
          </span>
        ))}
      </div>
      <div className="mt-auto flex items-end justify-between gap-3 text-sm">
        <span className="text-zinc-500">Online</span>
        <span className="shrink-0">
          <span className="text-lg font-bold">฿{subject.hourlyRate}</span>
          <span className="text-zinc-500"> / hr</span>
        </span>
      </div>
    </Link>
  );
}
