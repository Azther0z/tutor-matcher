"use client";

import { useEffect, useState } from "react";
import { RequireAuth } from "@/src/components/require-auth";
import { getAuthToken } from "@/src/lib/auth";

type NotificationPreferences = {
  notifyOnBooking: boolean;
  notifyOnMessage: boolean;
  notifyOnPayment: boolean;
};

type Phase =
  | { name: "loading" }
  | { name: "error" }
  | { name: "loaded"; preferences: NotificationPreferences };

const toggleRows: Array<{ key: keyof NotificationPreferences; label: string; hint: string }> = [
  { key: "notifyOnBooking", label: "Bookings", hint: "New and updated bookings." },
  { key: "notifyOnMessage", label: "Messages", hint: "New messages from students and tutors." },
  { key: "notifyOnPayment", label: "Payments", hint: "Payments, top-ups, and payouts." },
];

function NotificationSettingsForm() {
  const [phase, setPhase] = useState<Phase>({ name: "loading" });
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) return; // RequireAuth handles the redirect to /login

    let cancelled = false;

    (async () => {
      try {
        const response = await fetch("/api/notifications/preferences", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;

        if (!response.ok) {
          setPhase({ name: "error" });
          return;
        }

        const data = (await response.json()) as NotificationPreferences;
        if (cancelled) return;

        setPreferences(data);
        setPhase({ name: "loaded", preferences: data });
      } catch {
        if (!cancelled) setPhase({ name: "error" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  function toggle(key: keyof NotificationPreferences) {
    setPreferences((current) => (current ? { ...current, [key]: !current[key] } : current));
  }

  async function handleSave() {
    if (!preferences) return;

    const token = getAuthToken();
    if (!token) {
      setMessage("Please log in before updating your notification preferences.");
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/notifications/preferences", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(preferences),
      });

      const data = (await response.json().catch(() => null)) as
        (NotificationPreferences & { message?: string }) | { message?: string } | null;

      if (!response.ok) {
        setMessage(data?.message ?? "Could not save your notification preferences.");
        return;
      }

      setMessage("Notification preferences saved.");
    } catch {
      setMessage("Could not reach the server. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (phase.name === "loading") {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-16">
        <p className="text-zinc-500">Loading your notification preferences…</p>
      </main>
    );
  }

  if (phase.name === "error" || !preferences) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-16">
        <p role="alert" className="text-red-600 dark:text-red-400">
          We could not load your notification preferences. Please refresh and try again.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-16">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">Tutor Matcher</p>
        <h1 className="text-4xl font-semibold tracking-tight">Notification settings</h1>
        <p className="max-w-2xl text-base leading-7 text-zinc-600 dark:text-zinc-400">
          Choose which account activity sends you an email.
        </p>
      </div>

      <section className="flex flex-col gap-4 rounded-2xl border border-black/[.12] p-6 dark:border-white/[.18]">
        {toggleRows.map(({ key, label, hint }) => (
          <label key={key} className="flex items-start justify-between gap-4">
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{label}</span>
              <span className="text-sm text-zinc-500">{hint}</span>
            </span>
            <input
              type="checkbox"
              checked={preferences[key]}
              onChange={() => toggle(key)}
              className="mt-0.5 h-4 w-4 rounded border-black/[.25] dark:border-white/[.3]"
            />
          </label>
        ))}
      </section>

      {message && (
        <p role="status" className="text-sm text-zinc-700 dark:text-zinc-300">
          {message}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex h-12 cursor-pointer items-center justify-center rounded-full bg-foreground px-6 text-base font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-60 dark:hover:bg-[#ccc]"
        >
          {saving ? "Saving…" : "Save preferences"}
        </button>
      </div>
    </main>
  );
}

export default function NotificationSettingsPage() {
  return (
    <RequireAuth>
      <NotificationSettingsForm />
    </RequireAuth>
  );
}
