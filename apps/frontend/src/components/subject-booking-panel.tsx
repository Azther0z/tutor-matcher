"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { SubjectBookingCalendar } from "@/src/components/subject-booking-calendar";
import { getAuthSnapshot, subscribeToAuth } from "@/src/lib/auth";
import type { SubjectPage } from "@/src/lib/tutor-profile-api";
import { BookingApiError, createBooking, getAvailability } from "@/src/lib/bookings-api";
import type { AvailabilityResponse } from "@/src/types/booking";

const TIME_ZONE = "Asia/Bangkok";
const money = new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" });

export function SubjectBookingPanel({
  page,
  date,
  onSelect,
}: {
  page: SubjectPage;
  date: string;
  onSelect: (date: string) => void;
}) {
  const subjectId = page.subject.id;
  const router = useRouter();
  const params = useSearchParams();
  const restoredTimes = params.get("times") ?? "";
  const initialDate = date;
  const signedIn = useSyncExternalStore(subscribeToAuth, getAuthSnapshot, () => null);
  const publicData = useMemo<AvailabilityResponse>(
    () => ({
      subject: {
        id: page.subject.id,
        name: page.subject.name,
        hourlyRate: page.subject.hourlyRate,
        format: page.subject.format,
        tutor: { id: page.tutor.id, name: `${page.tutor.firstName} ${page.tutor.lastName}` },
      },
      slots: page.openSlots.map((startedAt) => ({ id: startedAt, startedAt, available: true })),
    }),
    [page]
  );
  const [data, setData] = useState<AvailabilityResponse | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      // Refresh slots and remove selections that are no longer available.
      const next = signedIn ? await getAvailability(subjectId) : publicData;
      setData(next);
      const valid = new Set(
        next.slots.filter((slot) => slot.available !== false).map((slot) => slot.id)
      );
      setSelectedIds((current) => {
        const kept = current.filter((id) => valid.has(id));
        const wanted = restoredTimes.split(",");
        return kept.length
          ? kept
          : next.slots
              .filter((slot) => valid.has(slot.id) && wanted.includes(slot.startedAt))
              .map((slot) => slot.id);
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load available times.");
    } finally {
      setLoading(false);
    }
  }, [subjectId, signedIn, publicData, restoredTimes]);

  useEffect(() => {
    // Fetching route-specific server data is the synchronization performed by this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const openSlots = useMemo(
    () => (data?.slots ?? []).filter((slot) => slot.available !== false),
    [data]
  );

  // A 30-minute slot costs half of the tutor's hourly rate.
  const total = (Number(data?.subject?.hourlyRate ?? 0) * selectedIds.length) / 2;
  const selectedSlots = openSlots
    .filter((slot) => selectedIds.includes(slot.id))
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const windowFormat = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  });

  async function submit() {
    if (submitting) return;
    if (!data || data.acceptingBookings === false || selectedIds.length === 0) {
      setMessage("Choose at least one available time.");
      return;
    }
    if (!signedIn) {
      const query = new URLSearchParams({
        date,
        times: selectedSlots.map((slot) => slot.startedAt).join(","),
      });
      router.push(
        `/login?next=${encodeURIComponent(`/tutors/${page.tutor.id}/${subjectId}?${query}`)}`
      );
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      // Create the pending booking and continue to its payment/detail page.
      const booking = await createBooking({
        subjectId: data.subject.id,
        availabilityIds: selectedIds,
        isTrial: false,
      });
      router.push(`/bookings/${booking.id}`);
    } catch (error) {
      if (error instanceof BookingApiError && error.code === "SLOT_TAKEN") {
        // Another student took the slot, so show the conflict and reload times.
        setMessage("That time was just booked by someone else. We refreshed the available times.");
        await load();
      } else if (error instanceof BookingApiError && error.code === "INVALID_SLOT_BLOCK") {
        setMessage("Choose consecutive 30-minute times on the same day.");
      } else {
        setMessage(error instanceof Error ? error.message : "Could not create this booking.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section aria-label="Choose lesson times">
      {loading ? (
        <p className="mt-10 text-muted">Loading available times…</p>
      ) : data?.acceptingBookings === false ||
        (openSlots.length === 0 && page.openDates.length === 0) ? (
        <div className="mt-8 rounded-2xl border border-dashed border-line p-8 text-center">
          <p className="font-medium">
            {data?.acceptingBookings === false
              ? "This tutor isn’t accepting bookings"
              : "No open times right now"}
          </p>
          <button
            onClick={() => {
              setLoading(true);
              void load();
            }}
            className="mt-3 text-sm font-semibold text-brand-link hover:underline"
          >
            Refresh availability
          </button>
        </div>
      ) : (
        <div className="mt-3 rounded-2xl border border-line bg-surface p-3 sm:p-4">
          <SubjectBookingCalendar
            key={`${subjectId}:${initialDate ?? ""}`}
            initialDate={initialDate}
            slots={openSlots}
            selectedIds={selectedIds}
            onChange={setSelectedIds}
            onSelectionMessage={setMessage}
            onDateChange={onSelect}
            openDates={page.openDates}
          />
        </div>
      )}
      {message && (
        <p role="alert" className="mt-4 text-sm text-amber-900">
          {message}
        </p>
      )}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(0,0,0,0.04)]">
        <div className="mx-auto flex w-full max-w-[68rem] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:flex-nowrap sm:px-6 lg:px-8">
          <div className="min-w-0 basis-full sm:flex-1 sm:basis-auto">
            <p className="text-sm font-medium">
              {selectedSlots.length > 0
                ? `${windowFormat.format(new Date(selectedSlots[0].startedAt))} – ${new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, timeStyle: "short" }).format(new Date(new Date(selectedSlots[selectedSlots.length - 1].startedAt).getTime() + 30 * 60_000))}`
                : "Select your lesson times"}
            </p>
            <p className="mt-1 text-xs text-muted">
              Bangkok time, {money.format(Number(data?.subject?.hourlyRate ?? 0))}/hr
            </p>
          </div>
          <div className="min-w-0 sm:text-right">
            <p className="text-xs text-muted">
              {selectedIds.length
                ? `${selectedIds.length * 30} min lesson`
                : "Choose a time to continue"}
            </p>
            <p className="text-lg font-semibold tabular-nums" aria-live="polite">
              <span className="sr-only">Total </span>
              {money.format(total)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={
              loading || submitting || data?.acceptingBookings === false || selectedIds.length === 0
            }
            className="flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-brand-navy px-4 text-sm font-semibold text-white hover:bg-brand-navy-dark disabled:cursor-not-allowed disabled:opacity-50 sm:px-6"
          >
            {submitting ? "Creating booking…" : "Continue to payment"}
          </button>
        </div>
      </div>
    </section>
  );
}
