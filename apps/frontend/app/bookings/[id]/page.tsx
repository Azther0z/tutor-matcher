"use client";

import Link from "next/link";
import styles from "@/src/components/student-layout.module.css";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { BookingReviewSection } from "@/src/components/booking-review";
import { BookingProgress } from "@/src/components/booking-flow";
import { RequireAuth } from "@/src/components/require-auth";
import { TutorDialog } from "@/src/components/tutor-dialog";
import {
  BookingApiError,
  cancelBooking,
  cancelBookingAsTutor,
  confirmBookingCompletion,
  confirmPayment,
  getBooking,
  getCancellationQuote,
  getTutorCancellationQuote,
  requestRefund,
  updateMeetingLink,
} from "@/src/lib/bookings-api";
import type { Booking, CancellationQuote, RefundRequestReason } from "@/src/types/booking";
import { refundReasonLabels } from "@/src/lib/refunds-api";
import { publishWalletBalance } from "@/src/lib/wallet-api";

const TIME_ZONE = "Asia/Bangkok";
const dialogSecondary =
  "inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border border-line px-5 text-sm font-semibold hover:bg-surface-muted disabled:opacity-50 sm:flex-none";
const dialogPrimary =
  "inline-flex min-h-11 flex-1 items-center justify-center rounded-lg bg-brand-navy px-5 text-sm font-semibold text-white hover:bg-brand-navy-dark disabled:opacity-50 sm:flex-none";
const dialogField =
  "mt-2 w-full rounded-lg border border-line bg-transparent px-3 py-2 text-sm leading-6 focus-visible:outline-2 focus-visible:outline-brand-link";

const MAX_MEETING_URL_LENGTH = 2048;
const MAX_TIMEOUT_DELAY = 2_147_483_647;
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
// PAY-3: the reasons a Student can give; an admin decides every request.
const REFUND_OPTIONS: Array<{ reason: RefundRequestReason; label: string }> = [
  { reason: "TUTOR_NO_SHOW", label: "My tutor didn't show up" },
  { reason: "UNSATISFACTORY_LESSON", label: "The lesson was unsatisfactory" },
  { reason: "OTHER", label: "Other" },
];

function isCancellationQuote(value: unknown): value is CancellationQuote {
  if (!value || typeof value !== "object") return false;
  const quote = value as Partial<CancellationQuote>;
  return typeof quote.token === "string" && typeof quote.refundAmount === "string";
}

function meetingUrlValidationMessage(value: string) {
  if (value.length > MAX_MEETING_URL_LENGTH) {
    return `Meeting links must be ${MAX_MEETING_URL_LENGTH} characters or fewer.`;
  }

  try {
    if (new URL(value).protocol === "https:") return null;
  } catch {
    // The URL constructor rejects relative, malformed, and incomplete URLs.
  }

  return "Enter a valid HTTPS meeting link.";
}

