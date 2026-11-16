"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getTutorUpcomingBookings } from "@/src/lib/bookings-api";
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

// BOOK-4 entry point: tutors open a class from here to cancel it.
export function TutorUpcomingClasses() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getTutorUpcomingBookings()
      .then((items) => setBookings(items.filter((booking) => booking.status === "CONFIRMED")))
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : "Could not load your classes.")
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="flex min-w-0 flex-col gap-4 border-t border-line pt-5">
      <h3 className="text-xl font-semibold">Upcoming classes</h3>
      {loading && <p className="text-sm text-muted">Loading classes…</p>}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {!loading && !error && bookings.length === 0 && (
        <p className="text-sm text-muted">No upcoming classes.</p>
      )}
      {bookings.length > 0 && (
        <ul className="divide-y divide-line">
          {bookings.map((booking) => (
            <li key={booking.id}>
              <Link
                href={`/bookings/${booking.id}`}
                className="flex flex-wrap items-center justify-between gap-3 px-3 py-4 transition-colors hover:bg-surface-muted"
              >
                <div className="min-w-0">
                  <p className="font-semibold">{booking.subject.name}</p>
                  <p className="text-sm text-muted">with {booking.student.name}</p>
                  <p className="mt-1 text-sm">{dateFormat.format(new Date(booking.startedAt))}</p>
                </div>
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  Confirmed
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
