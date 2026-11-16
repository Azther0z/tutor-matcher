"use client";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { halfHours, slotPassed, type AvailabilityCalendar } from "@/src/lib/availability";

export type PeriodChange = { time: string; subjectIds: string[]; remove: boolean };
type Range = { start: number; end: number };
const clock = (index: number) => (index === 48 ? "24:00" : halfHours[index]);
const actionClass =
  "min-h-10 rounded-lg border border-line px-3 text-sm font-semibold hover:bg-surface-muted disabled:opacity-50";

export function TutorAvailabilityTimeline({
  date,
  calendar,
  disabled = false,
  onApply,
}: {
  date: string;
  calendar: AvailabilityCalendar;
  disabled?: boolean;
  onApply: (changes: PeriodChange[]) => Promise<boolean>;
}) {
  const slots = new Map(
    (calendar.days.find((day) => day.date === date)?.slots ?? []).map((slot) => [slot.time, slot])
  );
  const names = new Map(calendar.subjects.map((subject) => [subject.id, subject.name]));
  const track = useRef<HTMLDivElement>(null);
  const popup = useRef<HTMLFormElement>(null);
  const dragging = useRef<Range | null>(null);
  const [preview, setPreview] = useState<Range | null>(null);
  const [range, setRange] = useState<Range | null>(null);
  const [position, setPosition] = useState({ left: 0, top: 0, arrow: 24, side: "left" });
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const saving = useRef(false);
  const unavailable = (index: number) =>
    slotPassed(date, halfHours[index]) || !!slots.get(halfHours[index])?.locked;
  useEffect(() => {
    if (range) popup.current?.querySelector<HTMLInputElement>("input")?.focus();
  }, [range]);
  useEffect(() => {
    if (!range) return;
    function reposition() {
      if (!range) return;
      const rect = track.current
        ?.querySelector<HTMLElement>(`[data-slot-index="${range.end - 1}"]`)
        ?.getBoundingClientRect();
      if (!rect || !range) return;
      const anchorY = Math.max(24, Math.min(window.innerHeight - 24, rect.top + rect.height / 2));
      const onRight = rect.right + 340 < window.innerWidth;
      const height = popup.current?.offsetHeight || 340;
      const top = Math.max(8, Math.min(window.innerHeight - height - 8, anchorY - height / 2));
      setPosition({
        left: Math.max(
          8,
          Math.min(window.innerWidth - 336, onRight ? rect.right + 12 : rect.left - 332)
        ),
        top,
        arrow: Math.max(16, Math.min(height - 24, anchorY - top)),
        side: onRight ? "left" : "right",
      });
    }
    reposition();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [range]);
  useEffect(() => {
    if (!range) return;
    function dismiss(event: globalThis.PointerEvent) {
      if (disabled || saving.current) return;
      const target = event.target as Node;
      if (!popup.current?.contains(target)) {
        setRange(null);
        setPreview(null);
      }
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape" && !disabled && !saving.current) {
        setRange(null);
        setPreview(null);
      }
    }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [range, disabled]);
  function choose(value: Range) {
    const normalized = {
      start: Math.min(value.start, value.end),
      end: Math.max(value.start, value.end) + 1,
    };
    if (
      halfHours
        .slice(normalized.start, normalized.end)
        .some((_, offset) => unavailable(normalized.start + offset))
    ) {
      setNotice("Choose slots containing only future, unbooked times.");
      setPreview(null);
      return;
    }
    const rect = track.current
      ?.querySelector<HTMLElement>(`[data-slot-index="${normalized.end - 1}"]`)
      ?.getBoundingClientRect();
    if (!rect) return;
    const anchorY = Math.max(24, Math.min(window.innerHeight - 24, rect.top + rect.height / 2));
    const onRight = rect.right + 340 < window.innerWidth;
    const left = Math.max(
      8,
      Math.min(window.innerWidth - 336, onRight ? rect.right + 12 : rect.left - 332)
    );
    const top = Math.max(8, Math.min(window.innerHeight - 360, anchorY - 40));
    setPosition({
      left,
      top,
      arrow: Math.max(20, Math.min(300, anchorY - top)),
      side: onRight ? "left" : "right",
    });
    setRange(normalized);
    setPreview({ start: normalized.start, end: normalized.end - 1 });
    setOverrides({});
    setNotice(null);
  }
  function indexAt(event: PointerEvent<HTMLDivElement>) {
    const cells = track.current?.querySelectorAll<HTMLElement>("[data-slot-index]");
    for (const cell of cells ?? []) {
      const rect = cell.getBoundingClientRect();
      if (
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
      )
        return Number(cell.dataset.slotIndex);
    }
    return dragging.current?.end ?? -1;
  }
  async function add() {
    if (!range || !Object.keys(overrides).length || disabled || saving.current) return;
    saving.current = true;
    try {
      const ok = await onApply(
        halfHours.slice(range.start, range.end).flatMap((time) =>
          Object.entries(overrides).map(([id, open]) => ({
            time,
            subjectIds: [id],
            remove: !open,
          }))
        )
      );
      if (ok) {
        setRange(null);
        setPreview(null);
      } else
        setNotice(
          "Some changes could not be saved. Your selected slots and subjects are kept; review and retry."
        );
    } finally {
      saving.current = false;
    }
  }
  function subjectState(id: string): boolean | "mixed" {
    if (overrides[id] !== undefined) return overrides[id];
    if (!range) return false;
    const times = halfHours.slice(range.start, range.end);
    const count = times.filter(
      (time) => slots.get(time)?.isOpen && slots.get(time)?.subjectIds.includes(id)
    ).length;
    return count === times.length ? true : count === 0 ? false : "mixed";
  }
  return (
    <div className="min-w-0">
      <h3 className="text-lg font-semibold">Drag to select times</h3>
      {notice && (
        <p role="status" className="my-2 text-sm text-secondary">
          {notice}
        </p>
      )}
      <div
        ref={track}
        role="group"
        aria-label="Select availability slots"
        className="mt-3 grid touch-none select-none grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-12"
        onPointerDown={(event) => {
          if (
            disabled ||
            event.button !== 0 ||
            (event.target as HTMLElement).closest("[data-subject-row]")
          )
            return;
          const index = indexAt(event);
          if (index < 0 || unavailable(index)) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          dragging.current = { start: index, end: index };
          setPreview(dragging.current);
          setRange(null);
        }}
        onPointerMove={(event) => {
          if (dragging.current) {
            dragging.current = { ...dragging.current, end: indexAt(event) };
            setPreview(dragging.current);
          }
        }}
        onPointerUp={(event) => {
          const current = dragging.current;
          dragging.current = null;
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
          if (current) choose(current);
        }}
        onPointerCancel={() => {
          dragging.current = null;
          setPreview(null);
        }}
      >
        {halfHours.map((time, index) => {
          const slot = slots.get(time);
          const inRange =
            preview &&
            index >= Math.min(preview.start, preview.end) &&
            index <= Math.max(preview.start, preview.end);
          const ids = slot?.isOpen || slot?.locked ? slot.subjectIds : [];
          return (
            <div
              key={time}
              data-slot-index={index}
              className={`h-24 min-w-0 overflow-hidden rounded-lg border ${inRange ? "border-brand-navy bg-brand-soft ring-1 ring-brand-navy" : slot?.locked ? "border-amber-600/40 bg-surface-muted" : ids.length ? "border-brand-navy/50" : "border-line"} ${unavailable(index) ? "opacity-40" : ""}`}
            >
              <button
                type="button"
                aria-label={`Select time ${time}`}
                disabled={disabled || unavailable(index)}
                className="flex h-8 w-full items-center justify-center px-1 text-sm font-medium tabular-nums disabled:cursor-not-allowed"
                onClick={(event) => {
                  if (event.detail === 0) choose({ start: index, end: index });
                }}
              >
                {time}
              </button>
              {ids.slice(0, 2).map((subjectId) => {
                return (
                  <button
                    key={subjectId}
                    type="button"
                    data-subject-row
                    aria-label={`${names.get(subjectId) ?? "Subject"}, ${clock(index)}–${clock(index + 1)}`}
                    title={names.get(subjectId)}
                    disabled={disabled || unavailable(index)}
                    className="flex h-5 w-full items-center border-t border-line px-1.5 text-left text-xs text-brand-link hover:bg-surface-muted disabled:cursor-not-allowed"
                    onClick={() => choose({ start: index, end: index })}
                  >
                    <span className="truncate">{names.get(subjectId) ?? "Subject"}</span>
                  </button>
                );
              })}
              {ids.length > 2 && (
                <button
                  type="button"
                  data-subject-row
                  aria-label={`Show ${ids.length - 2} more subjects at ${time}`}
                  disabled={disabled || unavailable(index)}
                  onClick={() => choose({ start: index, end: index })}
                  className="flex h-5 w-full items-center border-t border-line px-1.5 text-sm text-muted hover:bg-surface-muted disabled:cursor-not-allowed"
                >
                  ...
                </button>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted">
        Keyboard: focus a time and press Enter to edit its subjects. Adjust From and Until to edit
        several slots.
      </p>
      {range &&
        createPortal(
          <form
            ref={popup}
            role="dialog"
            aria-label="Edit subjects in selected slots"
            onSubmit={(event) => {
              event.preventDefault();
              void add();
            }}
            className="fixed z-50 w-80 max-w-[calc(100vw-1rem)] rounded-xl border border-line bg-surface p-4 shadow-xl"
            style={{ left: position.left, top: position.top }}
          >
            <span
              aria-hidden="true"
              className="absolute h-3 w-3 rotate-45 border border-line bg-surface"
              style={{
                [position.side]: -7,
                top: position.arrow,
                borderTop: position.side === "left" ? "none" : undefined,
                borderRight: position.side === "left" ? "none" : undefined,
                borderBottom: position.side === "right" ? "none" : undefined,
                borderLeft: position.side === "right" ? "none" : undefined,
              }}
            />
            <h4 className="font-semibold">Edit subjects</h4>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted">
              <label>
                From
                <select
                  aria-label="Selection start"
                  disabled={disabled}
                  value={range.start}
                  onChange={(event) => {
                    const start = Number(event.target.value);
                    setOverrides({});
                    setRange({ start, end: Math.max(range.end, start + 1) });
                    setPreview({ start, end: Math.max(range.end, start + 1) - 1 });
                  }}
                  className="mt-1 min-h-10 w-full rounded-lg border border-line bg-surface px-2 text-sm text-foreground"
                >
                  {halfHours.map((time, index) => (
                    <option key={time} value={index} disabled={unavailable(index)}>
                      {time}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Until
                <select
                  aria-label="Selection end"
                  disabled={disabled}
                  value={range.end}
                  onChange={(event) => {
                    const end = Number(event.target.value);
                    setOverrides({});
                    setRange({ ...range, end });
                    setPreview({ start: range.start, end: end - 1 });
                  }}
                  className="mt-1 min-h-10 w-full rounded-lg border border-line bg-surface px-2 text-sm text-foreground"
                >
                  {halfHours
                    .map((_, index) => index + 1)
                    .filter((end) => end > range.start)
                    .map((end) => (
                      <option key={end} value={end}>
                        {clock(end)}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            <fieldset disabled={disabled} className="mt-3 max-h-40 overflow-y-auto">
              <legend className="sr-only">Subjects</legend>
              {calendar.subjects.map((subject) => {
                const state = subjectState(subject.id);
                return (
                  <label
                    key={subject.id}
                    className="flex min-h-10 items-center gap-2 border-b border-line py-2 text-sm last:border-0"
                  >
                    <input
                      type="checkbox"
                      checked={state === true}
                      aria-checked={state === "mixed" ? "mixed" : state}
                      ref={(element) => {
                        if (element) element.indeterminate = state === "mixed";
                      }}
                      onChange={(event) =>
                        setOverrides((current) => ({
                          ...current,
                          [subject.id]: state === "mixed" ? false : event.target.checked,
                        }))
                      }
                      className="accent-brand-navy"
                    />
                    {subject.name}
                    {state === "mixed" && (
                      <span aria-hidden="true" className="ml-auto text-xs text-muted">
                        Mixed
                      </span>
                    )}
                  </label>
                );
              })}
            </fieldset>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={disabled}
                className={actionClass}
                onClick={() => {
                  setRange(null);
                  setPreview(null);
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={disabled || !Object.keys(overrides).length}
                className="min-h-10 rounded-lg bg-brand-navy px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {disabled ? "Saving…" : "Apply"}
              </button>
            </div>
          </form>,
          document.body
        )}
    </div>
  );
}
