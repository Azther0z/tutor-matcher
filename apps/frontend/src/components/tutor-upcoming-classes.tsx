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
      .then(setBookings)
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : "Could not load your classes.")
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-black/[.12] p-6 dark:border-white/[.18]">
      <h3 className="text-xl font-semibold">Upcoming classes</h3>
      {loading && <p className="text-sm text-zinc-500">Loading classes…</p>}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {!loading && !error && bookings.length === 0 && (
        <p className="text-sm text-zinc-500">No upcoming classes.</p>
      )}
      {bookings.length > 0 && (
        <ul className="grid gap-3">
          {bookings.map((booking) => (
            <li key={booking.id}>
              <Link
                href={`/bookings/${booking.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/10 p-4 hover:border-violet-500 dark:border-white/15"
              >
                <div className="min-w-0">
                  <p className="font-semibold">{booking.subject.name}</p>
                  <p className="text-sm text-zinc-500">with {booking.student.name}</p>
                  <p className="mt-1 text-sm">{dateFormat.format(new Date(booking.startedAt))}</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    booking.status === "CONFIRMED"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {booking.status === "CONFIRMED" ? "Confirmed" : "Payment due"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
