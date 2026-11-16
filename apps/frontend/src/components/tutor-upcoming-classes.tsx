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
    <section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6">
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
        <ul className="grid gap-3">
          {bookings.map((booking) => (
            <li key={booking.id}>
              <Link
                href={`/bookings/${booking.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-4 hover:border-brand-navy"
              >
                <div className="min-w-0">
                  <p className="font-semibold">{booking.subject.name}</p>
                  <p className="text-sm text-muted">with {booking.student.name}</p>
                  <p className="mt-1 text-sm">{dateFormat.format(new Date(booking.startedAt))}</p>
                </div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
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
