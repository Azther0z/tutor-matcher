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
    <section className="flex min-w-0 flex-col gap-4 border-t border-line pt-5">
      <div>
        <h3 className="text-xl font-semibold">Needs confirmation</h3>
        <p className="mt-1 text-sm text-muted">
          Lessons appear here as soon as their scheduled end time passes.
        </p>
      </div>
      {loading && <p className="text-sm text-muted">Loading lessons…</p>}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {!loading && !error && bookings.length === 0 && (
        <p className="text-sm text-muted">No lessons need confirmation.</p>
      )}
      {bookings.length > 0 && (
        <ul className="divide-y divide-line">
          {bookings.map((booking) => (
            <li
              key={booking.id}
              className="flex flex-wrap items-center justify-between gap-3 px-3 py-4"
            >
              <div className="min-w-0">
                <p className="font-semibold">{booking.subject.name}</p>
                <p className="text-sm text-muted">with {booking.student.name}</p>
                <p className="mt-1 text-sm">{dateFormat.format(new Date(booking.startedAt))}</p>
              </div>
              <Link
                href={`/bookings/${booking.id}`}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-navy px-4 text-sm font-semibold text-white hover:bg-brand-navy-dark"
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
