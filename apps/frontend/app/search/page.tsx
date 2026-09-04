"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Recommendation = {
  tutorId: number;
  name: string;
  bio: string | null;
  subjects: { id: number; name: string; description: string | null; hourlyRate: number }[];
  averageRating: number;
  reviewCount: number;
  availableSlotCount: number;
  matchedSlotCount: number;
  nextAvailableAt: string | null;
};

type RecommendationResponse = {
  rankingMode: "personalized" | "fallback";
  recommendations: Recommendation[];
};

export default function SearchPage() {
  const [data, setData] = useState<RecommendationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadRecommendations() {
      const token = window.localStorage.getItem("authToken");
      if (!token) return { error: "Log in before viewing tutor recommendations." };

      const response = await fetch("/api/discovery/recommendations", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const responseData = (await response.json().catch(() => null)) as RecommendationResponse & {
        message?: string;
      };
      if (!response.ok) throw new Error(responseData.message ?? "Could not load recommendations.");
      return { data: responseData };
    }

    loadRecommendations()
      .then(({ data: responseData, error: loadError }) => {
        if (loadError) setError(loadError);
        if (responseData) setData(responseData);
      })
      .catch((requestError: Error) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-12">
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">Tutor Matcher</p>
        <h1 className="text-4xl font-semibold tracking-tight">Recommended tutors</h1>
        <p className="max-w-2xl text-lg leading-8 text-zinc-600">
          Tutors are ranked using your learning preferences, their ratings, and open lesson slots.
        </p>
      </div>

      {loading && <p className="text-zinc-600">Finding tutors...</p>}
      {error && (
        <div className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800">
          <p role="alert">{error}</p>
          <Link href="/settings" className="font-medium underline">
            Update learning preferences
          </Link>
        </div>
      )}
      {!loading && !error && data?.rankingMode === "fallback" && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
          These results use ratings and availability.{" "}
          <Link href="/settings" className="font-medium underline">
            Add your learning preferences
          </Link>{" "}
          for personalized recommendations.
        </div>
      )}
      {!loading && !error && data?.recommendations.length === 0 && (
        <div className="rounded-2xl border border-black/[.12] p-8 text-zinc-600">
          No published tutors have an open lesson slot right now.
        </div>
      )}
      {!loading && !error && data && data.recommendations.length > 0 && (
        <div className="grid gap-5 md:grid-cols-2">
          {data.recommendations.map((recommendation) => (
            <article
              key={recommendation.tutorId}
              className="flex flex-col gap-5 rounded-2xl border border-black/[.12] p-6"
            >
              <div className="flex flex-col gap-2">
                <h2 className="text-2xl font-semibold">{recommendation.name}</h2>
                <p className="text-zinc-600">
                  {recommendation.bio ?? "Tutor profile details are coming soon."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {recommendation.subjects.map((subject) => (
                  <span
                    key={subject.id}
                    className="rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-700"
                  >
                    {subject.name} · ${subject.hourlyRate}/hour
                  </span>
                ))}
              </div>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-zinc-500">Rating</dt>
                  <dd className="font-medium">
                    {recommendation.averageRating.toFixed(1)} ({recommendation.reviewCount} reviews)
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Open slots</dt>
                  <dd className="font-medium">{recommendation.availableSlotCount}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Schedule matches</dt>
                  <dd className="font-medium">{recommendation.matchedSlotCount}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Next opening</dt>
                  <dd className="font-medium">
                    {recommendation.nextAvailableAt
                      ? new Date(recommendation.nextAvailableAt).toLocaleString()
                      : "Not available"}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
