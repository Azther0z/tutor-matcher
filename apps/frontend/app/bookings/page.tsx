"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { RequireAuth } from "@/src/components/require-auth";
import { getBookings } from "@/src/lib/bookings-api";
import type { Booking, BookingStatus } from "@/src/types/booking";

type Filter = "ALL" | "UPCOMING" | "PAST";
type ViewRole = "STUDENT" | "TUTOR";
const TIME_ZONE = "Asia/Bangkok";

const filters: Array<{ value: Filter; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "UPCOMING", label: "Upcoming" },
  { value: "PAST", label: "Past" },
];

const statusLabel: Record<BookingStatus, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const statusStyle: Record<BookingStatus, string> = {
  PENDING_PAYMENT: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-emerald-100 text-emerald-800",
  COMPLETED: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
  CANCELLED: "bg-red-100 text-red-700",
};

const dateFormat = new Intl.DateTimeFormat("en", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});

function belongsToFilter(booking: Booking, filter: Filter) {
  if (filter === "UPCOMING") return booking.status === "CONFIRMED";
  if (filter === "PAST") return ["COMPLETED", "CANCELLED"].includes(booking.status);
  return true;
}

function BookingsContent() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [role, setRole] = useState<ViewRole>("STUDENT");
  const [isApprovedTutor, setIsApprovedTutor] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (!token) return;
    let cancelled = false;
    fetch("/api/profiles/me/tutor", { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { status?: string } | null) => {
        if (!cancelled) setIsApprovedTutor(data?.status === "APPROVED");
      })
      .catch(() => {
        if (!cancelled) setIsApprovedTutor(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const id = ++requestId.current;
    getBookings(role)
      .then((result) => {
        if (requestId.current === id) setBookings(result);
      })
      .catch((reason: unknown) => {
        if (requestId.current === id)
          setError(reason instanceof Error ? reason.message : "Could not load your bookings.");
      })
      .finally(() => {
        if (requestId.current === id) setLoading(false);
      });
  }, [role]);

  const visibleBookings = useMemo(
    () =>
      bookings.filter(
        (booking) =>
          booking.status !== "PENDING_PAYMENT" &&
          booking.cancellationReason !== "PAYMENT_EXPIRED" &&
          belongsToFilter(booking, filter)
      ),
    [bookings, filter]
  );

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12 lg:px-10 lg:py-16">
      <header className="flex flex-col gap-3 border-b border-black/10 pb-8 dark:border-white/15 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-500">
            Lesson schedule
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight">Your bookings</h1>
          <p className="mt-2 text-zinc-500">View and manage all of your lessons in one place.</p>
        </div>
        <Link
          href="/search"
          className="inline-flex h-11 items-center justify-center rounded-full bg-violet-600 px-6 font-semibold text-white transition hover:bg-violet-500"
        >
          Find a tutor
        </Link>
      </header>

      <div className="mt-8 flex items-center justify-between gap-3">
        <div className="flex min-w-0 gap-2 overflow-x-auto pb-2" aria-label="Booking filters">
          {filters.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={filter === item.value}
              onClick={() => setFilter(item.value)}
              className={`shrink-0 rounded-full border px-5 py-2 text-sm font-semibold transition ${
                filter === item.value
                  ? "border-violet-600 bg-violet-600 text-white"
                  : "border-black/15 hover:border-violet-500 dark:border-white/20"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        {isApprovedTutor && (
          <div
            className="relative grid h-11 w-52 shrink-0 grid-cols-2 items-center rounded-full bg-zinc-100 p-1 dark:bg-zinc-800"
            role="group"
            aria-label="Booking role"
          >
            <span
              aria-hidden="true"
              className={`absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-violet-600 shadow-sm transition-transform duration-200 ${
                role === "TUTOR" ? "translate-x-full" : "translate-x-0"
              }`}
            />
            {(["STUDENT", "TUTOR"] as const).map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={role === item}
                onClick={() => {
                  if (item === role) return;
                  setRole(item);
                  setFilter("ALL");
                  setLoading(true);
                  setError(null);
                }}
                className={`relative z-10 rounded-full px-3 py-2 text-sm font-semibold transition-colors ${
                  role === item ? "text-white" : "text-zinc-700 dark:text-zinc-200"
                }`}
              >
                {item === "STUDENT" ? "Student" : "Tutor"}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && <p className="mt-12 text-zinc-500">Loading bookings…</p>}
      {error && (
        <p role="alert" className="mt-8 rounded-2xl bg-red-50 p-5 text-red-700 dark:bg-red-950/30">
          {error}
        </p>
      )}
      {!loading && !error && visibleBookings.length === 0 && (
        <section className="mt-8 rounded-3xl border border-dashed border-black/25 px-6 py-16 text-center dark:border-white/25">
          <h2 className="text-xl font-semibold">No bookings in this view</h2>
          <p className="mt-2 text-zinc-500">
            {filter === "ALL" ? "Book a tutor to see your lessons here." : "Try another filter."}
          </p>
        </section>
      )}

      <section className="mt-8 grid gap-4">
        {visibleBookings.map((booking) => (
          <Link
            key={booking.id}
            href={`/bookings/${booking.id}`}
            className="group grid gap-5 rounded-3xl border border-black/10 p-6 transition hover:-translate-y-0.5 hover:border-violet-500 hover:shadow-lg dark:border-white/15 sm:grid-cols-[1fr_auto] sm:items-center"
          >
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-lg font-bold text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                {(booking.viewerRole === "TUTOR"
                  ? booking.student.name
                  : booking.subject.tutor.name
                )
                  .charAt(0)
                  .toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-lg font-bold">{booking.subject.name}</h2>
                </div>
                <p className="mt-1 text-sm text-zinc-500">
                  with{" "}
                  {booking.viewerRole === "TUTOR"
                    ? booking.student.name
                    : booking.subject.tutor.name}
                </p>
                <p className="mt-3 font-medium">
                  {dateFormat.formatRange(new Date(booking.startedAt), new Date(booking.endedAt))}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${statusStyle[booking.status]}`}
              >
                {booking.status === "CONFIRMED" && new Date(booking.endedAt).getTime() <= now
                  ? "Awaiting completion"
                  : booking.status === "CONFIRMED" && new Date(booking.startedAt).getTime() <= now
                    ? "In progress"
                    : booking.status === "CANCELLED" &&
                        booking.cancellationReason === "PAYMENT_EXPIRED"
                      ? "Expired"
                      : statusLabel[booking.status]}
              </span>
              <span className="font-semibold text-violet-600 group-hover:underline">
                View details →
              </span>
            </div>
          </Link>
        ))}
      </section>
    </main>
  );
}

export default function BookingsPage() {
  return (
    <RequireAuth>
      <BookingsContent />
    </RequireAuth>
  );
}
