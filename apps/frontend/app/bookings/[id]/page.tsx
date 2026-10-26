"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ContinuousSlotPicker } from "@/src/components/continuous-slot-picker";
import { RequireAuth } from "@/src/components/require-auth";
import {
  BookingApiError,
  cancelBooking,
  cancelBookingAsTutor,
  confirmPayment,
  getAvailability,
  getBooking,
  getCancellationQuote,
  getTutorCancellationQuote,
  rescheduleBooking,
} from "@/src/lib/bookings-api";
import type { AvailabilitySlot, Booking, CancellationQuote } from "@/src/types/booking";
import { publishWalletBalance } from "@/src/lib/wallet-api";

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
  const quoteRequestId = useRef(0);
  const cancellationInFlight = useRef(false);

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
  // BOOK-4: the tutor cancels through their own quote, which always refunds the student in full.
  const isTutorView = booking?.viewerRole === "TUTOR";

  async function loadCancellationTerms() {
    if (!booking) return false;
    const requestId = ++quoteRequestId.current;
    setQuote(null);
    setMessage(null);
    setQuoteLoading(true);
    try {
      const currentQuote = await (isTutorView ? getTutorCancellationQuote : getCancellationQuote)(
        booking.id
      );
      if (requestId !== quoteRequestId.current) return false;
      setQuote(currentQuote);
      return true;
    } catch (error) {
      if (requestId === quoteRequestId.current)
        setMessage(error instanceof Error ? error.message : "Could not load cancellation terms.");
      return false;
    } finally {
      if (requestId === quoteRequestId.current) setQuoteLoading(false);
    }
  }

  async function openCancellation() {
    if (busy || !(booking?.actions.canCancel || booking?.actions.canTutorCancel)) return;
    setMode("cancel");
    setReason("");
    await loadCancellationTerms();
  }

  function keepLesson() {
    if (cancellationInFlight.current) return;
    quoteRequestId.current += 1;
    setMode(null);
    setQuote(null);
    setQuoteLoading(false);
    setMessage(null);
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
      const confirmed = await confirmPayment(booking.id);
      setBooking(confirmed);
      if (confirmed.payment.walletBalance !== null) {
        publishWalletBalance(confirmed.payment.walletBalance);
      }
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
    if (!booking || !quote || quoteLoading || cancellationInFlight.current) return;
    if (isTutorView && !reason.trim()) return;
    cancellationInFlight.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const result = isTutorView
        ? await cancelBookingAsTutor(booking.id, {
            reason: reason.trim(),
            quoteToken: quote.token || undefined,
          })
        : await cancelBooking(booking.id, {
            reason: reason.trim() || undefined,
            quoteToken: quote.token || undefined,
          });
      setBooking(result.booking);
      setMode(null);
      setQuote(null);
      if (result.booking.payment.walletBalance !== null)
        publishWalletBalance(result.booking.payment.walletBalance);
      if (isTutorView)
        setMessage(
          Number(result.refund.amount) > 0
            ? `Class cancelled. ${result.booking.student.name} was refunded ${money.format(Number(result.refund.amount))}.`
            : "Class cancelled. No payment had been made, so no refund was due."
        );
      else
        setMessage(
          Number(result.refund.amount) > 0
            ? `Booking cancelled. ${money.format(Number(result.refund.amount))} was returned to your wallet.`
            : "Booking cancelled. No wallet refund was due."
        );
    } catch (error) {
      if (error instanceof BookingApiError && error.code === "CANCELLATION_QUOTE_CHANGED") {
        const currentQuote = error.details?.currentQuote;
        setQuote(null);
        if (isCancellationQuote(currentQuote)) {
          setQuote(currentQuote);
          setMessage(
            "The cancellation terms changed. Review the updated refund before confirming."
          );
        } else if (await loadCancellationTerms()) {
          setMessage(
            "The cancellation terms changed. Review the updated refund before confirming."
          );
        }
      } else {
        setMessage(error instanceof Error ? error.message : "Could not cancel this booking.");
      }
    } finally {
      cancellationInFlight.current = false;
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
      {booking.status === "CANCELLED" && booking.cancelledBy === "TUTOR" && (
        <div className="mt-6 rounded-2xl border border-zinc-200 p-4 text-sm dark:border-zinc-800">
          <p className="font-semibold">
            {isTutorView ? "You cancelled this class." : "Your tutor cancelled this lesson."}
          </p>
          {booking.cancellationReason && <p className="mt-1">{booking.cancellationReason}</p>}
        </div>
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
          {(booking.actions.canCancel ||
            booking.actions.canReschedule ||
            booking.actions.canTutorCancel) && (
            <div className="mt-4 grid gap-2">
              {booking.actions.canReschedule && (
                <button
                  disabled={busy}
                  onClick={() => void openReschedule()}
                  className="h-10 rounded-full border border-zinc-300 font-medium"
                >
                  Reschedule
                </button>
              )}
              {(booking.actions.canCancel || booking.actions.canTutorCancel) && (
                <button
                  disabled={busy || quoteLoading}
                  onClick={() => void openCancellation()}
                  className="h-10 rounded-full border border-red-200 font-medium text-red-700"
                >
                  {isTutorView ? "Cancel class" : "Cancel lesson"}
                </button>
              )}
            </div>
          )}
        </aside>
      </div>

      {mode === "cancel" && (
        <section className="mt-6 rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
          <h2 className="text-lg font-semibold">
            {isTutorView ? "Cancel this class?" : "Cancel this lesson?"}
          </h2>
          {quoteLoading && (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Loading cancellation terms…
            </p>
          )}
          {!quoteLoading && !quote && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void loadCancellationTerms()}
              className="mt-3 text-sm font-semibold text-red-700 underline disabled:opacity-50"
            >
              Retry cancellation terms
            </button>
          )}
          {quote && isTutorView && (
            <>
              {quote.lateCancellation ? (
                <p
                  role="alert"
                  className="mt-2 rounded-xl border border-amber-300 p-3 text-sm text-amber-800 dark:border-amber-700 dark:text-amber-300"
                >
                  This class starts within {quote.policyWindowHours} hours. Cancelling this late
                  leaves {booking.student.name} without a lesson at short notice.
                </p>
              ) : (
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  This class is more than {quote.policyWindowHours} hours away.
                </p>
              )}
              <dl className="mt-4 grid gap-3 rounded-xl border border-zinc-200 p-4 text-sm dark:border-zinc-800 sm:grid-cols-2">
                <div>
                  <dt className="text-zinc-500">Student&apos;s payment</dt>
                  <dd className="font-semibold">{money.format(Number(quote.originalAmount))}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Refund to the student&apos;s wallet</dt>
                  <dd className="font-semibold">{money.format(Number(quote.refundAmount))}</dd>
                </div>
              </dl>
            </>
          )}
          {quote && !isTutorView && (
            <>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {quote.lateCancellation
                  ? `This lesson is within the ${quote.policyWindowHours}-hour policy window.`
                  : `This lesson is outside the ${quote.policyWindowHours}-hour policy window.`}
              </p>
              <dl className="mt-4 grid gap-3 rounded-xl border border-zinc-200 p-4 text-sm dark:border-zinc-800 sm:grid-cols-2">
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
            {isTutorView ? (
              <>
                Reason <span className="font-normal text-zinc-500">(shown to the student)</span>
              </>
            ) : (
              <>
                Reason <span className="font-normal text-zinc-500">(optional)</span>
              </>
            )}
            <textarea
              maxLength={500}
              disabled={busy}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              className="mt-2 w-full rounded-xl border border-zinc-300 bg-transparent p-3 dark:border-zinc-700"
            />
          </label>
          <div className="mt-4 flex gap-3">
            <button
              disabled={busy}
              onClick={keepLesson}
              className="h-10 rounded-full border border-zinc-300 px-5"
            >
              {isTutorView ? "Keep class" : "Keep lesson"}
            </button>
            <button
              disabled={busy || quoteLoading || !quote || (isTutorView && !reason.trim())}
              onClick={() => void cancel()}
              className="h-10 rounded-full bg-red-600 px-5 font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Cancelling…" : "Confirm cancellation"}
            </button>
          </div>
        </section>
      )}

      {mode === "reschedule" && (
        <section className="mt-6 rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
          <h2 className="text-lg font-semibold">Choose a new time</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
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