function BookingDetailContent() {
  const { id } = useParams<{ id: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [mode, setMode] = useState<"cancel" | "refund" | null>(null);
  const [refundReason, setRefundReason] = useState<RefundRequestReason | null>(null);
  const [refundDetails, setRefundDetails] = useState("");
  const [refundError, setRefundError] = useState<string | null>(null);
  const [quote, setQuote] = useState<CancellationQuote | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [slotUnavailable, setSlotUnavailable] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [meetingUrlDraft, setMeetingUrlDraft] = useState("");
  const [meetingLinkBusy, setMeetingLinkBusy] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const paymentInFlight = useRef(false);
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [clientNow, setClientNow] = useState(() => Date.now());
  const quoteRequestId = useRef(0);
  const cancellationInFlight = useRef(false);

  const loadBooking = useCallback(async () => {
    try {
      const result = await getBooking(id);
      setBooking(result);
      setMeetingUrlDraft(result.customMeetingUrl ?? "");
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

  useEffect(() => {
    const endedAt = booking ? new Date(booking.endedAt).getTime() : Number.NaN;
    const hasTimeSensitiveActions = Boolean(
      booking?.actions.canJoin || booking?.actions.canEditMeetingLink
    );
    if (!hasTimeSensitiveActions || !Number.isFinite(endedAt) || endedAt <= clientNow) return;

    const refreshClientTime = () => setClientNow(Date.now());
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refreshClientTime();
    };
    const delay = Math.min(Math.max(endedAt - Date.now(), 0), MAX_TIMEOUT_DELAY);
    const timeout = window.setTimeout(refreshClientTime, delay);
    window.addEventListener("focus", refreshClientTime);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("focus", refreshClientTime);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [booking, clientNow]);

  useEffect(() => {
    if (booking?.viewerRole !== "TUTOR" || booking.status !== "CONFIRMED") return;

    const endedAt = new Date(booking.endedAt).getTime();
    if (endedAt <= Date.now()) return;

    const refreshBookingAtEnd = () => {
      setClientNow(Date.now());
      void loadBooking();
    };
    let endTimer: number;
    const scheduleRefreshAtEnd = () => {
      const remaining = endedAt - Date.now() + 250;
      endTimer = window.setTimeout(
        () => {
          if (Date.now() >= endedAt) refreshBookingAtEnd();
          else scheduleRefreshAtEnd();
        },
        Math.min(remaining, 2_147_483_647)
      );
    };
    scheduleRefreshAtEnd();
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible" && Date.now() >= endedAt) {
        refreshBookingAtEnd();
      }
    };

    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearTimeout(endTimer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [booking?.endedAt, booking?.status, booking?.viewerRole, loadBooking]);

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

  async function pay() {
    if (
      !booking ||
      busy ||
      paymentInFlight.current ||
      slotUnavailable ||
      isExpired ||
      !booking.actions.canPay ||
      !booking.payment.canPay
    )
      return;
    paymentInFlight.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const confirmed = await confirmPayment(booking.id);
      setBooking(confirmed);
      setPaymentDialogOpen(false);
      if (confirmed.payment.walletBalance !== null) {
        publishWalletBalance(confirmed.payment.walletBalance);
      }
      setMessage("Payment confirmed. Your lesson is booked.");
    } catch (error) {
      if (error instanceof BookingApiError && error.code === "BOOKING_EXPIRED") {
        setMessage("This payment request expired. Choose an available time to try again.");
        await loadBooking();
      } else if (error instanceof BookingApiError && error.code === "SLOT_TAKEN") {
        setSlotUnavailable(true);
        setMessage(
          "These times are no longer available. Your wallet was not charged. Choose another time."
        );
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
      paymentInFlight.current = false;
      setBusy(false);
    }
  }

  async function confirmCompletion() {
    if (!booking?.actions.canConfirmCompletion || busy) return;
    setBusy(true);
    setMessage(null);
    setCompletionError(null);
    try {
      setBooking(await confirmBookingCompletion(booking.id));
      setCompletionDialogOpen(false);
      setMessage("Session marked completed.");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Could not confirm this lesson.";
      let refreshedBooking: Booking | null = null;
      try {
        refreshedBooking = await getBooking(booking.id);
        setBooking(refreshedBooking);
        setMeetingUrlDraft(refreshedBooking.customMeetingUrl ?? "");
      } catch {
        // Keep the retryable confirmation failure visible in the open dialog.
      }

      const errorCode = error instanceof BookingApiError ? error.code : undefined;
      if (errorCode === "BOOKING_ALREADY_COMPLETED" || refreshedBooking?.status === "COMPLETED") {
        setCompletionDialogOpen(false);
        setMessage("This lesson has already been completed.");
      } else if (errorCode === "BOOKING_CANCELLED" || refreshedBooking?.status === "CANCELLED") {
        setCompletionDialogOpen(false);
        setMessage("This booking was cancelled.");
      } else if (!refreshedBooking?.actions.canConfirmCompletion) {
        setCompletionDialogOpen(false);
        setMessage(errorMessage);
      } else {
        setCompletionError(errorMessage);
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

  function openRefund() {
    if (busy || !booking?.actions.canRequestRefund) return;
    setMode("refund");
    setRefundReason(null);
    setRefundDetails("");
    setRefundError(null);
    setMessage(null);
  }

  // PAY-3: every request goes to an admin; only a no-show may be sent without an explanation.
  async function submitRefund() {
    if (!booking || !refundReason || busy) return;
    const details = refundDetails.trim();
    if (refundReason !== "TUTOR_NO_SHOW" && !details) {
      setRefundError("Tell us what went wrong with the lesson.");
      return;
    }
    setBusy(true);
    setRefundError(null);
    setMessage(null);
    try {
      const updated = await requestRefund(booking.id, {
        reason: refundReason,
        ...(details ? { details } : {}),
      });
      setBooking(updated);
      setMode(null);
      setMessage("Refund request sent. An admin will review it and you'll see the decision here.");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Could not send your refund request.";
      if (error instanceof BookingApiError && error.code?.startsWith("REFUND_")) {
        // The lesson changed (for example, it was already refunded); show why on the page.
        setMode(null);
        setMessage(errorMessage);
        await loadBooking();
      } else {
        setRefundError(errorMessage);
      }
    } finally {
      setBusy(false);
    }
  }

  async function saveMeetingLink(customMeetingUrl: string | null) {
    if (!booking || !booking.actions.canEditMeetingLink || meetingLinkBusy) return;
    if (customMeetingUrl !== null) {
      const validationMessage = meetingUrlValidationMessage(customMeetingUrl);
      if (validationMessage) {
        setMessage(validationMessage);
        return;
      }
    }

    setMeetingLinkBusy(true);
    setMessage(null);
    try {
      const updated = await updateMeetingLink(booking.id, customMeetingUrl);
      setBooking(updated);
      setMeetingUrlDraft(updated.customMeetingUrl ?? "");
      setMessage(
        customMeetingUrl === null
          ? updated.zoomMeetingUrl
            ? "Tutor link removed. The generated meeting link is restored."
            : "Tutor link removed. No meeting link is available yet."
          : "Meeting link updated."
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update the meeting link.");
      if (
        error instanceof BookingApiError &&
        (error.status === 403 ||
          error.status === 404 ||
          (error.status === 409 && error.code === "MEETING_LINK_NOT_EDITABLE"))
      ) {
        await loadBooking();
      }
    } finally {
      setMeetingLinkBusy(false);
    }
  }

  if (loading)
    return (
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-4xl flex-1 px-6 py-16 text-muted"
      >
        Loading booking…
      </main>
    );
  if (!booking)
    return (
      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-4xl flex-1 px-6 py-16">
        <h1 className="text-2xl font-semibold">Booking unavailable</h1>
        {message && (
          <p role="alert" className="mt-3 text-red-600">
            {message}
          </p>
        )}
      </main>
    );

  const shortfall = Number(booking.payment.shortfall ?? 0);
  const beforeLessonEnd = new Date(booking.endedAt).getTime() > clientNow;
  const canJoinLesson = booking.actions.canJoin && beforeLessonEnd;
  const canEditMeetingLink = booking.actions.canEditMeetingLink && beforeLessonEnd;
  const canConfirmCompletion = booking.actions.canConfirmCompletion && !beforeLessonEnd;
  const topUpHref = `/wallet/topup?${new URLSearchParams({
    amount: String(shortfall),
    returnTo: `/bookings/${booking.id}`,
  }).toString()}`;
  const isStudentDetails = !isTutorView;
  const displayStatus = isExpired ? "EXPIRED" : booking.status.replaceAll("_", " ");
  const progressStep: 2 | 3 | 4 =
    booking.status === "COMPLETED"
      ? 4
      : booking.status === "CONFIRMED"
        ? 3
        : booking.status === "CANCELLED" && booking.payment.status === "COMPLETED"
          ? 3
          : 2;

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className={`mx-auto w-full max-w-[68rem] flex-1 px-4 py-6 sm:px-6 lg:px-8 ${!isTutorView && booking.status === "PENDING_PAYMENT" ? "pb-40" : ""}`}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold leading-tight tracking-tight">
          {booking.subject.name}
        </h1>
        <p className="text-sm font-medium text-secondary">
          {displayStatus.charAt(0) + displayStatus.slice(1).toLowerCase()}
        </p>
      </header>
      <div className="mt-4">
        <BookingProgress status={booking.status} currentStep={progressStep} />
      </div>
      {isExpired && (
        <p role="status" className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          This payment request expired. Choose an available time to try again.
        </p>
      )}
      {booking.status === "CANCELLED" && booking.cancelledBy === "TUTOR" && (
        <div className="mt-6 rounded-2xl border border-line bg-surface p-4 text-sm">
          <p className="font-semibold">
            {isTutorView ? "You cancelled this class." : "Your tutor cancelled this lesson."}
          </p>
          {booking.cancellationReason && <p className="mt-1">{booking.cancellationReason}</p>}
        </div>
      )}
      {slotUnavailable && (
        <Link
          className="mt-4 inline-block text-brand-link underline"
          href={`/tutors/${booking.subject.tutor.id}/${booking.subject.id}`}
        >
          Choose another time
        </Link>
      )}
      {message && !paymentDialogOpen && (
        <p role="status" className="mt-6 rounded-xl bg-brand-soft p-4 text-sm text-brand-link">
          {message}
        </p>
      )}
      <div
        className={
          isStudentDetails
            ? "mt-6 flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4 sm:p-5"
            : isTutorView
              ? "mt-8 grid gap-6 md:grid-cols-[1fr_280px]"
              : "mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]"
        }
      >
        <section
          className={
            isStudentDetails
              ? "min-w-0"
              : isTutorView
                ? "min-w-0 md:col-start-1 md:row-start-1 rounded-2xl border border-line bg-surface p-4 sm:p-5"
                : "min-w-0 rounded-2xl border border-line bg-surface p-4 sm:p-5"
          }
        >
          <h2 className="text-xl font-semibold">Lesson details</h2>
          <dl className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted">{isTutorView ? "Student" : "Tutor"}</dt>
              <dd className="mt-1 font-semibold">
                {isTutorView ? booking.student.name : booking.subject.tutor.name}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Fields</dt>
              <dd className="mt-1 font-semibold">
                {booking.subject.learningAreas?.map((area) => area.name).join(", ") ||
                  "Not specified"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Format</dt>
              <dd className="mt-1 font-semibold">
                {booking.subject.format === "ONLINE" ? "Online" : booking.subject.format}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Time</dt>
              <dd className="mt-1 font-semibold">
                {startsAt
                  ? dateTime.formatRange(new Date(startsAt), new Date(booking.endedAt))
                  : "To be confirmed"}
              </dd>
            </div>
            {booking.description && (
              <div className="sm:col-span-2">
                <dt className="text-sm text-muted">Learning goal</dt>
                <dd className="mt-1">{booking.description}</dd>
              </div>
            )}
          </dl>
          {!isTutorView && booking.status === "CONFIRMED" ? (
            <>
              <p className="mt-5 text-sm text-muted">
                Total paid{" "}
                <span className="ml-2 font-semibold text-foreground">
                  {money.format(Number(booking.totalAmount))}
                </span>
              </p>
              <div className="mt-5 flex items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={
                    busy ||
                    quoteLoading ||
                    (!booking.actions.canCancel && !booking.actions.canRequestRefund)
                  }
                  onClick={() => {
                    if (booking.actions.canCancel) void openCancellation();
                    else if (booking.actions.canRequestRefund) openRefund();
                  }}
                  className="flex min-h-11 items-center justify-center rounded-lg border border-line px-5 text-sm font-semibold text-red-700 hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Refund
                </button>
                {canJoinLesson && booking.effectiveMeetingUrl ? (
                  <a
                    href={booking.effectiveMeetingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-navy px-5 text-sm font-semibold text-white hover:bg-brand-navy-dark"
                  >
                    Join meeting
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="inline-flex min-h-11 cursor-not-allowed items-center justify-center rounded-lg bg-brand-navy px-5 text-sm font-semibold text-white opacity-50"
                  >
                    Join meeting
                  </button>
                )}
              </div>
            </>
          ) : canJoinLesson && booking.effectiveMeetingUrl ? (
            <a
              href={booking.effectiveMeetingUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex h-11 items-center rounded-lg bg-brand-navy px-5 font-semibold text-white"
            >
              Join meeting
            </a>
          ) : null}
          {canConfirmCompletion && (
            <div className="mt-6 border-t border-line pt-5">
              <h3 className="font-semibold">Confirm this lesson</h3>
              <p className="mt-1 text-sm text-muted">
                The scheduled lesson time has ended. Confirm when the session is complete.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setCompletionError(null);
                  setCompletionDialogOpen(true);
                }}
                className="mt-3 h-11 rounded-lg bg-brand-navy px-5 font-semibold text-white disabled:opacity-50"
              >
                Confirm session completed
              </button>
            </div>
          )}
          {canEditMeetingLink && (
            <div className="mt-6 border-t border-line pt-5">
              <label htmlFor="custom-meeting-url" className="block text-sm font-semibold">
                {booking.customMeetingUrl ? "Replace meeting link" : "Add meeting link"}
              </label>
              <p className="mt-1 text-sm text-muted">
                Enter an HTTPS meeting link. The link is not checked with the provider.
              </p>
              <input
                id="custom-meeting-url"
                type="url"
                inputMode="url"
                autoComplete="url"
                value={meetingUrlDraft}
                onChange={(event) => setMeetingUrlDraft(event.target.value)}
                placeholder="https://..."
                className="mt-3 min-h-11 w-full rounded-lg border border-line bg-transparent px-3"
              />
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={
                    meetingLinkBusy ||
                    !meetingUrlDraft.trim() ||
                    meetingUrlDraft.trim() === booking.customMeetingUrl
                  }
                  onClick={() => void saveMeetingLink(meetingUrlDraft.trim())}
                  className="inline-flex min-h-10 items-center rounded-lg bg-brand-navy px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {meetingLinkBusy ? "Saving…" : "Save link"}
                </button>
                {booking.customMeetingUrl && (
                  <button
                    type="button"
                    disabled={meetingLinkBusy}
                    onClick={() => void saveMeetingLink(null)}
                    className="inline-flex min-h-10 items-center rounded-lg border border-line px-4 text-sm font-semibold disabled:opacity-50"
                  >
                    {booking.zoomMeetingUrl ? "Restore generated link" : "Remove Tutor link"}
                  </button>
                )}
              </div>
            </div>
          )}
        </section>
        <aside
          className={
            isStudentDetails
              ? "min-w-0"
              : isTutorView
                ? "h-fit md:sticky md:top-24 md:col-start-2 md:row-start-1 rounded-2xl border border-line bg-surface p-6"
                : `${styles.summary} rounded-2xl border border-line bg-surface p-5 sm:p-6`
          }
        >
          {!isTutorView &&
          (booking.status === "PENDING_PAYMENT" || booking.status === "CONFIRMED") ? (
            <h2 className="sr-only">Payment and lesson information</h2>
          ) : (
            <>
              <p className="text-sm text-muted">Total</p>
              <p className="mt-1 text-2xl font-semibold">
                {money.format(Number(booking.totalAmount))}
              </p>
            </>
          )}
          {isTutorView && booking.earnings && (
            <section aria-label="Lesson earnings" className="mt-5 border-t border-line pt-5">
              <h3 className="font-semibold">
                {booking.earnings.status === "PENDING" ? "Pending earnings" : "Cleared earnings"}
              </h3>
              <p className="mt-1 text-xl font-semibold">
                {money.format(Number(booking.earnings.amount))}
              </p>
              <p className="mt-2 text-sm text-muted">
                {booking.earnings.status === "PENDING" ? (
                  <>
                    After the 15% platform fee. Available after{" "}
                    {dateTime.format(new Date(booking.earnings.clearsAt))}; it is not in your
                    available balance yet and moves to your wallet the next time you view or use
                    your balance.
                    {booking.earnings.holdReason === "AWAITING_COMPLETION" &&
                      " The Tutor must confirm the lesson first."}
                    {booking.earnings.holdReason === "CLEARING_PERIOD" &&
                      " The 24-hour clearing period is still in progress."}
                    {booking.earnings.holdReason === "REFUND_REVIEW" &&
                      " It is held until the Admin decides the refund request."}
                    {booking.earnings.holdReason === "READY_TO_CLEAR" &&
                      " The clearing period has ended; it will move when you next view or use your wallet."}
                  </>
                ) : (
                  "This earning has been cleared into your wallet."
                )}
              </p>
              <Link
                href="/wallet"
                className="mt-3 inline-block text-sm font-semibold text-brand-link underline"
              >
                View wallet
              </Link>
            </section>
          )}
          {!isTutorView && (booking.status !== "CONFIRMED" || booking.refundRequest) && (
            <StudentRefundStatus booking={booking} busy={busy} onRequest={openRefund} />
          )}
          {isTutorView && booking.refundRequest && (
            <section aria-label="Refund request" className="mt-5 border-t border-line pt-5">
              <h3 className="font-semibold">Refund requested</h3>
              <p className="mt-2 text-sm text-muted">
                {booking.student.name} asked for a refund:{" "}
                {refundReasonLabels[booking.refundRequest.reason].toLowerCase()}.{" "}
                {booking.refundRequest.status === "PENDING"
                  ? "An admin is reviewing it, so you can't confirm this lesson yet."
                  : booking.refundRequest.status === "APPROVED"
                    ? "The Student was refunded in full and this lesson was cancelled."
                    : "An admin rejected the request, so you can confirm this lesson."}
              </p>
            </section>
          )}
          <BookingReviewSection
            booking={booking}
            onPublished={(review) => {
              setBooking({ ...booking, review, actions: { ...booking.actions, canReview: false } });
              setMessage("Thanks! Your review is published.");
            }}
          />
          {booking.status === "PENDING_PAYMENT" && booking.payment.expiresAt && (
            <p className="mt-2 text-xs text-muted">
              Payment request expires {dateTime.format(new Date(booking.payment.expiresAt))}
            </p>
          )}
          {booking.status === "PENDING_PAYMENT" && booking.payment.walletBalance !== null && (
            <div
              className={
                !isTutorView
                  ? "fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(0,0,0,0.04)]"
                  : "mt-5"
              }
            >
              <div
                className={
                  !isTutorView
                    ? "mx-auto flex w-full max-w-[68rem] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8"
                    : ""
                }
              >
                {!isTutorView && (
                  <div>
                    <p className="text-xs text-muted">Total</p>
                    <p className="text-lg font-semibold tabular-nums">
                      {money.format(Number(booking.totalAmount))}
                    </p>
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {!isTutorView && booking.actions.canCancel && (
                    <button
                      type="button"
                      disabled={busy || quoteLoading}
                      onClick={() => void openCancellation()}
                      className="flex min-h-11 items-center justify-center rounded-lg border border-line px-4 text-sm font-semibold text-red-700 hover:bg-surface-muted disabled:opacity-50"
                    >
                      Cancel lesson
                    </button>
                  )}
                  <button
                    disabled={busy || !booking.actions.canPay || !booking.payment.canPay}
                    onClick={() => {
                      setMessage(null);
                      setPaymentDialogOpen(true);
                    }}
                    className="flex min-h-11 items-center justify-center rounded-lg bg-brand-navy px-6 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy ? "Processing…" : "Confirm payment"}
                  </button>
                </div>
              </div>
            </div>
          )}
          {booking.status === "PENDING_PAYMENT" && shortfall > 0 && (
            <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
              <p>You need {money.format(shortfall)} more to pay.</p>
              <Link href={topUpHref} className="mt-2 inline-block font-semibold underline">
                Top up {money.format(shortfall)}
              </Link>
            </div>
          )}
          {(booking.actions.canCancel || booking.actions.canTutorCancel) &&
            !(
              !isTutorView &&
              booking.status === "PENDING_PAYMENT" &&
              booking.payment.walletBalance !== null
            ) &&
            !(!isTutorView && booking.status === "CONFIRMED") && (
              <div className="mt-4 grid gap-2">
                {(booking.actions.canCancel || booking.actions.canTutorCancel) && (
                  <button
                    disabled={busy || quoteLoading}
                    onClick={() => void openCancellation()}
                    className="h-10 rounded-lg border border-red-200 font-medium text-red-700"
                  >
                    {isTutorView ? "Cancel class" : "Cancel lesson"}
                  </button>
                )}
              </div>
            )}
        </aside>
      </div>

      {paymentDialogOpen && (
        <TutorDialog
          title="Confirm payment"
          titleId="payment-confirmation-title"
          busy={busy}
          onClose={() => setPaymentDialogOpen(false)}
          footer={
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                className={dialogSecondary}
                disabled={busy}
                onClick={() => setPaymentDialogOpen(false)}
              >
                Go back
              </button>
              <button
                type="button"
                className={dialogPrimary}
                disabled={
                  busy ||
                  isExpired ||
                  slotUnavailable ||
                  !booking.actions.canPay ||
                  !booking.payment.canPay
                }
                onClick={() => void pay()}
              >
                {busy ? "Processing…" : "Pay from wallet"}
              </button>
            </div>
          }
        >
          <p className="text-sm leading-6 text-secondary">
            This amount will be deducted from your wallet to confirm the lesson.
          </p>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted">Subject</dt>
              <dd className="mt-1 font-semibold">{booking.subject.name}</dd>
            </div>
            <div>
              <dt className="text-muted">Tutor</dt>
              <dd className="mt-1 font-semibold">{booking.subject.tutor.name}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted">Time (Bangkok)</dt>
              <dd className="mt-1 font-semibold">
                {startsAt
                  ? dateTime.formatRange(new Date(startsAt), new Date(booking.endedAt))
                  : "To be confirmed"}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-t border-line pt-4 sm:col-span-2">
              <dt>Total</dt>
              <dd className="text-xl font-semibold">{money.format(Number(booking.totalAmount))}</dd>
            </div>
          </dl>
          {message && (
            <p role="alert" className="mt-4 text-sm text-red-700">
              {message}
            </p>
          )}
        </TutorDialog>
      )}

      {completionDialogOpen && (
        <TutorDialog
          title="Confirm session completed?"
          titleId="confirm-session-completed-title"
          onClose={() => setCompletionDialogOpen(false)}
          busy={busy}
          footer={
            <div className="flex justify-end gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => setCompletionDialogOpen(false)}
                className="h-10 rounded-lg border border-line px-4 font-medium disabled:opacity-50"
              >
                Go back
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void confirmCompletion()}
                className="h-10 rounded-lg bg-brand-navy px-4 font-semibold text-white disabled:opacity-50"
              >
                {busy ? "Confirming…" : "Confirm completed"}
              </button>
            </div>
          }
        >
          <p className="px-6 py-5 text-sm text-secondary">
            This will mark the lesson completed. You cannot undo this confirmation.
          </p>
          {completionError && (
            <p role="alert" className="px-6 pb-5 text-sm text-red-600">
              {completionError}
            </p>
          )}
        </TutorDialog>
      )}

      {mode === "cancel" && (
        <TutorDialog
          title={
            isTutorView
              ? "Cancel this class?"
              : booking.status === "CONFIRMED"
                ? "Refund this lesson?"
                : "Cancel this lesson?"
          }
          titleId="cancel-lesson-title"
          onClose={keepLesson}
          busy={busy}
          footer={
            <div className="flex items-center justify-end gap-3">
              <button disabled={busy} onClick={keepLesson} className={dialogSecondary}>
                {isTutorView ? "Keep class" : "Keep lesson"}
              </button>
              <button
                disabled={busy || quoteLoading || !quote || (isTutorView && !reason.trim())}
                onClick={() => void cancel()}
                className={dialogPrimary}
              >
                {busy
                  ? "Processing…"
                  : !isTutorView && booking.status === "CONFIRMED"
                    ? "Confirm refund"
                    : "Confirm cancellation"}
              </button>
            </div>
          }
        >
          {!isTutorView && booking.status === "CONFIRMED" && (
            <p className="mb-4 text-sm leading-6 text-secondary">
              Refunding cancels this lesson. Check the refund amount and fee before confirming.
            </p>
          )}
          {message && (
            <p role="alert" className="mb-3 text-sm text-red-700">
              {message}
            </p>
          )}
          {quoteLoading && (
            <p className="mt-2 text-sm text-secondary">Loading cancellation terms…</p>
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
                <p className="mt-2 text-sm text-secondary">
                  This class is more than {quote.policyWindowHours} hours away.
                </p>
              )}
              <dl className="mt-4 grid gap-3 border-t border-line pt-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted">Student&apos;s payment</dt>
                  <dd className="font-semibold">{money.format(Number(quote.originalAmount))}</dd>
                </div>
                <div>
                  <dt className="text-muted">Refund to the student&apos;s wallet</dt>
                  <dd className="font-semibold">{money.format(Number(quote.refundAmount))}</dd>
                </div>
              </dl>
            </>
          )}
          {quote && !isTutorView && (
            <>
              <p className="mt-2 text-sm text-secondary">
                {quote.lateCancellation
                  ? `This lesson is within the ${quote.policyWindowHours}-hour policy window.`
                  : `This lesson is outside the ${quote.policyWindowHours}-hour policy window.`}
              </p>
              <dl className="mt-4 grid gap-3 border-t border-line pt-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted">Original payment</dt>
                  <dd className="font-semibold">{money.format(Number(quote.originalAmount))}</dd>
                </div>
                <div>
                  <dt className="text-muted">Refund rate</dt>
                  <dd className="font-semibold">{Math.round(quote.refundRate * 100)}%</dd>
                </div>
                <div>
                  <dt className="text-muted">Cancellation fee</dt>
                  <dd className="font-semibold">{money.format(Number(quote.cancellationFee))}</dd>
                </div>
                <div>
                  <dt className="text-muted">Refund to your wallet</dt>
                  <dd className="font-semibold">{money.format(Number(quote.refundAmount))}</dd>
                </div>
              </dl>
            </>
          )}
          <label className="mt-4 block text-sm font-medium">
            {isTutorView ? (
              <>
                Reason <span className="font-normal text-muted">(shown to the student)</span>
              </>
            ) : (
              <>
                Reason <span className="font-normal text-muted">(optional)</span>
              </>
            )}
            <textarea
              maxLength={500}
              disabled={busy}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={4}
              className={dialogField}
            />
          </label>
        </TutorDialog>
      )}

      {mode === "refund" && (
        <TutorDialog
          title="Request a refund"
          titleId="refund-request-title"
          onClose={() => setMode(null)}
          busy={busy}
          footer={
            <div className="flex items-center justify-end gap-3">
              <button disabled={busy} onClick={() => setMode(null)} className={dialogSecondary}>
                Close
              </button>
              <button
                disabled={busy || !refundReason}
                onClick={() => void submitRefund()}
                className={dialogPrimary}
              >
                {busy ? "Sending…" : "Send refund request"}
              </button>
            </div>
          }
        >
          <p className="text-sm leading-6 text-secondary">
            An admin reviews every request. If it&apos;s approved, the full{" "}
            {money.format(Number(booking.totalAmount))} goes back to your wallet.
          </p>
          <fieldset disabled={busy} className="mt-4 grid gap-1">
            <legend className="text-sm font-medium">What happened?</legend>
            {REFUND_OPTIONS.map((option) => (
              <label
                key={option.reason}
                className="flex items-center gap-3 border-b border-line px-2 py-3 text-sm hover:bg-surface-muted"
              >
                <input
                  className="accent-brand-navy"
                  type="radio"
                  name="refund-reason"
                  checked={refundReason === option.reason}
                  onChange={() => setRefundReason(option.reason)}
                />
                <span className="font-medium">{option.label}</span>
              </label>
            ))}
          </fieldset>
          <label className="mt-4 block text-sm font-medium">
            What went wrong?{" "}
            <span className="font-normal text-muted">
              {refundReason === "TUTOR_NO_SHOW" ? "(optional)" : "(required)"}
            </span>
            <textarea
              maxLength={1000}
              disabled={busy}
              value={refundDetails}
              onChange={(event) => setRefundDetails(event.target.value)}
              rows={4}
              className={dialogField}
            />
          </label>
          {refundError && (
            <p role="alert" className="mt-2 text-sm text-red-600">
              {refundError}
            </p>
          )}
        </TutorDialog>
      )}
    </main>
  );
}

// PAY-3: the Student's refund request and its status, or the action to request one.
function StudentRefundStatus({
  booking,
  busy,
  onRequest,
}: {
  booking: Booking;
  busy: boolean;
  onRequest: () => void;
}) {
  const request = booking.refundRequest;
  if (!request && !booking.actions.canRequestRefund) return null;
  return (
    <section aria-label="Refund" className="mt-5 border-t border-line pt-5">
      {request ? (
        <>
          <h3 className="font-semibold">
            {request.status === "PENDING"
              ? "Refund under review"
              : request.status === "APPROVED"
                ? "Refunded"
                : "Refund request rejected"}
          </h3>
          <p className="mt-2 text-sm text-muted">
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
          <p className="mt-2 text-sm text-muted">
            If your tutor didn&apos;t show up or something went wrong, you can ask an admin for a
            full refund.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={onRequest}
            className="mt-3 h-10 w-full rounded-lg border border-line font-medium disabled:opacity-50"
          >
            Request a refund
          </button>
        </>
      )}
    </section>
  );
}

export default function BookingDetailPage() {
  return (
    <RequireAuth>
      <BookingDetailContent />
    </RequireAuth>
  );
}
