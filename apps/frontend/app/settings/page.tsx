"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";

type StudentProfile = {
  subjects: string[];
  level: string;
  goals: string;
  preferredWeekdays: number[];
  preferredStartMinute: number | null;
  preferredEndMinute: number | null;
  timezone: string;
};

const WEEKDAYS = [
  [1, "Monday"],
  [2, "Tuesday"],
  [3, "Wednesday"],
  [4, "Thursday"],
  [5, "Friday"],
  [6, "Saturday"],
  [7, "Sunday"],
] as const;

function minutesToTime(minutes: number | null) {
  if (minutes === null) return "";
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function timeToMinutes(value: string) {
  if (!value) return undefined;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export default function SettingsPage() {
  const [subjects, setSubjects] = useState("");
  const [level, setLevel] = useState("");
  const [goals, setGoals] = useState("");
  const [preferredWeekdays, setPreferredWeekdays] = useState<number[]>([]);
  const [preferredStartTime, setPreferredStartTime] = useState("");
  const [preferredEndTime, setPreferredEndTime] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      const token = window.localStorage.getItem("authToken");
      if (!token) return { error: "Log in before editing your learning preferences." };

      const response = await fetch("/api/profiles/student", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await response.json().catch(() => null)) as {
        profile?: StudentProfile;
      } | null;
      if (!response.ok) throw new Error("Could not load your learning preferences.");
      return { profile: data?.profile };
    }

    loadProfile()
      .then(({ profile, error: loadError }) => {
        if (loadError) setError(loadError);
        if (profile) {
          setSubjects(profile.subjects.join(", "));
          setLevel(profile.level);
          setGoals(profile.goals);
          setPreferredWeekdays(profile.preferredWeekdays);
          setPreferredStartTime(minutesToTime(profile.preferredStartMinute));
          setPreferredEndTime(minutesToTime(profile.preferredEndMinute));
          setTimezone(profile.timezone);
        }
      })
      .catch((requestError: Error) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

  function toggleWeekday(day: number) {
    setPreferredWeekdays((current) =>
      current.includes(day) ? current.filter((value) => value !== day) : [...current, day].sort()
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);

    const subjectValues = subjects
      .split(",")
      .map((subject) => subject.trim())
      .filter(Boolean);
    const startMinute = timeToMinutes(preferredStartTime);
    const endMinute = timeToMinutes(preferredEndTime);

    if (subjectValues.length === 0 || !level.trim() || !goals.trim()) {
      setError("Add at least one subject, your level, and a learning goal.");
      return;
    }

    if ((startMinute === undefined) !== (endMinute === undefined)) {
      setError("Choose both a preferred start and end time, or leave both blank.");
      return;
    }

    if (startMinute !== undefined && endMinute !== undefined && startMinute >= endMinute) {
      setError("Preferred end time must be after the start time.");
      return;
    }

    const token = window.localStorage.getItem("authToken");
    if (!token) {
      setError("Log in before saving your learning preferences.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/profiles/student", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          subjects: subjectValues,
          level: level.trim(),
          goals: goals.trim(),
          preferredWeekdays,
          preferredStartMinute: startMinute,
          preferredEndMinute: endMinute,
          timezone,
        }),
      });
      const data = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) throw new Error(data?.message ?? "Could not save your preferences.");
      setSaved(true);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Could not save your preferences."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">Tutor Matcher</p>
        <h1 className="text-4xl font-semibold tracking-tight">Learning preferences</h1>
        <p className="max-w-2xl text-lg leading-8 text-zinc-600">
          Tell us what you want to learn and when you are available so recommendations fit your
          goals.
        </p>
      </div>

      {loading ? (
        <p className="text-zinc-600">Loading your preferences...</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
          <label htmlFor="subjects" className="flex flex-col gap-1.5 text-sm font-medium">
            Subjects
            <input
              id="subjects"
              name="subjects"
              value={subjects}
              onChange={(event) => setSubjects(event.target.value)}
              placeholder="Mathematics, English"
              className="h-11 rounded-lg border border-black/[.12] bg-transparent px-3 text-base outline-none focus:border-foreground dark:border-white/[.18]"
            />
            <span className="font-normal text-zinc-500">
              Separate multiple subjects with commas.
            </span>
          </label>

          <label htmlFor="level" className="flex flex-col gap-1.5 text-sm font-medium">
            Current level
            <input
              id="level"
              name="level"
              value={level}
              onChange={(event) => setLevel(event.target.value)}
              placeholder="Beginner, Grade 10, university"
              className="h-11 rounded-lg border border-black/[.12] bg-transparent px-3 text-base outline-none focus:border-foreground dark:border-white/[.18]"
            />
          </label>

          <label htmlFor="goals" className="flex flex-col gap-1.5 text-sm font-medium">
            Learning goals
            <textarea
              id="goals"
              name="goals"
              value={goals}
              onChange={(event) => setGoals(event.target.value)}
              placeholder="Prepare for calculus exams and improve problem solving"
              rows={4}
              className="rounded-lg border border-black/[.12] bg-transparent px-3 py-2 text-base outline-none focus:border-foreground dark:border-white/[.18]"
            />
          </label>

          <fieldset className="flex flex-col gap-3">
            <legend className="text-sm font-medium">Preferred days (optional)</legend>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {WEEKDAYS.map(([day, label]) => (
                <label key={day} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={preferredWeekdays.includes(day)}
                    onChange={() => toggleWeekday(day)}
                    className="h-4 w-4"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-3">
            <label
              htmlFor="preferred-start-time"
              className="flex flex-col gap-1.5 text-sm font-medium"
            >
              Earliest time
              <input
                id="preferred-start-time"
                type="time"
                value={preferredStartTime}
                onChange={(event) => setPreferredStartTime(event.target.value)}
                className="h-11 rounded-lg border border-black/[.12] bg-transparent px-3 text-base outline-none focus:border-foreground dark:border-white/[.18]"
              />
            </label>
            <label
              htmlFor="preferred-end-time"
              className="flex flex-col gap-1.5 text-sm font-medium"
            >
              Latest time
              <input
                id="preferred-end-time"
                type="time"
                value={preferredEndTime}
                onChange={(event) => setPreferredEndTime(event.target.value)}
                className="h-11 rounded-lg border border-black/[.12] bg-transparent px-3 text-base outline-none focus:border-foreground dark:border-white/[.18]"
              />
            </label>
            <label htmlFor="timezone" className="flex flex-col gap-1.5 text-sm font-medium">
              Timezone
              <input
                id="timezone"
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
                placeholder="UTC"
                className="h-11 rounded-lg border border-black/[.12] bg-transparent px-3 text-base outline-none focus:border-foreground dark:border-white/[.18]"
              />
            </label>
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}
          {saved && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400" role="status">
              Preferences saved.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="submit"
              disabled={saving}
              className="flex h-12 items-center justify-center rounded-full bg-foreground px-6 text-base font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-60 dark:hover:bg-[#ccc]"
            >
              {saving ? "Saving..." : "Save preferences"}
            </button>
            <Link href="/search" className="text-sm font-medium underline">
              View recommendations
            </Link>
          </div>
        </form>
      )}
    </main>
  );
}
