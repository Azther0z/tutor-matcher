"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BookingApiError, createBooking, getAvailability } from "@/src/lib/bookings-api";
import type { AvailabilityResponse } from "@/src/types/booking";

const money = new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" });
const date = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric" });
const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

export default function SubjectBookingPage() {
  // Read the reusable subject id from /bookings/s/[subjectId].
  const { subjectId } = useParams<{ subjectId: string }>();
  const router = useRouter();
  const [data, setData] = useState<AvailabilityResponse | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      // Refresh slots and remove selections that are no longer available.
      const next = await getAvailability(subjectId);
      setData(next);
      const valid = new Set(
        next.slots.filter((slot) => slot.available !== false).map((slot) => slot.id)
      );
      setSelectedIds((current) => current.filter((id) => valid.has(id)));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load available times.");
    } finally {
      setLoading(false);
    }
  }, [subjectId]);

  useEffect(() => {
    // Guests must log in before this protected booking flow can load.
    if (!localStorage.getItem("authToken")) {
      router.replace(`/login?next=${encodeURIComponent(`/bookings/s/${subjectId}`)}`);
      return;
    }
    // Fetching route-specific server data is the synchronization performed by this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load, router, subjectId]);

  const grouped = useMemo(() => {
    // Group slots by date so students can compare times quickly.
    const groups = new Map<string, NonNullable<typeof data>["slots"]>();
    for (const slot of data?.slots ?? []) {
      if (slot.available === false) continue;
      const label = date.format(new Date(slot.startedAt));
      groups.set(label, [...(groups.get(label) ?? []), slot]);
    }
    return [...groups.entries()];
  }, [data]);

  // A 30-minute slot costs half of the tutor's hourly rate.
  const total = (Number(data?.subject?.hourlyRate ?? 0) * selectedIds.length) / 2;

  async function submit() {
    // BOOK-1 requires at least one slot before creating the trial booking.
    if (!data || selectedIds.length === 0) {
      setMessage("Choose at least one available time.");
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      // Create the pending booking and continue to its payment/detail page.
      const booking = await createBooking({
        subjectId: data.subject.id,
        availabilityIds: selectedIds,
        description: description.trim() || undefined,
        isTrial: true,
      });
      router.push(`/bookings/${booking.id}`);
    } catch (error) {
      if (error instanceof BookingApiError && error.status === 409) {
        // Another student took the slot, so show the conflict and reload times.
        setMessage("That time was just booked by someone else. We refreshed the available times.");
        await load();
      } else {
        setMessage(error instanceof Error ? error.message : "Could not create this booking.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10 sm:px-8">
      <Link
        href={`/tutors/${data?.subject.tutor.id ?? ""}/${subjectId}`}
        className="text-sm text-zinc-600 hover:underline"
      >
        ← Back to tutor
      </Link>
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_340px]">
        <section>
          <p className="text-sm font-semibold uppercase tracking-widest text-violet-600">
            Trial lesson
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Choose a time</h1>
          {data && (
            <p className="mt-2 text-zinc-600">
              {data.subject.name} with {data.subject.tutor.name}
            </p>
          )}

          {loading ? (
            <p className="mt-10 text-zinc-500">Loading available times…</p>
          ) : grouped.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-zinc-300 p-8 text-center">
              <p className="font-medium">No open times right now</p>
              <button
                onClick={() => {
                  setLoading(true);
                  void load();
                }}
                className="mt-3 text-sm font-semibold text-violet-700 hover:underline"
              >
                Refresh availability
              </button>
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              {grouped.map(([label, slots]) => (
                <fieldset key={label}>
                  <legend className="mb-3 font-semibold">{label}</legend>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {slots.map((slot) => {
                      const active = selectedIds.includes(slot.id);
                      return (
                        <button
                          type="button"
                          key={slot.id}
                          aria-pressed={active}
                          onClick={() =>
                            setSelectedIds((ids) =>
                              active ? ids.filter((id) => id !== slot.id) : [...ids, slot.id]
                            )
                          }
                          className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${active ? "border-violet-600 bg-violet-600 text-white" : "border-zinc-200 hover:border-violet-400"}`}
                        >
                          {time.format(new Date(slot.startedAt))}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
            </div>
          )}
        </section>

        <aside className="h-fit rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-semibold">Booking summary</h2>
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Lesson</dt>
              <dd className="text-right font-medium">Trial · {selectedIds.length * 30} min</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Rate</dt>
              <dd>{money.format(Number(data?.subject?.hourlyRate ?? 0))}/hr</dd>
            </div>
            <div className="flex justify-between border-t border-zinc-200 pt-3 text-base font-semibold">
              <dt>Total</dt>
              <dd>{money.format(total)}</dd>
            </div>
          </dl>
          <label className="mt-6 block text-sm font-medium">
            What would you like to focus on?{" "}
            <span className="font-normal text-zinc-500">(optional)</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              maxLength={1000}
              className="mt-2 w-full rounded-xl border border-zinc-200 bg-transparent p-3 outline-none focus:border-violet-500"
            />
          </label>
          {message && (
            <p role="alert" className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              {message}
            </p>
          )}
          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitting || loading || selectedIds.length === 0}
            className="mt-5 h-12 w-full rounded-full bg-violet-600 font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Booking…" : total > 0 ? "Continue to payment" : "Confirm booking"}
          </button>
          <p className="mt-3 text-center text-xs text-zinc-500">
            Your time is confirmed only after this step succeeds.
          </p>
        </aside>
      </div>
    </main>
  );
}
