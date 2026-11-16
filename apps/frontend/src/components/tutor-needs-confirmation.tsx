"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getTutorBookingsNeedingConfirmation } from "@/src/lib/bookings-api";
import type { Booking } from "@/src/types/booking";

const dateFormat = new Intl.DateTimeFormat("en", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Bangkok",
});

export function TutorNeedsConfirmation() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getTutorBookingsNeedingConfirmation()
      .then(setBookings)
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : "Could not load lessons to confirm.")
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-black/[.12] p-6 dark:border-white/[.18]">
      <div>
        <h3 className="text-xl font-semibold">Needs confirmation</h3>
        <p className="mt-1 text-sm text-zinc-500">
          Lessons appear here as soon as their scheduled end time passes.
        </p>
      </div>
      {loading && <p className="text-sm text-zinc-500">Loading lessons…</p>}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {!loading && !error && bookings.length === 0 && (
        <p className="text-sm text-zinc-500">No lessons need confirmation.</p>
      )}
      {bookings.length > 0 && (
        <ul className="grid gap-3">
          {bookings.map((booking) => (
            <li
              key={booking.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/10 p-4 dark:border-white/15"
            >
              <div className="min-w-0">
                <p className="font-semibold">{booking.subject.name}</p>
                <p className="text-sm text-zinc-500">with {booking.student.name}</p>
                <p className="mt-1 text-sm">{dateFormat.format(new Date(booking.startedAt))}</p>
              </div>
              <Link
                href={`/bookings/${booking.id}`}
                className="inline-flex h-10 items-center justify-center rounded-full bg-violet-600 px-4 text-sm font-semibold text-white hover:bg-violet-700"
              >
                Review lesson
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
