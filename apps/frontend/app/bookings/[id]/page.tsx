"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ContinuousSlotPicker } from "@/src/components/continuous-slot-picker";
import { RequireAuth } from "@/src/components/require-auth";
import {
  BookingApiError,
  cancelBooking,
  confirmPayment,
  getAvailability,
  getBooking,
  getCancellationQuote,
  rescheduleBooking,
} from "@/src/lib/bookings-api";
import type { AvailabilitySlot, Booking, CancellationQuote } from "@/src/types/booking";

const TIME_ZONE = "Asia/Bangkok";
const money = new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" });
const dateTime = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});
const statusStyle: Record<Booking["status"], string> = {
  PENDING_PAYMENT: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-emerald-100 text-emerald-800",
  COMPLETED: "bg-blue-100 text-blue-800",
  CANCELLED: "bg-zinc-200 text-zinc-700",
};

function isCancellationQuote(value: unknown): value is CancellationQuote {
  if (!value || typeof value !== "object") return false;
  const quote = value as Partial<CancellationQuote>;
  return typeof quote.token === "string" && typeof quote.refundAmount === "string";
}

function BookingDetailContent() {
  const { id } = useParams<{ id: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mode, setMode] = useState<"cancel" | "reschedule" | null>(null);
  const [quote, setQuote] = useState<CancellationQuote | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadBooking = useCallback(async () => {
    try {
      setBooking(await getBooking(id));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load this booking.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // Fetching the route-specific booking is the synchronization performed by this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadBooking();
  }, [loadBooking]);

  const requiredSlotCount = booking?.availabilities.length ?? 0;
  const startsAt = booking?.startedAt ?? booking?.availabilities[0]?.startedAt;
  const isExpired =
    booking?.status === "CANCELLED" && booking.cancellationReason === "PAYMENT_EXPIRED";

  async function openCancellation() {
    if (!booking) return;
    setMode("cancel");
    setQuote(null);
    setMessage(null);
    setQuoteLoading(true);
    try {
      setQuote(await getCancellationQuote(booking.id));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load cancellation terms.");
    } finally {
      setQuoteLoading(false);
    }
  }

  async function openReschedule() {
    if (!booking) return;
    setMode("reschedule");
    setMessage(null);
    setSelectedIds([]);
    try {
      const result = await getAvailability(booking.subject.id);
      setSlots(result.slots.filter((slot) => slot.available !== false));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load available times.");
    }
  }

  async function pay() {
    if (!booking || !booking.actions.canPay || !booking.payment.canPay) return;
    setBusy(true);
    setMessage(null);
    try {
      setBooking(await confirmPayment(booking.id));
      setMessage("Payment confirmed. Your trial lesson is booked.");
    } catch (error) {
      if (error instanceof BookingApiError && error.code === "BOOKING_EXPIRED") {
        setMessage("This payment hold expired, so the selected times were released.");
        await loadBooking();
      } else if (error instanceof BookingApiError && error.code === "BOOKING_ALREADY_PAID") {
        setMessage("This booking has already been paid.");
        await loadBooking();
      } else if (error instanceof BookingApiError && error.code === "INSUFFICIENT_BALANCE") {
        setMessage("Your wallet balance is not enough to pay for this booking.");
        await loadBooking();
      } else {
        setMessage(error instanceof Error ? error.message : "Payment could not be confirmed.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!booking || !quote) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await cancelBooking(booking.id, {
        reason: reason.trim() || undefined,
        quoteToken: quote.token || undefined,
      });
      setBooking(result.booking);
      setMode(null);
      setQuote(null);
      setMessage(
        `Booking cancelled. ${money.format(Number(result.refund.amount))} was returned to your balance.`
      );
    } catch (error) {
      if (error instanceof BookingApiError && error.code === "CANCELLATION_QUOTE_CHANGED") {
        const currentQuote = error.details?.currentQuote;
        if (isCancellationQuote(currentQuote)) setQuote(currentQuote);
        else setQuote(await getCancellationQuote(booking.id));
        setMessage("The cancellation terms changed. Review the updated refund before confirming.");
      } else {
        setMessage(error instanceof Error ? error.message : "Could not cancel this booking.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function reschedule() {
    if (!booking || selectedIds.length !== requiredSlotCount) return;
    setBusy(true);
    setMessage(null);
    try {
      setBooking(await rescheduleBooking(booking.id, selectedIds));
      setMode(null);
      setMessage("Your lesson was rescheduled successfully.");
    } catch (error) {
      if (error instanceof BookingApiError && error.code === "SLOT_TAKEN") {
        setMessage("That time is no longer available. The open times have been refreshed.");
        const result = await getAvailability(booking.subject.id);
        setSlots(result.slots.filter((slot) => slot.available !== false));
        setSelectedIds([]);
      } else if (error instanceof BookingApiError && error.code === "INVALID_SLOT_BLOCK") {
        setMessage("Choose the required number of consecutive times on the same day.");
      } else {
        setMessage(error instanceof Error ? error.message : "Could not reschedule this booking.");
      }
    } finally {
      setBusy(false);
    }
  }

  const sortedSlots = useMemo(
    () =>
      [...slots].sort(
        (left, right) => new Date(left.startedAt).getTime() - new Date(right.startedAt).getTime()
      ),
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

  const shortfall = Number(booking.payment.shortfall ?? 0);
  const topUpHref = `/wallet/topup?${new URLSearchParams({
    amount: String(shortfall),
    returnTo: `/bookings/${booking.id}`,
  }).toString()}`;
  const displayStatus = isExpired ? "EXPIRED" : booking.status.replaceAll("_", " ");

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
            {booking.isTrial ? "Trial lesson" : "Lesson"}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Booking #{booking.id}</h1>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusStyle[booking.status]}`}>
          {displayStatus}
        </span>
      </div>
      {isExpired && (
        <p role="status" className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          The payment hold expired and the selected times were released.
        </p>
      )}
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
          {booking.status === "PENDING_PAYMENT" && booking.payment.expiresAt && (
            <p className="mt-2 text-xs text-zinc-500">
              Payment hold expires {dateTime.format(new Date(booking.payment.expiresAt))}
            </p>
          )}
          {booking.status === "PENDING_PAYMENT" && booking.payment.walletBalance !== null && (
            <button
              disabled={busy || !booking.actions.canPay || !booking.payment.canPay}
              onClick={() => void pay()}
              className="mt-5 h-11 w-full rounded-full bg-violet-600 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Processing…" : "Confirm payment"}
            </button>
          )}
          {booking.status === "PENDING_PAYMENT" && shortfall > 0 && (
            <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
              <p>You need {money.format(shortfall)} more to pay.</p>
              <Link href={topUpHref} className="mt-2 inline-block font-semibold underline">
                Top up {money.format(shortfall)}
              </Link>
            </div>
          )}
          {(booking.actions.canCancel || booking.actions.canReschedule) && (
            <div className="mt-4 grid gap-2">
              {booking.actions.canReschedule && (
                <button
                  onClick={() => void openReschedule()}
                  className="h-10 rounded-full border border-zinc-300 font-medium"
                >
                  Reschedule
                </button>
              )}
              {booking.actions.canCancel && (
                <button
                  onClick={() => void openCancellation()}
                  className="h-10 rounded-full border border-red-200 font-medium text-red-700"
                >
                  Cancel lesson
                </button>
              )}
            </div>
          )}
        </aside>
      </div>

      {mode === "cancel" && (
        <section className="mt-6 rounded-2xl border border-red-200 bg-red-50/50 p-6">
          <h2 className="text-lg font-semibold">Cancel this lesson?</h2>
          {quoteLoading && (
            <p className="mt-2 text-sm text-zinc-600">Loading cancellation terms…</p>
          )}
          {quote && (
            <>
              <p className="mt-2 text-sm text-zinc-700">
                {quote.lateCancellation
                  ? `This lesson is within the ${quote.policyWindowHours}-hour policy window.`
                  : `This lesson is outside the ${quote.policyWindowHours}-hour policy window.`}
              </p>
              <dl className="mt-4 grid gap-3 rounded-xl bg-white p-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-zinc-500">Original payment</dt>
                  <dd className="font-semibold">{money.format(Number(quote.originalAmount))}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Refund rate</dt>
                  <dd className="font-semibold">{Math.round(quote.refundRate * 100)}%</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Cancellation fee</dt>
                  <dd className="font-semibold">{money.format(Number(quote.cancellationFee))}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Refund to your wallet</dt>
                  <dd className="font-semibold">{money.format(Number(quote.refundAmount))}</dd>
                </div>
              </dl>
            </>
          )}
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
              disabled={busy || !quote}
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
            Choose exactly {requiredSlotCount} consecutive 30-minute
            {requiredSlotCount === 1 ? " slot" : " slots"} on the same day.
          </p>
          <div className="mt-5">
            <ContinuousSlotPicker
              slots={sortedSlots}
              selectedIds={selectedIds}
              onChange={setSelectedIds}
              onSelectionMessage={setMessage}
              requiredCount={requiredSlotCount}
              timeZone={TIME_ZONE}
            />
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
              disabled={busy || selectedIds.length !== requiredSlotCount}
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

export default function BookingDetailPage() {
  return (
    <RequireAuth>
      <BookingDetailContent />
    </RequireAuth>
  );
}
