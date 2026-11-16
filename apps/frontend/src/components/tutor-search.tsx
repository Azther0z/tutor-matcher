"use client";

import Link from "next/link";
import { VerifiedIcon } from "@/src/components/verified-icon";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useEffectEvent, useMemo, useState, useSyncExternalStore } from "react";
import {
  defaultFilters,
  filtersFromParams,
  filtersToQuery,
  getLearningAreas,
  searchTutors,
  sortOptions,
  type LearningArea,
  type SubjectSearchResult,
  type TutorSearchFilters,
  type TutorSearchResponse,
} from "@/src/lib/discovery-api";
import { getAuthSnapshot, getAuthServerSnapshot, subscribeToAuth } from "@/src/lib/auth";

const TYPING_DELAY = 300;
const PRICE_SLIDER_MIN = 0;
const PRICE_SLIDER_MAX = 3000;
const PRICE_SLIDER_STEP = 50;

const formatOptions = [
  { value: "", label: "Any" },
  { value: "ONLINE", label: "Online" },
];

const field =
  "mt-1 w-full rounded-xl border border-line bg-transparent px-3 py-2 focus-visible:outline-2 focus-visible:outline-brand-link focus:border-brand-navy";

const thumb =
  "pointer-events-none absolute inset-0 h-6 w-full appearance-none bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-brand-navy [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand-navy";

// Fields that are typed or dragged wait for a pause before they search.
type Draft = Pick<TutorSearchFilters, "q" | "tutorName" | "minPrice" | "maxPrice">;
const draftKeys = ["q", "tutorName", "minPrice", "maxPrice"] as const;
const draftOf = (filters: TutorSearchFilters): Draft => ({
  q: filters.q,
  tutorName: filters.tutorName,
  minPrice: filters.minPrice,
  maxPrice: filters.maxPrice,
});

const baht = (amount: number) => `฿${amount.toLocaleString("en-US")}`;

export function TutorSearchLoadingState() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8"
    >
      <div className="grid gap-5 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="min-w-0 lg:self-start">
          <div
            aria-hidden="true"
            className="space-y-4 rounded-2xl border border-line bg-surface p-4"
          >
            {[0, 1, 2].map((fieldIndex) => (
              <div key={fieldIndex} className="space-y-2">
                <span className="block h-4 w-24 rounded bg-surface-muted" />
                <span className="block h-11 rounded-xl border border-line bg-surface-muted/50" />
              </div>
            ))}
            <div className="space-y-3">
              <span className="block h-4 w-36 rounded bg-surface-muted" />
              <span className="block h-6 rounded bg-surface-muted" />
              <div className="grid grid-cols-2 gap-3">
                <span className="h-11 rounded-xl border border-line bg-surface-muted/50" />
                <span className="h-11 rounded-xl border border-line bg-surface-muted/50" />
              </div>
            </div>
            <span className="block h-16 rounded bg-surface-muted/50" />
            <span className="block h-11 rounded-xl border border-line bg-surface-muted/50" />
          </div>
        </aside>
        <section aria-label="Search results" aria-busy="true">
          <h1 className="mb-4 text-2xl font-semibold leading-tight tracking-tight">Find a tutor</h1>
          <div aria-hidden="true" className="mb-4 min-h-20 rounded bg-surface-muted/50" />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted" role="status">
              Searching…
            </p>
            <div aria-hidden="true" className="flex items-center gap-2">
              <span className="h-4 w-10 rounded bg-surface-muted" />
              <span className="h-10 w-36 rounded-xl border border-line bg-surface-muted/50" />
            </div>
          </div>
          <SearchResultsSkeleton />
        </section>
      </div>
    </main>
  );
}

