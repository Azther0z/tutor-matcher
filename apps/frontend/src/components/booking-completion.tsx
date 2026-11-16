"use client";

import { useState } from "react";
import { TutorDialog } from "@/src/components/tutor-dialog";
import { BookingApiError, confirmBookingCompletion, getBooking } from "@/src/lib/bookings-api";
import type { BookingPanelContext } from "@/src/lib/use-booking-detail";
import type { Booking } from "@/src/types/booking";

// CLASS-2: once the scheduled time has ended, the Tutor confirms the session was completed.
export function CompletionConfirm({ context }: { context: BookingPanelContext }) {
  const { booking, busy, setBusy, setBooking, setMessage } = context;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (!booking.actions.canConfirmCompletion || busy) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      setBooking(await confirmBookingCompletion(booking.id));
      setDialogOpen(false);
      setMessage("Session marked completed.");
    } catch (failure) {
      const errorMessage =
        failure instanceof Error ? failure.message : "Could not confirm this lesson.";
      let refreshedBooking: Booking | null = null;
      try {
        refreshedBooking = await getBooking(booking.id);
        setBooking(refreshedBooking);
      } catch {
        // Keep the retryable confirmation failure visible in the open dialog.
      }

      const errorCode = failure instanceof BookingApiError ? failure.code : undefined;
      if (errorCode === "BOOKING_ALREADY_COMPLETED" || refreshedBooking?.status === "COMPLETED") {
        setDialogOpen(false);
        setMessage("This lesson has already been completed.");
      } else if (errorCode === "BOOKING_CANCELLED" || refreshedBooking?.status === "CANCELLED") {
        setDialogOpen(false);
        setMessage("This booking was cancelled.");
      } else if (!refreshedBooking?.actions.canConfirmCompletion) {
        setDialogOpen(false);
        setMessage(errorMessage);
      } else {
        setError(errorMessage);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="mt-6 border-t border-zinc-200 pt-5 dark:border-zinc-800">
        <h3 className="font-semibold">Confirm this lesson</h3>
        <p className="mt-1 text-sm text-zinc-500">
          The scheduled lesson time has ended. Confirm when the session is complete.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setError(null);
            setDialogOpen(true);
          }}
          className="mt-3 h-11 rounded-full bg-violet-600 px-5 font-semibold text-white disabled:opacity-50"
        >
          Confirm session completed
        </button>
      </div>
      {dialogOpen && (
        <TutorDialog
          title="Confirm session completed?"
          titleId="confirm-session-completed-title"
          onClose={() => setDialogOpen(false)}
          busy={busy}
          footer={
            <div className="flex justify-end gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => setDialogOpen(false)}
                className="h-10 rounded-full border border-zinc-300 px-4 font-medium disabled:opacity-50"
              >
                Go back
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void confirm()}
                className="h-10 rounded-full bg-violet-600 px-4 font-semibold text-white disabled:opacity-50"
              >
                {busy ? "Confirming…" : "Confirm completed"}
              </button>
            </div>
          }
        >
          <p className="px-6 py-5 text-sm text-zinc-600 dark:text-zinc-300">
            This will mark the lesson completed. You cannot undo this confirmation.
          </p>
          {error && (
            <p role="alert" className="px-6 pb-5 text-sm text-red-600">
              {error}
            </p>
          )}
        </TutorDialog>
      )}
    </>
  );
}
