"use client";

import { useRef, useState } from "react";
import {
  BookingApiError,
  cancelBooking,
  cancelBookingAsTutor,
  getCancellationQuote,
  getTutorCancellationQuote,
} from "@/src/lib/bookings-api";
import { money } from "@/src/lib/booking-format";
import type { BookingPanelContext } from "@/src/lib/use-booking-detail";
import type { CancellationQuote } from "@/src/types/booking";
import { publishWalletBalance } from "@/src/lib/wallet-api";

function isCancellationQuote(value: unknown): value is CancellationQuote {
  if (!value || typeof value !== "object") return false;
  const quote = value as Partial<CancellationQuote>;
  return typeof quote.token === "string" && typeof quote.refundAmount === "string";
}

// BOOK-3 and BOOK-4: the quote, the optional reason and the cancel call for either role.
export function useCancellation(context: BookingPanelContext, openPanel: (open: boolean) => void) {
  const { booking, busy, setBusy, setBooking, setMessage } = context;
  const [quote, setQuote] = useState<CancellationQuote | null>(null);
  const [reason, setReason] = useState("");
  const [quoteLoading, setQuoteLoading] = useState(false);
  const quoteRequestId = useRef(0);
  const inFlight = useRef(false);
  // BOOK-4: the tutor cancels through their own quote, which always refunds the student in full.
  const isTutorView = booking.viewerRole === "TUTOR";

  async function loadTerms() {
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

  async function open() {
    if (busy || !(booking.actions.canCancel || booking.actions.canTutorCancel)) return;
    openPanel(true);
    setReason("");
    await loadTerms();
  }

  function keep() {
    if (inFlight.current) return;
    quoteRequestId.current += 1;
    openPanel(false);
    setQuote(null);
    setQuoteLoading(false);
    setMessage(null);
  }

  async function confirm() {
    if (!quote || quoteLoading || inFlight.current) return;
    if (isTutorView && !reason.trim()) return;
    inFlight.current = true;
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
      openPanel(false);
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
        } else if (await loadTerms()) {
          setMessage(
            "The cancellation terms changed. Review the updated refund before confirming."
          );
        }
      } else {
        setMessage(error instanceof Error ? error.message : "Could not cancel this booking.");
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return { quote, reason, setReason, quoteLoading, loadTerms, open, keep, confirm };
}

export type CancellationState = ReturnType<typeof useCancellation>;

export function CancelLessonButton({
  context,
  cancellation,
}: {
  context: BookingPanelContext;
  cancellation: CancellationState;
}) {
  const { booking, busy } = context;
  if (!(booking.actions.canCancel || booking.actions.canTutorCancel)) return null;
  return (
    <div className="mt-4 grid gap-2">
      <button
        disabled={busy || cancellation.quoteLoading}
        onClick={() => void cancellation.open()}
        className="h-10 rounded-full border border-red-200 font-medium text-red-700"
      >
        {booking.viewerRole === "TUTOR" ? "Cancel class" : "Cancel lesson"}
      </button>
    </div>
  );
}

export function CancellationPanel({
  context,
  cancellation,
}: {
  context: BookingPanelContext;
  cancellation: CancellationState;
}) {
  const { booking, busy } = context;
  const { quote, reason, setReason, quoteLoading, loadTerms, keep, confirm } = cancellation;
  const isTutorView = booking.viewerRole === "TUTOR";
  return (
    <section className="mt-6 rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
      <h2 className="text-lg font-semibold">
        {isTutorView ? "Cancel this class?" : "Cancel this lesson?"}
      </h2>
      {quoteLoading && (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Loading cancellation terms…</p>
      )}
      {!quoteLoading && !quote && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void loadTerms()}
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
              This class starts within {quote.policyWindowHours} hours. Cancelling this late leaves{" "}
              {booking.student.name} without a lesson at short notice.
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
          onClick={keep}
          className="h-10 rounded-full border border-zinc-300 px-5"
        >
          {isTutorView ? "Keep class" : "Keep lesson"}
        </button>
        <button
          disabled={busy || quoteLoading || !quote || (isTutorView && !reason.trim())}
          onClick={() => void confirm()}
          className="h-10 rounded-full bg-red-600 px-5 font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Cancelling…" : "Confirm cancellation"}
        </button>
      </div>
    </section>
  );
}