export function TutorSearch() {
  const isAuthenticated = useSyncExternalStore(
    subscribeToAuth,
    getAuthSnapshot,
    getAuthServerSnapshot
  );
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
  const [filtersOpen, setFiltersOpen] = useState(false);
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
    const isPageChange = changes.page !== undefined && Object.keys(changes).length === 1;
    const asOf = isPageChange ? (filters.asOf ?? loaded?.data?.asOf) : undefined;
    const nextQuery = filtersToQuery({ ...filters, page: 1, ...changes, asOf });
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }

  useEffect(
    () =>
      subscribeToAuth(() => {
        setLoaded(null);
        setAuthRevision((revision) => revision + 1);
        if (filters.page > 1 || filters.asOf) {
          const nextQuery = filtersToQuery({ ...filters, page: 1, asOf: undefined });
          router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
        }
      }),
    [filters, pathname, router]
  );

  useEffect(() => {
    getLearningAreas()
      .then(setLearningAreas)
      .catch(() => setLearningAreas([]));
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

  const toSliderPrice = (value: string, fallback: number) =>
    Math.max(
      PRICE_SLIDER_MIN,
      Math.min(
        PRICE_SLIDER_MAX,
        value.trim() === "" || !Number.isFinite(Number(value)) ? fallback : Number(value)
      )
    );
  const minSliderPrice = toSliderPrice(draft.minPrice, PRICE_SLIDER_MIN);
  const maxSliderPrice = toSliderPrice(draft.maxPrice, PRICE_SLIDER_MAX);
  const lowPrice = Math.min(minSliderPrice, maxSliderPrice);
  const highPrice = Math.max(minSliderPrice, maxSliderPrice);
  function setPrice(low: number, high: number) {
    // The endpoints mean no limit on that side. Values above ฿3,000 stay editable below.
    setDraft({
      ...draft,
      minPrice: low > PRICE_SLIDER_MIN ? String(low) : "",
      maxPrice: high < PRICE_SLIDER_MAX ? String(high) : "",
    });
  }
  const percent = (value: number) =>
    ((value - PRICE_SLIDER_MIN) / (PRICE_SLIDER_MAX - PRICE_SLIDER_MIN)) * 100;

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
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8"
    >
      <div className="grid gap-5 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="min-w-0 lg:self-start">
          <button
            type="button"
            aria-expanded={filtersOpen}
            aria-controls="search-filters"
            onClick={() => setFiltersOpen((open) => !open)}
            className="ui-button-secondary mb-3 w-full justify-between lg:hidden"
          >
            {filtersOpen ? "Hide filters" : "Show filters"}
            {suggestions.length > 0 ? ` (${suggestions.length})` : ""}
            <span aria-hidden="true">{filtersOpen ? "−" : "+"}</span>
          </button>
          <div id="search-filters" className={`${filtersOpen ? "block" : "hidden"} lg:block`}>
            <form
              role="search"
              aria-label="Tutor filters"
              onSubmit={(event) => event.preventDefault()}
              className="space-y-4 rounded-2xl border border-line bg-surface p-4"
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
              <fieldset>
                <legend className="text-sm font-semibold">Minimum rating</legend>
                <RatingStars
                  value={Number(filters.minRating) || 0}
                  onChange={(value) => apply({ minRating: value ? String(value) : "" })}
                />
              </fieldset>
              <fieldset>
                <legend className="text-sm font-semibold">Price per hour (THB)</legend>
                <p className="sr-only" aria-live="polite">
                  {baht(Number(draft.minPrice || PRICE_SLIDER_MIN))} to{" "}
                  {draft.maxPrice ? baht(Number(draft.maxPrice)) : "any price"} per hour
                </p>
                <div className="relative mt-2 h-6">
                  <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-surface-muted" />
                  <div
                    className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-brand-navy"
                    style={{
                      left: `${percent(lowPrice)}%`,
                      right: `${100 - percent(highPrice)}%`,
                    }}
                  />
                  <input
                    type="range"
                    aria-label="Minimum price"
                    className={thumb}
                    min={PRICE_SLIDER_MIN}
                    max={PRICE_SLIDER_MAX}
                    step={PRICE_SLIDER_STEP}
                    value={lowPrice}
                    onChange={(event) =>
                      setPrice(Math.min(Number(event.target.value), highPrice), highPrice)
                    }
                  />
                  <input
                    type="range"
                    aria-label="Maximum price"
                    className={thumb}
                    min={PRICE_SLIDER_MIN}
                    max={PRICE_SLIDER_MAX}
                    step={PRICE_SLIDER_STEP}
                    value={highPrice}
                    onChange={(event) =>
                      setPrice(lowPrice, Math.max(Number(event.target.value), lowPrice))
                    }
                  />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="search-min-price" className="text-sm font-semibold">
                      Min
                    </label>
                    <input
                      id="search-min-price"
                      type="number"
                      min={PRICE_SLIDER_MIN}
                      step="any"
                      inputMode="decimal"
                      className={field}
                      placeholder="0"
                      value={draft.minPrice}
                      onChange={(event) => setDraft({ ...draft, minPrice: event.target.value })}
                    />
                  </div>
                  <div>
                    <label htmlFor="search-max-price" className="text-sm font-semibold">
                      Max
                    </label>
                    <input
                      id="search-max-price"
                      type="number"
                      min={PRICE_SLIDER_MIN}
                      step="any"
                      inputMode="decimal"
                      className={field}
                      placeholder={`${PRICE_SLIDER_MAX}+`}
                      value={draft.maxPrice}
                      onChange={(event) => setDraft({ ...draft, maxPrice: event.target.value })}
                    />
                  </div>
                </div>
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
                      className={`flex-1 rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors ${
                        filters.format === option.value
                          ? "border-brand-navy bg-brand-navy text-white"
                          : "border-line hover:border-brand-navy"
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
                className="w-full rounded-lg border border-line px-4 py-2 text-sm font-semibold transition-colors hover:border-brand-navy"
              >
                Clear filters
              </button>
              <button
                type="button"
                className="ui-button w-full lg:hidden"
                onClick={() => {
                  setFiltersOpen(false);
                  document.getElementById("search-results")?.focus();
                }}
              >
                Show results
              </button>
            </form>
          </div>
        </aside>

        <section id="search-results" tabIndex={-1} aria-label="Search results" aria-busy={loading}>
          <h1 className="mb-4 text-2xl font-semibold leading-tight tracking-tight">Find a tutor</h1>
          {filters.sort === "recommended" && (
            <div className="mb-4 min-h-20 text-sm leading-6 text-secondary">
              <p className="font-semibold">
                {result?.recommendationMode === "personalized"
                  ? "Recommended for you"
                  : "Recommended tutors"}
              </p>
              {result?.recommendationMode !== "personalized" && isAuthenticated === true && (
                <p className="mt-1 text-secondary">
                  <Link className="font-semibold underline" href="/settings/student">
                    Add learning areas to your profile
                  </Link>{" "}
                  for recommendations tailored to you.
                </p>
              )}
              {result?.recommendationMode !== "personalized" && isAuthenticated === false && (
                <p className="mt-1 text-secondary">
                  Ranked by rating and upcoming availability.{" "}
                  <Link className="font-semibold underline" href="/login">
                    Log in
                  </Link>{" "}
                  to get recommendations based on your learning areas.
                </p>
              )}
            </div>
          )}
          {suggestions.length > 0 && (
            <div
              role="group"
              className="my-4 flex flex-wrap items-center gap-2"
              aria-label="Active filters"
            >
              <span className="mr-1 text-sm font-medium text-secondary">Filters:</span>
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.label}
                  type="button"
                  onClick={() => apply(suggestion.changes)}
                  className="min-h-10 rounded-full border border-line bg-surface px-3 py-1 text-sm text-secondary transition-colors hover:border-brand-navy hover:text-foreground"
                >
                  {suggestion.label} <span aria-hidden="true">×</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => apply({ ...defaultFilters, sort: filters.sort })}
                className="min-h-10 px-2 text-sm font-semibold text-brand-link underline underline-offset-2"
              >
                Clear all
              </button>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted" role="status">
              {loading
                ? "Searching…"
                : result && `${result.total} ${result.total === 1 ? "subject" : "subjects"} found`}
            </p>
            <label className="flex items-center gap-2 text-sm text-muted">
              Sort
              <select
                className="rounded-xl border border-line bg-transparent px-3 py-1.5 text-foreground"
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
            <section className="mt-6 rounded-2xl border border-dashed border-line px-6 py-12 text-center">
              <h2 className="text-xl font-semibold">No tutors match these filters</h2>
              {suggestions.length > 0 ? (
                <>
                  <p className="mt-2 text-muted">Try broadening your search:</p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion.label}
                        type="button"
                        onClick={() => apply(suggestion.changes)}
                        className="rounded-lg border border-line px-4 py-1.5 text-sm font-semibold transition-colors hover:border-brand-navy"
                      >
                        {suggestion.label}
                      </button>
                    ))}
                    {suggestions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => apply({ ...defaultFilters, sort: filters.sort })}
                        className="rounded-lg bg-brand-navy px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-navy-dark"
                      >
                        Clear all filters
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <p className="mt-2 text-muted">No tutors are listed yet. Check back soon.</p>
              )}
            </section>
          )}

          {result && result.results.length > 0 && (
            <ul className="mt-5 grid gap-4 lg:grid-cols-2">
              {result.results.map((subject) => (
                <li key={subject.id}>
                  <SubjectCard subject={subject} />
                </li>
              ))}
            </ul>
          )}

          {loading && !result && <SearchResultsSkeleton />}

          {result && result.totalPages > 1 && (
            <nav aria-label="Pages" className="mt-8 flex items-center justify-center gap-4">
              <button
                type="button"
                disabled={filters.page <= 1}
                onClick={() => apply({ page: filters.page - 1 })}
                className="rounded-lg border border-line px-4 py-2 text-sm font-semibold disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-sm text-muted">
                Page {filters.page} of {result.totalPages}
              </span>
              <button
                type="button"
                disabled={filters.page >= result.totalPages}
                onClick={() => apply({ page: filters.page + 1 })}
                className="rounded-lg border border-line px-4 py-2 text-sm font-semibold disabled:opacity-40"
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

function SearchResultsSkeleton() {
  return (
    <ul aria-hidden="true" className="mt-5 grid gap-4 lg:grid-cols-2">
      {[0, 1].map((card) => (
        <li key={card}>
          <div className="flex min-h-80 flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
            <div className="flex items-start gap-3">
              <span className="h-12 w-12 shrink-0 rounded-2xl bg-surface-muted" />
              <div className="min-w-0 flex-1 space-y-2 pt-1">
                <span className="block h-5 w-3/5 rounded bg-surface-muted" />
                <span className="block h-4 w-2/5 rounded bg-surface-muted" />
              </div>
            </div>
            <span className="h-4 w-36 rounded bg-surface-muted" />
            <span className="h-4 w-48 rounded bg-surface-muted" />
            <span className="h-4 w-full rounded bg-surface-muted" />
            <div className="flex gap-2">
              <span className="h-7 w-24 rounded-full bg-surface-muted" />
              <span className="h-7 w-20 rounded-full bg-surface-muted" />
            </div>
            <div className="mt-auto flex items-end justify-between gap-3 border-t border-line pt-4">
              <span className="h-4 w-16 rounded bg-surface-muted" />
              <span className="h-6 w-24 rounded bg-surface-muted" />
            </div>
          </div>
        </li>
      ))}
    </ul>
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
            <span key={star} className="relative flex h-11 flex-1 justify-center items-center">
              <span aria-hidden className="relative h-7 w-7 text-[28px] leading-7">
                <span className="text-zinc-300">★</span>
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
      <p className="mt-1 text-sm text-muted">
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
      className="flex h-full min-w-0 flex-col rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-brand-navy sm:p-5"
    >
      <h2 className="break-words text-lg font-semibold leading-snug">{subject.name}</h2>
      <div className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-secondary">
        <span className="min-w-0 break-words">{tutorName}</span>
        {subject.tutor.verified && <VerifiedIcon />}
      </div>
      <p className="mt-2 text-sm leading-5 text-muted">
        Online
        {subject.learningAreas.length > 0 &&
          `, ${subject.learningAreas.map((area) => area.name).join(", ")}`}
      </p>
      <p className="mt-3 line-clamp-2 min-h-10 text-sm leading-5 text-secondary">
        {subject.description}
      </p>
      <div className="mt-auto pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-sm">
          <span className="font-semibold text-foreground">
            ฿{subject.hourlyRate}
            <span className="font-normal text-muted"> / hr</span>
          </span>
          <span className="text-muted">
            {subject.rating === null ? (
              "New subject"
            ) : (
              <>
                <span className="text-amber-500" aria-hidden="true">
                  ★
                </span>{" "}
                {subject.rating.toFixed(1)} ({subject.reviewCount}{" "}
                {subject.reviewCount === 1 ? "review" : "reviews"})
              </>
            )}
          </span>
        </div>
        <p className="mt-2 min-h-10 text-xs leading-5 text-muted">
          {subject.nextAvailableAt
            ? `Next available ${new Intl.DateTimeFormat("en", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" }).format(new Date(subject.nextAvailableAt))} (Bangkok time)`
            : "No availability in the next 30 days"}
          {subject.classesTaught > 0 &&
            ` · ${subject.classesTaught} ${subject.classesTaught === 1 ? "class" : "classes"} taught`}
        </p>
      </div>
    </Link>
  );
}
