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

const statusColor: Record<BookingStatus, string> = {
  PENDING_PAYMENT: "text-amber-700 dark:text-amber-400",
  CONFIRMED: "text-emerald-700 dark:text-emerald-400",
  COMPLETED: "text-brand-link",
  CANCELLED: "text-red-700 dark:text-red-400",
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
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto w-full max-w-[68rem] flex-1 px-4 py-6 sm:px-6 lg:px-8"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold leading-tight tracking-tight">Your bookings</h1>
        <Link
          href="/search"
          className="inline-flex h-11 items-center justify-center rounded-lg bg-brand-navy px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-navy-dark"
        >
          Find a tutor
        </Link>
      </header>

      <div className="mt-5 flex min-h-11 flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 gap-1" aria-label="Booking filters">
          {filters.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={filter === item.value}
              onClick={() => setFilter(item.value)}
              className={`min-h-11 shrink-0 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
                filter === item.value
                  ? "border-brand-navy bg-brand-navy text-white"
                  : "border-line hover:border-brand-navy"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        {isApprovedTutor && (
          <div
            className="grid h-11 w-52 shrink-0 grid-cols-2 items-center gap-1 rounded-lg bg-surface-muted p-1"
            role="group"
            aria-label="Booking role"
          >
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
                className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
                  role === item ? "bg-brand-navy text-white" : "text-secondary"
                }`}
              >
                {item === "STUDENT" ? "Student" : "Tutor"}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && (
        <div className="mt-5" role="status" aria-label="Loading bookings">
          <span className="sr-only">Loading bookings…</span>
          <div
            aria-hidden="true"
            className="rounded-2xl border border-line bg-surface px-4 sm:px-5"
          >
            {[0, 1, 2].map((row) => (
              <div
                key={row}
                className="flex min-h-32 items-center justify-between gap-4 border-b border-line py-5 last:border-0"
              >
                <div className="flex-1 space-y-3">
                  <div className="h-5 w-40 rounded bg-surface-muted" />
                  <div className="h-4 w-28 rounded bg-surface-muted" />
                  <div className="h-4 w-3/5 rounded bg-surface-muted" />
                </div>
                <div className="h-4 w-20 rounded bg-surface-muted" />
              </div>
            ))}
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-8 rounded-2xl bg-red-50 p-5 text-red-700 dark:bg-red-950/30">
          {error}
        </p>
      )}
      {!loading && !error && visibleBookings.length === 0 && (
        <section className="mt-8 rounded-2xl border border-dashed border-line px-6 py-8 text-center">
          <h2 className="text-xl font-semibold">No bookings in this view</h2>
          <p className="mt-2 text-muted">
            {filter === "ALL" ? "Book a tutor to see your lessons here." : "Try another filter."}
          </p>
        </section>
      )}

      {!loading && !error && visibleBookings.length > 0 && (
        <section
          aria-label="Your lessons"
          className="mt-5 overflow-hidden rounded-2xl border border-line bg-surface"
        >
          {visibleBookings.map((booking) => (
            <Link
              key={booking.id}
              href={`/bookings/${booking.id}`}
              className="group grid gap-3 border-b border-line px-4 py-5 transition-colors last:border-b-0 hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-link sm:grid-cols-[1fr_auto] sm:items-center sm:px-5"
            >
              <div className="flex min-w-0 items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-lg font-semibold text-brand-link">
                  {(booking.viewerRole === "TUTOR"
                    ? booking.student.name
                    : booking.subject.tutor.name
                  )
                    .charAt(0)
                    .toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="break-words text-lg font-semibold">{booking.subject.name}</h2>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    with{" "}
                    {booking.viewerRole === "TUTOR"
                      ? booking.student.name
                      : booking.subject.tutor.name}
                  </p>
                </div>
              </div>
              <div className="flex min-w-0 flex-col items-end gap-1 text-right">
                <p className="text-sm font-medium">
                  {dateFormat.formatRange(new Date(booking.startedAt), new Date(booking.endedAt))}
                </p>
                <span className={`text-sm font-medium ${statusColor[booking.status]}`}>
                  {booking.status === "CONFIRMED" && new Date(booking.endedAt).getTime() <= now
                    ? "Awaiting completion"
                    : booking.status === "CONFIRMED" && new Date(booking.startedAt).getTime() <= now
                      ? "In progress"
                      : booking.status === "CANCELLED" &&
                          booking.cancellationReason === "PAYMENT_EXPIRED"
                        ? "Expired"
                        : statusLabel[booking.status]}
                </span>
              </div>
            </Link>
          ))}
        </section>
      )}
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
