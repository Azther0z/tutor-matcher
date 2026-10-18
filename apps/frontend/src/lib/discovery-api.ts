import type { SubjectOffering } from "@/src/lib/subjects";
import { clearAuthToken, getAuthToken } from "@/src/lib/auth";

export type LearningArea = { id: string; name: string };

export type TutorSort = "recommended" | "price_asc" | "price_desc" | "rating";

export type TutorSearchFilters = {
  q: string;
  tutorName: string;
  learningAreaId: string;
  minPrice: string;
  maxPrice: string;
  minRating: string;
  format: string;
  sort: TutorSort;
  page: number;
  asOf?: string;
};

// DISC-1: one result per tutor + subject, with that subject's own price and rating.
export type SubjectSearchResult = SubjectOffering & {
  rating: number | null;
  reviewCount: number;
  classesTaught: number;
  nextAvailableAt: string | null;
  tutor: { id: string; firstName: string; lastName: string; bio: string | null; verified: boolean };
};

export type TutorSearchResponse = {
  results: SubjectSearchResult[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  recommendationMode: "personalized" | "fallback" | null;
  asOf: string;
};

export type PriceRange = { min: string; max: string } | null;

export const sortOptions: Array<{ value: TutorSort; label: string }> = [
  { value: "recommended", label: "Recommended" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "rating", label: "Top rated" },
];

export const defaultFilters: TutorSearchFilters = {
  q: "",
  tutorName: "",
  learningAreaId: "",
  minPrice: "",
  maxPrice: "",
  minRating: "",
  format: "",
  sort: "recommended",
  page: 1,
};

// DISC-1 keeps filters in the URL so refresh, back and shared links show the same search.
export function filtersFromParams(params: Pick<URLSearchParams, "get">): TutorSearchFilters {
  const sort = params.get("sort");
  const page = Number(params.get("page"));
  return {
    q: params.get("q") ?? "",
    tutorName: params.get("tutorName") ?? "",
    learningAreaId: params.get("learningAreaId") ?? "",
    minPrice: params.get("minPrice") ?? "",
    maxPrice: params.get("maxPrice") ?? "",
    minRating: params.get("minRating") ?? "",
    format: params.get("format") ?? "",
    sort: sortOptions.some(({ value }) => value === sort) ? (sort as TutorSort) : "recommended",
    page: Number.isInteger(page) && page > 1 ? page : 1,
    ...(params.get("asOf") ? { asOf: params.get("asOf")! } : {}),
  };
}

export function filtersToQuery(filters: TutorSearchFilters) {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.tutorName.trim()) params.set("tutorName", filters.tutorName.trim());
  if (filters.learningAreaId) params.set("learningAreaId", filters.learningAreaId);
  if (filters.minPrice.trim()) params.set("minPrice", filters.minPrice.trim());
  if (filters.maxPrice.trim()) params.set("maxPrice", filters.maxPrice.trim());
  if (filters.minRating) params.set("minRating", filters.minRating);
  if (filters.format) params.set("format", filters.format);
  if (filters.sort !== "recommended") params.set("sort", filters.sort);
  if (filters.page > 1) params.set("page", String(filters.page));
  if (filters.asOf) params.set("asOf", filters.asOf);
  return params.toString();
}

async function publicGet<T>(path: string, signal?: AbortSignal, token?: string | null): Promise<T> {
  // Public searches may include a verified token to personalize Recommended results.
  const response = await fetch(path, {
    signal,
    ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
  });
  const data = (await response.json().catch(() => null)) as (T & { message?: string }) | null;
  if (!response.ok || data === null) {
    if (response.status === 401 && token) clearAuthToken();
    const error = new Error(
      response.status === 400
        ? "Some filters are not valid. Check them and try again."
        : (data?.message ?? "Could not load tutors. Please try again.")
    );
    if (response.status === 401 && token) error.name = "AuthError";
    throw error;
  }
  return data;
}

export async function getLearningAreas() {
  const { learningAreas } = await publicGet<{ learningAreas: LearningArea[] }>(
    "/api/discovery/learning-areas"
  );
  return learningAreas;
}

// The slider's range covers every listed subject, so the page loads it once.
export async function getPriceRange() {
  const { priceRange } = await publicGet<{ priceRange: PriceRange }>("/api/discovery/price-range");
  return priceRange;
}

export function searchTutors(filters: TutorSearchFilters, signal?: AbortSignal) {
  const query = filtersToQuery(filters);
  const token = filters.sort === "recommended" ? getAuthToken() : null;
  return publicGet<TutorSearchResponse>(
    `/api/discovery/tutors${query ? `?${query}` : ""}`,
    signal,
    token
  );
}
