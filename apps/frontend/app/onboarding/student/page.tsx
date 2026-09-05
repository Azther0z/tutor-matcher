"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type LearningArea = { id: number; name: string };

const educationLevels = [
  ["PRIMARY_SCHOOL", "Primary School"],
  ["LOWER_SECONDARY_SCHOOL", "Lower Secondary School"],
  ["UPPER_SECONDARY_SCHOOL", "Upper Secondary School"],
  ["VOCATIONAL_CERTIFICATE", "Vocational Certificate"],
  ["HIGHER_VOCATIONAL_CERTIFICATE", "Higher Vocational Certificate"],
  ["UNIVERSITY", "University"],
  ["WORKING_ADULT", "Working adult / self-learning"],
] as const;

const goalOptions = [
  ["IMPROVE_PERFORMANCE", "Improve school or university performance"],
  ["EXAM_PREPARATION", "Prepare for an examination"],
  ["LEARN_NEW_SKILL", "Learn a new skill"],
  ["PREPARE_FOR_WORK", "Prepare for work"],
  ["PERSONAL_INTEREST", "Personal interest"],
] as const;

const periodOptions = [
  ["MORNING", "Morning"],
  ["AFTERNOON", "Afternoon"],
  ["EVENING", "Evening"],
  ["FLEXIBLE", "Flexible"],
] as const;

const durationOptions = [30, 60, 90] as const;

export default function StudentOnboardingPage() {
  const router = useRouter();
  const learningAreaPickerRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [areaInputFocused, setAreaInputFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<LearningArea[]>([]);
  const [selectedAreas, setSelectedAreas] = useState<LearningArea[]>([]);
  const [educationLevel, setEducationLevel] = useState("");
  const [goals, setGoals] = useState<string[]>([]);
  const [period, setPeriod] = useState("");
  const [duration, setDuration] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const query = search.trim();
    const token = localStorage.getItem("authToken");

    if (!token || !areaInputFocused) {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        const endpoint = query
          ? `/api/profiles/learning-areas?search=${encodeURIComponent(query)}`
          : "/api/profiles/learning-areas";
        const response = await fetch(endpoint, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });

        if (response.ok) {
          const areas = (await response.json()) as LearningArea[];
          setSuggestions(
            areas.filter((area) => !selectedAreas.some((selected) => selected.id === area.id))
          );
        }
      } catch (requestError) {
        if ((requestError as DOMException).name !== "AbortError") {
          setSuggestions([]);
        }
      }
    }, 200);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [areaInputFocused, search, selectedAreas]);

  useEffect(() => {
    if (!areaInputFocused) return;

    function handleOutsideClick(event: PointerEvent) {
      if (!learningAreaPickerRef.current?.contains(event.target as Node)) {
        setAreaInputFocused(false);
        setSuggestions([]);
      }
    }

    document.addEventListener("pointerdown", handleOutsideClick);
    return () => document.removeEventListener("pointerdown", handleOutsideClick);
  }, [areaInputFocused]);

  function toggleGoal(goal: string) {
    setGoals((current) =>
      current.includes(goal) ? current.filter((item) => item !== goal) : [...current, goal]
    );
  }

  function selectArea(area: LearningArea) {
    setSelectedAreas((current) => [...current, area]);
    setSearch("");
    setSuggestions([]);
    setAreaInputFocused(false);
  }

  function removeArea(areaId: number) {
    setSelectedAreas((current) => current.filter((area) => area.id !== areaId));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!selectedAreas.length || !educationLevel || !goals.length || !period || !duration) {
      setError("Please complete every section before continuing.");
      return;
    }

    const token = localStorage.getItem("authToken");
    if (!token) {
      router.push("/login");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/profiles/me/student", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          educationLevel,
          learningAreaIds: selectedAreas.map((area) => area.id),
          goals,
          preferredLearningPeriod: period,
          preferredDurationMinutes: Number(duration),
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { message?: string } | null;
        setError(data?.message ?? "Could not save your Student profile.");
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-16">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">Tutor Matcher</p>
        <h1 className="text-4xl font-semibold tracking-tight">Tell us about your learning goals</h1>
        <p className="max-w-2xl text-base leading-7 text-zinc-600 dark:text-zinc-400">
          Your answers help us understand what you are looking for. You can update them later.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-8" noValidate>
        <section className="flex flex-col gap-4 rounded-2xl border border-black/[.12] p-6 dark:border-white/[.18]">
          <div>
            <h2 className="text-xl font-semibold">Learning areas</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Type to search, then select one or more areas.
            </p>
          </div>
          <div ref={learningAreaPickerRef} className="relative">
            <input
              aria-label="Search learning areas"
              value={search}
              onFocus={() => setAreaInputFocused(true)}
              onChange={(event) => {
                const value = event.target.value;
                setSearch(value);
              }}
              placeholder="Search learning areas"
              className="h-11 w-full rounded-lg border border-black/[.12] bg-transparent px-3 text-base outline-none focus:border-foreground dark:border-white/[.18]"
            />
            {suggestions.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border border-black/[.12] bg-background p-1 shadow-lg dark:border-white/[.18]">
                {suggestions.map((area) => (
                  <button
                    type="button"
                    key={area.id}
                    onClick={() => selectArea(area)}
                    className="block w-full rounded-md px-3 py-2 text-left hover:bg-black/[.06] dark:hover:bg-white/[.08]"
                  >
                    {area.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Selected learning areas">
            {selectedAreas.map((area) => (
              <span
                key={area.id}
                className="inline-flex items-center gap-2 rounded-full bg-black/[.06] px-3 py-1.5 text-sm dark:bg-white/[.12]"
              >
                {area.name}
                <button
                  type="button"
                  onClick={() => removeArea(area.id)}
                  aria-label={`Remove ${area.name}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-2xl border border-black/[.12] p-6 dark:border-white/[.18]">
          <h2 className="text-xl font-semibold">Education level</h2>
          <select
            aria-label="Education level"
            value={educationLevel}
            onChange={(event) => setEducationLevel(event.target.value)}
            className="h-11 rounded-lg border border-black/[.12] bg-transparent px-3 text-base dark:border-white/[.18]"
          >
            <option value="">Select your education level</option>
            {educationLevels.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </section>

        <section className="flex flex-col gap-4 rounded-2xl border border-black/[.12] p-6 dark:border-white/[.18]">
          <h2 className="text-xl font-semibold">Learning goals</h2>
          <div className="flex flex-col gap-3">
            {goalOptions.map(([value, label]) => (
              <label key={value} className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={goals.includes(value)}
                  onChange={() => toggleGoal(value)}
                />
                {label}
              </label>
            ))}
          </div>
        </section>

        <section className="grid gap-4 rounded-2xl border border-black/[.12] p-6 sm:grid-cols-2 dark:border-white/[.18]">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Preferred learning period
            <select
              aria-label="Preferred learning period"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              className="h-11 rounded-lg border border-black/[.12] bg-transparent px-3 text-base dark:border-white/[.18]"
            >
              <option value="">Select a period</option>
              {periodOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Preferred lesson duration
            <select
              aria-label="Preferred lesson duration"
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
              className="h-11 rounded-lg border border-black/[.12] bg-transparent px-3 text-base dark:border-white/[.18]"
            >
              <option value="">Select a duration</option>
              {durationOptions.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} minutes
                </option>
              ))}
            </select>
          </label>
        </section>

        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="flex h-12 w-full items-center justify-center rounded-full bg-foreground px-5 font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-60 dark:hover:bg-[#ccc]"
        >
          {submitting ? "Saving…" : "Save and continue"}
        </button>
      </form>
    </main>
  );
}
