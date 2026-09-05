"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookingApiError,
  cancelBooking,
  confirmPayment,
  getAvailability,
  getBooking,
  rescheduleBooking,
} from "@/src/lib/bookings-api";
import type { AvailabilitySlot, Booking } from "@/src/types/booking";

const money = new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" });
const dateTime = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const statusStyle: Record<Booking["status"], string> = {
  PENDING_PAYMENT: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-emerald-100 text-emerald-800",
  COMPLETED: "bg-blue-100 text-blue-800",
  CANCELLED: "bg-zinc-200 text-zinc-700",
};

export default function BookingDetailPage() {
  // Read the booking id from /bookings/[id].
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [mode, setMode] = useState<"cancel" | "reschedule" | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [renderedAt] = useState(() => Date.now());

  const loadBooking = useCallback(async () => {
    // Load the latest booking, payment, tutor, subject, and time data.
    try {
      setBooking(await getBooking(id));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load this booking.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // Protect booking details and preserve this URL through the login flow.
    if (!localStorage.getItem("authToken")) {
      router.replace(`/login?next=${encodeURIComponent(`/bookings/${id}`)}`);
      return;
    }
    // Fetching route-specific server data is the synchronization performed by this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadBooking();
  }, [id, loadBooking, router]);

  // Prefer the snapshot because cancelled bookings release their availability rows.
  const startsAt = booking?.startedAt ?? booking?.availabilities?.[0]?.startedAt;
  const hoursUntilLesson = startsAt
    ? (new Date(startsAt).getTime() - renderedAt) / 3_600_000
    : null;
  // Choose the correct BOOK-3 policy message for the confirmation panel.
  const lateCancellation = hoursUntilLesson !== null && hoursUntilLesson <= 24;

  async function openReschedule() {
    // Open rescheduling and fetch currently available replacement slots.
    if (!booking) return;
    setMode("reschedule");
    setMessage(null);
    setSelectedIds([]);
    try {
      const result = await getAvailability(String(booking.subject.id));
      setSlots(result.slots.filter((slot) => slot.available !== false));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load available times.");
    }
  }

  async function pay() {
    // Confirm payment and replace local state with the confirmed booking.
    if (!booking) return;
    setBusy(true);
    setMessage(null);
    try {
      setBooking(await confirmPayment(booking.id));
      setMessage("Payment confirmed. Your trial lesson is booked.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Payment could not be confirmed.");
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    // The backend cancels, releases slots, and calculates the refund atomically.
    if (!booking) return;
    setBusy(true);
    setMessage(null);
    try {
      setBooking(await cancelBooking(booking.id, reason.trim()));
      setMode(null);
      setMessage("Booking cancelled. The refund, if applicable, was returned to your balance.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not cancel this booking.");
    } finally {
      setBusy(false);
    }
  }

  async function reschedule() {
    // Submit the replacement slots while preserving the lesson duration.
    if (!booking || selectedIds.length === 0) return;
    setBusy(true);
    setMessage(null);
    try {
      setBooking(await rescheduleBooking(booking.id, selectedIds));
      setMode(null);
      setMessage("Your lesson was rescheduled successfully.");
    } catch (error) {
      if (error instanceof BookingApiError && error.status === 409) {
        // Another booking claimed the selected time, so refresh alternatives.
        setMessage("That time is no longer available. The open times have been refreshed.");
        const result = await getAvailability(String(booking.subject.id));
        setSlots(result.slots.filter((slot) => slot.available !== false));
        setSelectedIds([]);
      } else
        setMessage(error instanceof Error ? error.message : "Could not reschedule this booking.");
    } finally {
      setBusy(false);
    }
  }

  // Always display alternative slots in chronological order.
  const sortedSlots = useMemo(
    () =>
      [...slots].sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()),
    [slots]
  );
  if (loading)
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-16 text-zinc-500">
        Loading booking…
      </main>
    );
  if (!booking)
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-16">
        <h1 className="text-2xl font-bold">Booking unavailable</h1>
        {message && (
          <p role="alert" className="mt-3 text-red-600">
            {message}
          </p>
        )}
      </main>
    );
  // Completed and cancelled bookings no longer expose change actions.
  const canChange = booking.status === "CONFIRMED" || booking.status === "PENDING_PAYMENT";

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-10 sm:px-8">
      <Link
        href={`/tutors/${booking.subject.tutor.id}/${booking.subject.id}`}
        className="text-sm text-zinc-600 hover:underline"
      >
        ← Tutor profile
      </Link>
      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-violet-600">
            Trial lesson
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Booking #{booking.id}</h1>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusStyle[booking.status]}`}>
          {booking.status.replaceAll("_", " ")}
        </span>
      </div>
      {message && (
        <p role="status" className="mt-6 rounded-xl bg-violet-50 p-4 text-sm text-violet-900">
          {message}
        </p>
      )}
      <div className="mt-8 grid gap-6 md:grid-cols-[1fr_280px]">
        <section className="rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
          <h2 className="text-xl font-semibold">Lesson details</h2>
          <dl className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-zinc-500">Tutor</dt>
              <dd className="mt-1 font-semibold">{booking.subject.tutor.name}</dd>
            </div>
            <div>
              <dt className="text-sm text-zinc-500">Subject</dt>
              <dd className="mt-1 font-semibold">{booking.subject.name}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm text-zinc-500">Time</dt>
              <dd className="mt-1 font-semibold">
                {startsAt ? dateTime.format(new Date(startsAt)) : "To be confirmed"}
              </dd>
            </div>
            {booking.description && (
              <div className="sm:col-span-2">
                <dt className="text-sm text-zinc-500">Learning goal</dt>
                <dd className="mt-1">{booking.description}</dd>
              </div>
            )}
          </dl>
          {booking.status === "CONFIRMED" && booking.zoomMeetingUrl && (
            <a
              href={booking.zoomMeetingUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex h-11 items-center rounded-full bg-violet-600 px-5 font-semibold text-white"
            >
              Join lesson
            </a>
          )}
        </section>
        <aside className="rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
          <p className="text-sm text-zinc-500">Total</p>
          <p className="mt-1 text-2xl font-bold">{money.format(Number(booking.totalAmount))}</p>
          {booking.status === "PENDING_PAYMENT" && (
            <button
              disabled={busy}
              onClick={() => void pay()}
              className="mt-5 h-11 w-full rounded-full bg-violet-600 font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Processing…" : "Confirm payment"}
            </button>
          )}
          {canChange && (
            <div className="mt-4 grid gap-2">
              <button
                onClick={() => void openReschedule()}
                className="h-10 rounded-full border border-zinc-300 font-medium"
              >
                Reschedule
              </button>
              <button
                onClick={() => {
                  setMode("cancel");
                  setMessage(null);
                }}
                className="h-10 rounded-full border border-red-200 font-medium text-red-700"
              >
                Cancel lesson
              </button>
            </div>
          )}
        </aside>
      </div>
      {mode === "cancel" && (
        <section className="mt-6 rounded-2xl border border-red-200 bg-red-50/50 p-6">
          <h2 className="text-lg font-semibold">Cancel this lesson?</h2>
          <p className="mt-2 text-sm text-zinc-700">
            {lateCancellation
              ? "This lesson starts within 24 hours. Your refund will be reduced by the cancellation fee shown by the policy."
              : "This lesson is more than 24 hours away, so it can be cancelled without penalty."}
          </p>
          <label className="mt-4 block text-sm font-medium">
            Reason <span className="font-normal text-zinc-500">(optional)</span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              className="mt-2 w-full rounded-xl border border-zinc-300 bg-white p-3"
            />
          </label>
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => setMode(null)}
              className="h-10 rounded-full border border-zinc-300 px-5"
            >
              Keep lesson
            </button>
            <button
              disabled={busy}
              onClick={() => void cancel()}
              className="h-10 rounded-full bg-red-600 px-5 font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Cancelling…" : "Confirm cancellation"}
            </button>
          </div>
        </section>
      )}
      {mode === "reschedule" && (
        <section className="mt-6 rounded-2xl border border-violet-200 bg-violet-50/40 p-6">
          <h2 className="text-lg font-semibold">Choose a new time</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Select one or more consecutive 30-minute slots.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {sortedSlots.map((slot) => {
              const active = selectedIds.includes(slot.id);
              return (
                <button
                  key={slot.id}
                  aria-pressed={active}
                  onClick={() =>
                    setSelectedIds((ids) =>
                      active ? ids.filter((value) => value !== slot.id) : [...ids, slot.id]
                    )
                  }
                  className={`rounded-xl border p-3 text-sm font-semibold ${active ? "border-violet-600 bg-violet-600 text-white" : "border-zinc-300 bg-white"}`}
                >
                  {dateTime.format(new Date(slot.startedAt))}
                </button>
              );
            })}
          </div>
          {sortedSlots.length === 0 && (
            <p className="mt-5 text-sm text-zinc-500">No alternative times are available.</p>
          )}
          <div className="mt-5 flex gap-3">
            <button
              onClick={() => setMode(null)}
              className="h-10 rounded-full border border-zinc-300 px-5"
            >
              Close
            </button>
            <button
              disabled={busy || selectedIds.length === 0}
              onClick={() => void reschedule()}
              className="h-10 rounded-full bg-violet-600 px-5 font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Saving…" : "Confirm new time"}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
