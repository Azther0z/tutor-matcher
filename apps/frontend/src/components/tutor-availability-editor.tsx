"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  bangkokToday,
  calendarDates,
  formatDate,
  getAvailabilityCalendar,
  getAvailabilityDay,
  sameSlot,
  saveAvailabilitySlot,
  shiftDate,
  shiftMonth,
  slotPassed,
  type AvailabilityCalendar,
  type CalendarView,
  type EditableSlot,
  type StoredSlot,
} from "@/src/lib/availability";
import { TutorApiError } from "@/src/lib/tutor-application";
import { TutorAvailabilityCalendar } from "./tutor-availability-calendar";

const buttonClass =
  "rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold disabled:opacity-50 dark:border-zinc-600";
const emptySlot: EditableSlot = { isOpen: false, subjectIds: [] };
type Selection = { date: string; time: string; base: StoredSlot | null };

export function TutorAvailabilityEditor() {
  const [anchor, setAnchor] = useState(bangkokToday);
  const [view, setView] = useState<CalendarView>("week");
  const [calendar, setCalendar] = useState<AvailabilityCalendar | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [draft, setDraft] = useState<EditableSlot>(emptySlot);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [latest, setLatest] = useState<StoredSlot | null | undefined>(undefined);
  const [discard, setDiscard] = useState(false);
  const [retry, setRetry] = useState(0);
  const dialog = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const dates = calendarDates(anchor, view);
  const from = dates[0];
  const to = dates[dates.length - 1];
  const dirty = selection !== null && !sameSlot(draft, selection.base ?? emptySlot);
  const readOnly =
    selection !== null && (selection.base?.locked || slotPassed(selection.date, selection.time));

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

  useEffect(() => {
    if (selection) dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [selection]);

  function navigate(date: string, nextView = view) {
    if (dirty || busy) return;
    const nextDates = calendarDates(date, nextView);
    if (nextDates[0] !== from || nextDates[nextDates.length - 1] !== to) {
      setLoading(true);
      setCalendar(null);
    }
    setAnchor(date);
    setView(nextView);
    setError(null);
    setMessage(null);
  }

  function openSlot(date: string, time: string, base: StoredSlot | null) {
    opener.current = document.activeElement as HTMLElement;
    setSelection({ date, time, base });
    setDraft(base ? { isOpen: base.isOpen, subjectIds: [...base.subjectIds] } : emptySlot);
    setError(null);
    setMessage(null);
    setConflict(false);
    setLatest(undefined);
    setDiscard(false);
  }

  function closeEditor() {
    setSelection(null);
    setDiscard(false);
    setError(null);
    opener.current?.focus();
  }

  function rememberSlot(date: string, slot: StoredSlot | null, time: string) {
    setCalendar(
      (current) =>
        current && {
          ...current,
          days: current.days.map((day) =>
            day.date !== date
              ? day
              : {
                  ...day,
                  slots: [
                    ...day.slots.filter((saved) => saved.time !== time),
                    ...(slot ? [slot] : []),
                  ].sort((a, b) => a.time.localeCompare(b.time)),
                }
          ),
        }
    );
  }

  async function save(value = draft) {
    if (!selection || readOnly || busy) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await saveAvailabilitySlot(
        selection.date,
        selection.time,
        selection.base,
        value
      );
      rememberSlot(saved.date, saved.slot, selection.time);
      setMessage(
        `${saved.date} ${saved.slot.time}: ${saved.slot.isOpen ? "slot saved" : "slot closed"}.`
      );
      closeEditor();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not save this slot. Your draft is kept."
      );
      if (reason instanceof TutorApiError && reason.status === 409) {
        setConflict(true);
        setLatest(undefined);
      }
    } finally {
      setBusy(false);
    }
  }

  async function reviewLatest() {
    if (!selection) return;
    setBusy(true);
    try {
      const day = await getAvailabilityDay(selection.date);
      const slot = day.slots.find((stored) => stored.time === selection.time) ?? null;
      setLatest(slot);
      rememberSlot(selection.date, slot, selection.time);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not load this slot. Your draft is kept."
      );
    } finally {
      setBusy(false);
    }
  }

  function acceptLatest(keepDraft: boolean) {
    if (!selection || latest === undefined) return;
    setSelection({ ...selection, base: latest });
    if (!keepDraft)
      setDraft(latest ? { isOpen: latest.isOpen, subjectIds: [...latest.subjectIds] } : emptySlot);
    setConflict(false);
    setLatest(undefined);
    setError(null);
  }

  const heading =
    view === "month"
      ? formatDate(anchor, { month: "long", year: "numeric" })
      : `${formatDate(from, { day: "numeric", month: "short" })} – ${formatDate(to, { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <section
      aria-labelledby="availability-heading"
      className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6 dark:border-zinc-700 dark:bg-zinc-950"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="availability-heading" className="text-2xl font-semibold">
            Availability
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Choose a half-hour in the week calendar and save that slot. Asia/Bangkok (UTC+7).
          </p>
        </div>
        <div
          role="group"
          aria-label="Calendar view"
          className="flex rounded-lg border border-zinc-300 p-1 dark:border-zinc-600"
        >
          {(["week", "month"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={view === value}
              disabled={dirty || busy}
              onClick={() => navigate(anchor, value)}
              className={`rounded-md px-4 py-1.5 text-sm font-semibold capitalize disabled:opacity-50 ${view === value ? "bg-violet-700 text-white" : ""}`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-label={`Previous ${view}`}
            className={buttonClass}
            disabled={dirty || busy}
            onClick={() =>
              navigate(view === "week" ? shiftDate(anchor, -7) : shiftMonth(anchor, -1))
            }
          >
            ←
          </button>
          <button
            type="button"
            className={buttonClass}
            disabled={dirty || busy}
            onClick={() => navigate(bangkokToday())}
          >
            Today
          </button>
          <button
            type="button"
            aria-label={`Next ${view}`}
            className={buttonClass}
            disabled={dirty || busy}
            onClick={() => navigate(view === "week" ? shiftDate(anchor, 7) : shiftMonth(anchor, 1))}
          >
            →
          </button>
          <h3 className="ml-1 text-base font-semibold" aria-live="polite">
            {heading}
          </h3>
        </div>
        <label className="flex items-center gap-2 text-sm">
          Go to date
          <input
            type="date"
            value={anchor}
            disabled={dirty || busy}
            onChange={(event) => {
              if (event.target.value) navigate(event.target.value);
            }}
            className="min-w-0 rounded-lg border border-zinc-300 bg-transparent px-2 py-1.5 dark:border-zinc-600"
          />
        </label>
      </div>
      {!selection && error && (
        <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mt-4 text-sm text-emerald-800 dark:text-emerald-300">
          {message}
        </p>
      )}
      {loading && (
        <p className="mt-6" role="status">
          Loading availability…
        </p>
      )}
      {!loading && !calendar && (
        <button
          type="button"
          className={`${buttonClass} mt-4`}
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
        <p className="mt-6">
          Create a subject in{" "}
          <Link href="/settings/tutor" className="underline">
            Tutor settings
          </Link>{" "}
          before opening availability.
        </p>
      )}
      {!loading && calendar && calendar.subjects.length > 0 && (
        <>
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-zinc-600 dark:text-zinc-400">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-violet-200" />
              Open
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-amber-200" />
              Reserved / booked
            </span>
            <span>One slot can offer several subjects.</span>
          </div>
          <TutorAvailabilityCalendar
            view={view}
            anchor={anchor}
            dates={dates}
            calendar={calendar}
            onDate={(date) => navigate(date, "week")}
            onSlot={openSlot}
          />
          <p className="mt-3 text-xs text-zinc-500">
            {view === "week"
              ? "Click a time to edit. Scroll for all 24 hours; on smaller screens, scroll sideways to see every day."
              : "Choose a date to open its week. Counts show saved slots."}
          </p>
        </>
      )}
      {selection && calendar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              if (!busy) {
                if (dirty) setDiscard(true);
                else closeEditor();
              }
            }
            if (event.key === "Tab") {
              const controls = Array.from(
                dialog.current?.querySelectorAll<HTMLElement>(
                  "button:not([disabled]), input:not([disabled])"
                ) ?? []
              );
              const first = controls[0],
                last = controls[controls.length - 1];
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last?.focus();
              }
              if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first?.focus();
              }
            }
          }}
        >
          <div
            ref={dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="slot-heading"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-950"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                  Half-hour slot · UTC+7
                </p>
                <h3 id="slot-heading" className="mt-2 text-lg font-semibold">
                  {formatDate(selection.date, {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                  <span className="mt-1 block text-2xl tabular-nums">
                    {selection.time} –{" "}
                    {selection.time === "23:30"
                      ? "00:00 (+1 day)"
                      : new Date(Date.parse(`2000-01-01T${selection.time}:00Z`) + 30 * 60_000)
                          .toISOString()
                          .slice(11, 16)}
                  </span>
                </h3>
              </div>
              <button
                type="button"
                aria-label="Dismiss slot editor"
                disabled={busy}
                className={buttonClass}
                onClick={() => {
                  if (dirty) setDiscard(true);
                  else closeEditor();
                }}
              >
                ×
              </button>
            </div>
            {readOnly && (
              <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                {selection.base?.locked
                  ? "Reserved / booked. This slot cannot be changed."
                  : "Past availability cannot be changed."}
              </p>
            )}
            <fieldset disabled={busy || Boolean(readOnly)} className="mt-5">
              <legend className="text-sm font-semibold">Subjects offered in this slot</legend>
              <div className="mt-3 flex max-h-48 flex-wrap gap-2 overflow-y-auto">
                {calendar.subjects.map((subject) => {
                  const active = draft.subjectIds.includes(subject.id);
                  return (
                    <button
                      type="button"
                      key={subject.id}
                      aria-pressed={active}
                      onClick={() => {
                        const subjectIds = active
                          ? draft.subjectIds.filter((id) => id !== subject.id)
                          : [...draft.subjectIds, subject.id];
                        setDraft({ subjectIds, isOpen: subjectIds.length > 0 });
                        setDiscard(false);
                      }}
                      className={`rounded-lg border px-3 py-2 text-sm disabled:opacity-60 ${active ? "border-violet-700 bg-violet-700 text-white" : "border-zinc-300 dark:border-zinc-600"}`}
                    >
                      {subject.name}
                      <span className="ml-1 text-xs opacity-80">฿{subject.hourlyRate}/hr</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              {draft.isOpen
                ? "This time will be available for the selected subjects."
                : "Choose at least one subject to open this slot."}
            </p>
            {error && (
              <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-400">
                {error} Your draft is kept.
              </p>
            )}
            {conflict && (
              <div className="mt-4 rounded-lg border border-amber-400 p-3 text-sm">
                <p>Review the latest slot before trying again.</p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void reviewLatest()}
                  className={`${buttonClass} mt-3`}
                >
                  Review latest slot
                </button>
                {latest !== undefined && (
                  <div className="mt-3" aria-label="Latest slot">
                    <p>
                      Latest:{" "}
                      {latest?.locked ? "Reserved / booked" : latest?.isOpen ? "Open" : "Closed"};
                      subjects:{" "}
                      {latest?.subjectIds
                        .map((id) => calendar.subjects.find((subject) => subject.id === id)?.name)
                        .join(", ") || "none"}
                      .
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => acceptLatest(false)}
                        className={buttonClass}
                      >
                        Use latest slot
                      </button>
                      <button
                        type="button"
                        disabled={latest?.locked || slotPassed(selection.date, selection.time)}
                        onClick={() => acceptLatest(true)}
                        className={buttonClass}
                      >
                        Keep draft with latest revision
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={
                  busy ||
                  Boolean(readOnly) ||
                  !dirty ||
                  conflict ||
                  (draft.isOpen && draft.subjectIds.length === 0) ||
                  (!selection.base && !draft.isOpen)
                }
                onClick={() => void save()}
                className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save slot"}
              </button>
              {selection.base?.isOpen && (
                <button
                  type="button"
                  disabled={busy || Boolean(readOnly) || conflict}
                  onClick={() => void save({ ...draft, isOpen: false })}
                  className={buttonClass}
                >
                  Close slot
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                className={buttonClass}
                onClick={() => {
                  if (dirty) setDiscard(true);
                  else closeEditor();
                }}
              >
                Cancel
              </button>
            </div>
            {discard && (
              <div
                role="group"
                aria-label="Confirm discard"
                className="mt-4 rounded-lg border border-amber-300 p-3 text-sm"
              >
                <p>Discard this slot’s unsaved changes?</p>
                <div className="mt-3 flex gap-2">
                  <button type="button" className={buttonClass} onClick={closeEditor}>
                    Discard draft
                  </button>
                  <button type="button" className={buttonClass} onClick={() => setDiscard(false)}>
                    Keep editing
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
