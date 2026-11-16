"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  bangkokToday,
  calendarDates,
  getAvailabilityCalendar,
  getAvailabilityDay,
  saveAvailabilitySlot,
  slotPassed,
  type AvailabilityCalendar,
  type StoredSlot,
} from "@/src/lib/availability";
import { TutorAvailabilityCalendar } from "./tutor-availability-calendar";
import type { PeriodChange } from "./tutor-availability-timeline";

export function TutorAvailabilityEditor() {
  const [anchor, setAnchor] = useState(bangkokToday);
  const [calendar, setCalendar] = useState<AvailabilityCalendar | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const dates = calendarDates(anchor, "month");
  const from = dates[0],
    to = dates[dates.length - 1];
  useEffect(() => {
    let cancelled = false;
    getAvailabilityCalendar(from, to)
      .then((next) => {
        if (!cancelled) setCalendar(next);
      })
      .catch((reason) => {
        if (!cancelled)
          setError(reason instanceof Error ? reason.message : "Could not load availability.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [from, to, retry]);

  function navigate(date: string) {
    if (inFlight.current) return;
    const next = calendarDates(date, "month");
    if (next[0] !== from || next[next.length - 1] !== to) {
      setLoading(true);
    }
    setAnchor(date);
    setError(null);
    setMessage(null);
  }
  function remember(date: string, time: string, slot: StoredSlot | null) {
    setCalendar(
      (current) =>
        current && {
          ...current,
          days: current.days.map((day) =>
            day.date === date
              ? {
                  ...day,
                  slots: [
                    ...day.slots.filter((saved) => saved.time !== time),
                    ...(slot ? [slot] : []),
                  ].sort((a, b) => a.time.localeCompare(b.time)),
                }
              : day
          ),
        }
    );
  }

  async function applyRange(changes: PeriodChange[]): Promise<boolean> {
    if (inFlight.current || !calendar) return false;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    setMessage(null);
    let completed = 0;
    try {
      const edits = new Map<string, { add: Set<string>; remove: Set<string> }>();
      for (const change of changes) {
        const edit = edits.get(change.time) ?? {
          add: new Set<string>(),
          remove: new Set<string>(),
        };
        for (const id of change.subjectIds) (change.remove ? edit.remove : edit.add).add(id);
        edits.set(change.time, edit);
      }
      const slots = new Map(
        (calendar.days.find((day) => day.date === anchor)?.slots ?? []).map((slot) => [
          slot.time,
          slot,
        ])
      );
      for (const [time] of edits)
        if (slotPassed(anchor, time) || slots.get(time)?.locked)
          throw new Error("The period includes a past or booked slot. Choose only editable times.");
      for (const [time, edit] of edits) {
        const base = slots.get(time) ?? null;
        const ids = new Set(base?.isOpen ? base.subjectIds : []);
        for (const id of edit.remove) ids.delete(id);
        for (const id of edit.add) ids.add(id);
        const value = { isOpen: ids.size > 0, subjectIds: [...ids] };
        if (!base && !value.isOpen) continue;
        if (
          base?.isOpen === value.isOpen &&
          JSON.stringify([...base.subjectIds].sort()) === JSON.stringify([...ids].sort())
        )
          continue;
        const result = await saveAvailabilitySlot(anchor, time, base, value);
        remember(anchor, time, result.slot);
        completed += 1;
      }
      setMessage(`${completed} half-hour ${completed === 1 ? "slot" : "slots"} updated.`);
      return true;
    } catch (reason) {
      setError(
        `${completed ? `${completed} slots saved. ` : ""}${reason instanceof Error ? reason.message : "Could not save the period."} Your selection is kept. Review it before retrying.`
      );
      try {
        const day = await getAvailabilityDay(anchor);
        setCalendar(
          (current) =>
            current && {
              ...current,
              days: current.days.map((existing) => (existing.date === anchor ? day : existing)),
            }
        );
      } catch {
        /* Successful writes are already reflected locally. */
      }
      return false;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <section aria-labelledby="availability-heading" className="min-w-0 border-t border-line pt-5">
      <h2 id="availability-heading" className="text-xl font-semibold">
        Availability
      </h2>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
      <p role="status" className="mt-3 min-h-5 text-sm text-secondary">
        {busy ? "Saving availability…" : message}
      </p>
      {loading && (
        <p role="status" className="mt-4 text-sm text-muted">
          Loading availability…
        </p>
      )}
      {!loading && !calendar && (
        <button
          type="button"
          className="mt-3 min-h-11 rounded-lg border border-line px-4 text-sm font-semibold"
          onClick={() => {
            setLoading(true);
            setError(null);
            setRetry((value) => value + 1);
          }}
        >
          Retry loading
        </button>
      )}
      {!loading && calendar && calendar.subjects.length === 0 && (
        <p className="mt-4 text-sm">
          Create a subject in{" "}
          <Link href="/settings/tutor" className="underline">
            Tutor settings
          </Link>{" "}
          before opening availability.
        </p>
      )}
      {calendar && calendar.subjects.length > 0 && (
        <TutorAvailabilityCalendar
          anchor={anchor}
          calendar={calendar}
          disabled={busy || loading}
          onDate={navigate}
          onApply={applyRange}
        />
      )}
    </section>
  );
}
