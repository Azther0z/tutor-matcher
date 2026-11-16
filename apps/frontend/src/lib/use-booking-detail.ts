import { useCallback, useEffect, useState } from "react";
import { getBooking } from "@/src/lib/bookings-api";
import type { Booking } from "@/src/types/booking";

const MAX_TIMEOUT_DELAY = 2_147_483_647;

// What every panel on the booking page needs: the loaded booking, the shared busy flag,
// the status message, and a way to replace the booking after an action.
export type BookingPanelContext = {
  booking: Booking;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  setBooking: (booking: Booking) => void;
  setMessage: (message: string | null) => void;
  reload: () => Promise<void>;
};

// Loads one booking and keeps its time-sensitive actions fresh as the lesson starts and ends.
export function useBookingDetail(id: string) {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [clientNow, setClientNow] = useState(() => Date.now());

  const reload = useCallback(async () => {
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
    void reload();
  }, [reload]);

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
      void reload();
    };
    let endTimer: number;
    const scheduleRefreshAtEnd = () => {
      const remaining = endedAt - Date.now() + 250;
      endTimer = window.setTimeout(
        () => {
          if (Date.now() >= endedAt) refreshBookingAtEnd();
          else scheduleRefreshAtEnd();
        },
        Math.min(remaining, MAX_TIMEOUT_DELAY)
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
  }, [booking?.endedAt, booking?.status, booking?.viewerRole, reload]);

  return { booking, setBooking, loading, message, setMessage, busy, setBusy, clientNow, reload };
}
