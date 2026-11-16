"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { BookingReviewSection } from "@/src/components/booking-review";
import {
  CancelLessonButton,
  CancellationPanel,
  useCancellation,
} from "@/src/components/booking-cancellation";
import { CompletionConfirm } from "@/src/components/booking-completion";
import { EarningsNote } from "@/src/components/booking-earnings";
import { LessonDetails } from "@/src/components/booking-lesson-details";
import { MeetingLinkEditor } from "@/src/components/booking-meeting-link";
import { PaymentBox, usePayment } from "@/src/components/booking-payment";
import {
  RefundRequestPanel,
  StudentRefundStatus,
  TutorRefundNote,
  useRefundRequest,
} from "@/src/components/booking-refund";
import { RequireAuth } from "@/src/components/require-auth";
import { money, statusStyle } from "@/src/lib/booking-format";
import { useBookingDetail, type BookingPanelContext } from "@/src/lib/use-booking-detail";

type PanelMode = "cancel" | "refund" | null;

function BookingDetailContent() {
  const { id } = useParams<{ id: string }>();
  const { booking, setBooking, loading, message, setMessage, busy, setBusy, clientNow, reload } =
    useBookingDetail(id);
  const [mode, setMode] = useState<PanelMode>(null);

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

  return (
    <BookingScreen
      context={{ booking, busy, setBusy, setBooking, setMessage, reload }}
      message={message}
      clientNow={clientNow}
      mode={mode}
      setMode={setMode}
    />
  );
}

// The loaded booking: its details on the left, its payment and actions on the right.
function BookingScreen({
  context,
  message,
  clientNow,
  mode,
  setMode,
}: {
  context: BookingPanelContext;
  message: string | null;
  clientNow: number;
  mode: PanelMode;
  setMode: (mode: PanelMode) => void;
}) {
  const { booking, setBooking, setMessage } = context;
  const cancellation = useCancellation(context, (open) => setMode(open ? "cancel" : null));
  const refund = useRefundRequest(context, (open) => setMode(open ? "refund" : null));
  const payment = usePayment(context);
  const isExpired =
    booking.status === "CANCELLED" && booking.cancellationReason === "PAYMENT_EXPIRED";
  const isTutorView = booking.viewerRole === "TUTOR";
  const beforeLessonEnd = new Date(booking.endedAt).getTime() > clientNow;
  const displayStatus = isExpired ? "EXPIRED" : booking.status.replaceAll("_", " ");

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-10 sm:px-8">
      <Link href="/bookings" className="text-sm text-zinc-600 hover:underline">
        ← Bookings
      </Link>
      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-violet-600">Lesson</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">{booking.subject.name}</h1>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusStyle[booking.status]}`}>
          {displayStatus}
        </span>
      </div>
      {isExpired && (
        <p role="status" className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          This payment request expired. Choose an available time to try again.
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
      {payment.slotUnavailable && (
        <Link
          className="mt-4 inline-block text-violet-600 underline"
          href={`/bookings/s/${booking.subject.id}`}
        >
          Choose another time
        </Link>
      )}
      {message && (
        <p role="status" className="mt-6 rounded-xl bg-violet-50 p-4 text-sm text-violet-900">
          {message}
        </p>
      )}
      <div className="mt-8 grid gap-6 md:grid-cols-[1fr_280px]">
        <section className="rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
          <LessonDetails booking={booking} canJoin={booking.actions.canJoin && beforeLessonEnd} />
          {booking.actions.canConfirmCompletion && !beforeLessonEnd && (
            <CompletionConfirm context={context} />
          )}
          {booking.actions.canEditMeetingLink && beforeLessonEnd && (
            <MeetingLinkEditor context={context} />
          )}
        </section>
        <aside className="rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
          <p className="text-sm text-zinc-500">Total</p>
          <p className="mt-1 text-2xl font-bold">{money.format(Number(booking.totalAmount))}</p>
          {isTutorView && booking.earnings && <EarningsNote earnings={booking.earnings} />}
          {!isTutorView && <StudentRefundStatus context={context} refund={refund} />}
          {isTutorView && <TutorRefundNote context={context} />}
          <BookingReviewSection
            booking={booking}
            onPublished={(review) => {
              setBooking({ ...booking, review, actions: { ...booking.actions, canReview: false } });
              setMessage("Thanks! Your review is published.");
            }}
          />
          <PaymentBox context={context} onPay={payment.pay} />
          <CancelLessonButton context={context} cancellation={cancellation} />
        </aside>
      </div>

      {mode === "cancel" && <CancellationPanel context={context} cancellation={cancellation} />}
      {mode === "refund" && (
        <RefundRequestPanel context={context} refund={refund} onClose={() => setMode(null)} />
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
