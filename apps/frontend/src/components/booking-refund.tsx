"use client";

import { useState } from "react";
import { BookingApiError, requestRefund } from "@/src/lib/bookings-api";
import { money } from "@/src/lib/booking-format";
import { refundReasonLabels } from "@/src/lib/refunds-api";
import type { BookingPanelContext } from "@/src/lib/use-booking-detail";
import type { RefundRequestReason } from "@/src/types/booking";

// PAY-3: the reasons a Student can give; an admin decides every request.
const REFUND_OPTIONS: Array<{ reason: RefundRequestReason; label: string }> = [
  { reason: "TUTOR_NO_SHOW", label: "My tutor didn't show up" },
  { reason: "UNSATISFACTORY_LESSON", label: "The lesson was unsatisfactory" },
  { reason: "OTHER", label: "Other" },
];

export function useRefundRequest(context: BookingPanelContext, openPanel: (open: boolean) => void) {
  const { booking, busy, setBusy, setBooking, setMessage, reload } = context;
  const [reason, setReason] = useState<RefundRequestReason | null>(null);
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);

  function open() {
    if (busy || !booking.actions.canRequestRefund) return;
    openPanel(true);
    setReason(null);
    setDetails("");
    setError(null);
    setMessage(null);
  }

  // PAY-3: every request goes to an admin; only a no-show may be sent without an explanation.
  async function submit() {
    if (!reason || busy) return;
    const trimmed = details.trim();
    if (reason !== "TUTOR_NO_SHOW" && !trimmed) {
      setError("Tell us what went wrong with the lesson.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await requestRefund(booking.id, {
        reason,
        ...(trimmed ? { details: trimmed } : {}),
      });
      setBooking(updated);
      openPanel(false);
      setMessage("Refund request sent. An admin will review it and you'll see the decision here.");
    } catch (failure) {
      const errorMessage =
        failure instanceof Error ? failure.message : "Could not send your refund request.";
      if (failure instanceof BookingApiError && failure.code?.startsWith("REFUND_")) {
        // The lesson changed (for example, it was already refunded); show why on the page.
        openPanel(false);
        setMessage(errorMessage);
        await reload();
      } else {
        setError(errorMessage);
      }
    } finally {
      setBusy(false);
    }
  }

  return { reason, setReason, details, setDetails, error, open, submit };
}

export type RefundRequestState = ReturnType<typeof useRefundRequest>;

export function RefundRequestPanel({
  context,
  refund,
  onClose,
}: {
  context: BookingPanelContext;
  refund: RefundRequestState;
  onClose: () => void;
}) {
  const { booking, busy } = context;
  const { reason, setReason, details, setDetails, error, submit } = refund;
  return (
    <section
      aria-labelledby="refund-request-title"
      className="mt-6 rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800"
    >
      <h2 id="refund-request-title" className="text-lg font-semibold">
        Request a refund
      </h2>
      <p className="mt-2 text-sm text-zinc-500">
        An admin reviews every request. If it&apos;s approved, the full{" "}
        {money.format(Number(booking.totalAmount))} goes back to your wallet.
      </p>
      <fieldset disabled={busy} className="mt-4 grid gap-3">
        <legend className="text-sm font-medium">What happened?</legend>
        {REFUND_OPTIONS.map((option) => (
          <label
            key={option.reason}
            className="flex gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800"
          >
            <input
              type="radio"
              name="refund-reason"
              checked={reason === option.reason}
              onChange={() => setReason(option.reason)}
            />
            <span className="font-medium">{option.label}</span>
          </label>
        ))}
      </fieldset>
      <label className="mt-4 block text-sm font-medium">
        What went wrong?{" "}
        <span className="font-normal text-zinc-500">
          {reason === "TUTOR_NO_SHOW" ? "(optional)" : "(required)"}
        </span>
        <textarea
          maxLength={1000}
          disabled={busy}
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          rows={4}
          className="mt-2 w-full rounded-xl border border-zinc-300 bg-transparent p-3 dark:border-zinc-700"
        />
      </label>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="mt-4 flex gap-3">
        <button
          disabled={busy}
          onClick={onClose}
          className="h-10 rounded-full border border-zinc-300 px-5"
        >
          Close
        </button>
        <button
          disabled={busy || !reason}
          onClick={() => void submit()}
          className="h-10 rounded-full bg-violet-600 px-5 font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Sending…" : "Send refund request"}
        </button>
      </div>
    </section>
  );
}

// PAY-3: the Student's refund request and its status, or the action to request one.
export function StudentRefundStatus({
  context,
  refund,
}: {
  context: BookingPanelContext;
  refund: RefundRequestState;
}) {
  const { booking, busy } = context;
  const request = booking.refundRequest;
  if (!request && !booking.actions.canRequestRefund) return null;
  return (
    <section
      aria-label="Refund"
      className="mt-5 border-t border-zinc-200 pt-5 dark:border-zinc-800"
    >
      {request ? (
        <>
          <h3 className="font-semibold">
            {request.status === "PENDING"
              ? "Refund under review"
              : request.status === "APPROVED"
                ? "Refunded"
                : "Refund request rejected"}
          </h3>
          <p className="mt-2 text-sm text-zinc-500">
            {request.status === "PENDING"
              ? `An admin is reviewing your request for ${money.format(Number(request.amount))}.`
              : request.status === "APPROVED"
                ? `${money.format(Number(request.amount))} was returned to your wallet.`
                : "An admin reviewed your request and did not approve a refund."}
          </p>
          {request.status === "REJECTED" && request.rejectionReason && (
            <p className="mt-2 text-sm">Reason: {request.rejectionReason}</p>
          )}
        </>
      ) : (
        <>
          <h3 className="font-semibold">Problem with this lesson?</h3>
          <p className="mt-2 text-sm text-zinc-500">
            If your tutor didn&apos;t show up or something went wrong, you can ask an admin for a
            full refund.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={refund.open}
            className="mt-3 h-10 w-full rounded-full border border-zinc-300 font-medium disabled:opacity-50"
          >
            Request a refund
          </button>
        </>
      )}
    </section>
  );
}

// PAY-3: the Tutor sees that a request exists and its outcome, not the Student's text.
export function TutorRefundNote({ context }: { context: BookingPanelContext }) {
  const { booking } = context;
  const request = booking.refundRequest;
  if (!request) return null;
  return (
    <section
      aria-label="Refund request"
      className="mt-5 border-t border-zinc-200 pt-5 dark:border-zinc-800"
    >
      <h3 className="font-semibold">Refund requested</h3>
      <p className="mt-2 text-sm text-zinc-500">
        {booking.student.name} asked for a refund:{" "}
        {refundReasonLabels[request.reason].toLowerCase()}.{" "}
        {request.status === "PENDING"
          ? "An admin is reviewing it, so you can't confirm this lesson yet."
          : request.status === "APPROVED"
            ? "The Student was refunded in full and this lesson was cancelled."
            : "An admin rejected the request, so you can confirm this lesson."}
      </p>
    </section>
  );
}
