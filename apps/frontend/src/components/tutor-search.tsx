"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  defaultFilters,
  filtersFromParams,
  filtersToQuery,
  getLearningAreas,
  searchTutors,
  sortOptions,
  type LearningArea,
  type TutorSearchFilters,
  type TutorSearchResponse,
  type TutorSearchResult,
} from "@/src/lib/discovery-api";

const TYPING_DELAY = 300;

const ratingOptions = [
  { value: "", label: "Any rating" },
  { value: "3", label: "3.0 and up" },
  { value: "4", label: "4.0 and up" },
  { value: "4.5", label: "4.5 and up" },
];

const formatOptions = [
  { value: "", label: "Any" },
  { value: "ONLINE", label: "Online" },
];

const field =
  "mt-1 w-full rounded-xl border border-black/15 bg-transparent px-3 py-2 outline-none focus:border-violet-500 dark:border-white/20";

export function TutorSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const filters = useMemo(() => filtersFromParams(new URLSearchParams(query)), [query]);

  const [keyword, setKeyword] = useState(filters.q);
  const [maxPrice, setMaxPrice] = useState(filters.maxPrice);
  const [syncedQ, setSyncedQ] = useState(filters.q);
  const [syncedMaxPrice, setSyncedMaxPrice] = useState(filters.maxPrice);
  const [learningAreas, setLearningAreas] = useState<LearningArea[]>([]);
  const [loaded, setLoaded] = useState<{
    key: string;
    data: TutorSearchResponse | null;
    error: string | null;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Keep the typed fields in step when the URL changes from elsewhere (back, clear filters),
  // without undoing what is still being typed.
  if (filters.q !== syncedQ) {
    setSyncedQ(filters.q);
    if (keyword.trim() !== filters.q) setKeyword(filters.q);
  }
  if (filters.maxPrice !== syncedMaxPrice) {
    setSyncedMaxPrice(filters.maxPrice);
    if (maxPrice.trim() !== filters.maxPrice) setMaxPrice(filters.maxPrice);
  }

  function apply(changes: Partial<TutorSearchFilters>) {
    // Any filter change starts again from the first page.
    const nextQuery = filtersToQuery({ ...filters, page: 1, ...changes });
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }

  useEffect(() => {
    getLearningAreas()
      .then(setLearningAreas)
      .catch(() => setLearningAreas([]));
  }, []);

  useEffect(() => {
    if (keyword.trim() === filters.q && maxPrice.trim() === filters.maxPrice) return;
    const timer = setTimeout(() => apply({ q: keyword, maxPrice: maxPrice.trim() }), TYPING_DELAY);
    return () => clearTimeout(timer);
    // apply reads the latest filters; re-running on its identity would reset the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword, maxPrice, filters.q, filters.maxPrice]);

  const requestKey = `${query}#${attempt}`;
  useEffect(() => {
    const controller = new AbortController();
    searchTutors(filters, controller.signal)
      .then((data) => setLoaded({ key: requestKey, data, error: null }))
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setLoaded({
          key: requestKey,
          data: null,
          error: reason instanceof Error ? reason.message : "Could not load tutors.",
        });
      });
    return () => controller.abort();
  }, [filters, requestKey]);

  // The previous results stay on screen until the new page arrives.
  const loading = loaded?.key !== requestKey;
  const result = loaded?.data ?? null;
  const error = loading ? null : (loaded?.error ?? null);

  const areaName = learningAreas.find(({ id }) => id === filters.learningAreaId)?.name;
  const suggestions: Array<{ label: string; changes: Partial<TutorSearchFilters> }> = [];
  if (filters.q) suggestions.push({ label: `Remove keyword "${filters.q}"`, changes: { q: "" } });
  if (filters.learningAreaId)
    suggestions.push({
      label: areaName ? `Search all areas, not just ${areaName}` : "Search all learning areas",
      changes: { learningAreaId: "" },
    });
  if (filters.maxPrice)
    suggestions.push({ label: "Remove the price limit", changes: { maxPrice: "" } });
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
          Filter by learning area, price, rating and format, then open a tutor to see more.
        </p>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[17rem_1fr]">
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
                placeholder="Name, subject or topic"
                maxLength={100}
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
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
            <div>
              <label htmlFor="search-max-price" className="text-sm font-semibold">
                Max price (฿ / hr)
              </label>
              <input
                id="search-max-price"
                type="number"
                inputMode="decimal"
                min={1}
                className={field}
                placeholder="Any price"
                value={maxPrice}
                onChange={(event) => setMaxPrice(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="search-rating" className="text-sm font-semibold">
                Minimum rating
              </label>
              <select
                id="search-rating"
                className={field}
                value={filters.minRating}
                onChange={(event) => apply({ minRating: event.target.value })}
              >
                {ratingOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-zinc-500" role="status">
              {loading
                ? "Searching…"
                : result && `${result.total} ${result.total === 1 ? "tutor" : "tutors"} found`}
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

          {result && result.tutors.length > 0 && (
            <ul className="mt-6 grid gap-4 sm:grid-cols-2">
              {result.tutors.map((tutor) => (
                <li key={tutor.id}>
                  <TutorCard tutor={tutor} />
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

function TutorCard({ tutor }: { tutor: TutorSearchResult }) {
  const name = `${tutor.firstName} ${tutor.lastName}`;
  const areas = [
    ...new Set(tutor.subjects.flatMap(({ learningAreas }) => learningAreas.map((a) => a.name))),
  ];
  return (
    <Link
      href={`/tutors/${tutor.id}`}
      aria-label={name}
      className="flex h-full flex-col gap-4 rounded-3xl border border-black/10 p-5 transition hover:-translate-y-0.5 hover:border-violet-500 hover:shadow-lg dark:border-white/15"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-lg font-bold text-violet-700 dark:bg-violet-950 dark:text-violet-300">
          {tutor.firstName.charAt(0).toUpperCase()}
          {tutor.lastName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-bold">{name}</h2>
            {tutor.verified && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                Verified
              </span>
            )}
          </div>
          <p className="text-sm text-zinc-500">
            {tutor.rating === null ? (
              "New tutor"
            ) : (
              <>
                <span className="font-semibold text-foreground">★ {tutor.rating.toFixed(1)}</span> (
                {tutor.reviewCount} {tutor.reviewCount === 1 ? "review" : "reviews"})
              </>
            )}
            {tutor.classesTaught > 0 &&
              ` · ${tutor.classesTaught} ${tutor.classesTaught === 1 ? "class" : "classes"} taught`}
          </p>
        </div>
      </div>
      {tutor.bio && (
        <p className="line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">{tutor.bio}</p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {tutor.subjects.slice(0, 3).map((subject) => (
          <span
            key={subject.id}
            className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium dark:bg-zinc-800"
          >
            {subject.name}
          </span>
        ))}
        {tutor.subjects.length > 3 && (
          <span className="px-1 py-1 text-xs text-zinc-500">+{tutor.subjects.length - 3} more</span>
        )}
      </div>
      <div className="mt-auto flex items-end justify-between gap-3 text-sm">
        <span className="text-zinc-500">{areas.join(", ")} · Online</span>
        <span className="shrink-0">
          <span className="text-zinc-500">from </span>
          <span className="text-lg font-bold">฿{tutor.fromHourlyRate}</span>
          <span className="text-zinc-500"> / hr</span>
        </span>
      </div>
    </Link>
  );
}
