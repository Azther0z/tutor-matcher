"use client";

import { useState } from "react";
import { nextContinuousSelection } from "./continuous-slot-picker";
import type { AvailabilitySlot } from "@/src/types/booking";

const ZONE = "Asia/Bangkok";
const dayKey = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
const atNoon = (day: string) => new Date(`${day}T12:00:00+07:00`);

export function SubjectBookingCalendar({
  slots,
  selectedIds,
  onChange,
  onSelectionMessage,
  initialDate,
  onDateChange,
  openDates,
}: {
  slots: AvailabilitySlot[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onSelectionMessage: (message: string | null) => void;
  initialDate?: string | null;
  onDateChange?: (date: string) => void;
  openDates?: string[];
}) {
  const [now] = useState(() => new Date());
  const today = dayKey(now);
  const [year, month, day] = today.split("-").map(Number);
  // Clamp month-end dates rather than letting Date overflow into a fourth month.
  const limitDay = Math.min(day, new Date(Date.UTC(year, month + 3, 0)).getUTCDate());
  const horizon = new Date(Date.UTC(year, month + 2, limitDay)).toISOString().slice(0, 10);
  const validInitialDate =
    initialDate &&
    /^\d{4}-\d{2}-\d{2}$/.test(initialDate) &&
    initialDate >= today &&
    initialDate <= horizon &&
    !Number.isNaN(atNoon(initialDate).getTime()) &&
    dayKey(atNoon(initialDate)) === initialDate
      ? initialDate
      : "";
  const [visibleMonth, setVisibleMonth] = useState((validInitialDate || today).slice(0, 7));
  const [selectedDay, setSelectedDay] = useState(validInitialDate);
  const available = slots.filter(
    (slot) =>
      slot.available !== false &&
      new Date(slot.startedAt) > now &&
      dayKey(new Date(slot.startedAt)) <= horizon
  );
  const daysWithSlots = new Set(
    openDates ?? available.map((slot) => dayKey(new Date(slot.startedAt)))
  );
  const [viewYear, viewMonth] = visibleMonth.split("-").map(Number);
  const count = new Date(Date.UTC(viewYear, viewMonth, 0)).getUTCDate();
  const offset = new Date(Date.UTC(viewYear, viewMonth - 1, 1)).getUTCDay();
  const daySlots = available.filter((slot) => dayKey(new Date(slot.startedAt)) === selectedDay);
  function moveMonth(delta: number) {
    setVisibleMonth(
      new Date(Date.UTC(viewYear, viewMonth - 1 + delta, 1)).toISOString().slice(0, 7)
    );
  }
  return (
    <section
      aria-label="Booking calendar"
      className="grid items-start gap-4 md:grid-cols-[16rem_minmax(0,1fr)]"
    >
      <div className="flex min-w-0 flex-col gap-2">
        <h2 className="text-lg font-semibold">Pick a date</h2>
        <div className="flex items-center justify-between">
          <button
            type="button"
            aria-label="Previous month"
            disabled={visibleMonth <= today.slice(0, 7)}
            onClick={() => moveMonth(-1)}
            className="rounded-lg border border-line px-3 py-2 disabled:opacity-40"
          >
            ←
          </button>
          <h2 aria-live="polite" className="font-semibold">
            {new Intl.DateTimeFormat("en-US", {
              month: "long",
              year: "numeric",
              timeZone: ZONE,
            }).format(atNoon(`${visibleMonth}-01`))}
          </h2>
          <button
            type="button"
            aria-label="Next month"
            disabled={visibleMonth >= horizon.slice(0, 7)}
            onClick={() => moveMonth(1)}
            className="rounded-lg border border-line px-3 py-2 disabled:opacity-40"
          >
            →
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
            <span key={label} className="text-center text-xs">
              {label}
            </span>
          ))}
          {Array.from({ length: offset }, (_, i) => (
            <span key={`blank-${i}`} />
          ))}
          {Array.from({ length: count }, (_, i) => {
            const date = `${visibleMonth}-${String(i + 1).padStart(2, "0")}`;
            const open = date >= today && date <= horizon && daysWithSlots.has(date);
            return (
              <button
                type="button"
                key={date}
                aria-label={date}
                aria-pressed={selectedDay === date}
                disabled={!open}
                onClick={() => {
                  setSelectedDay(date);
                  onDateChange?.(date);
                  onChange([]);
                  onSelectionMessage(null);
                }}
                className={`relative flex aspect-square min-w-0 items-center justify-center rounded-lg border p-0 text-sm disabled:opacity-30 ${selectedDay === date ? "border-brand-navy bg-brand-navy text-white" : "border-line"}`}
              >
                {i + 1}
                <span
                  aria-hidden="true"
                  className="absolute bottom-1 left-1/2 -translate-x-1/2 text-xs leading-none"
                >
                  {open ? "•" : ""}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-xs leading-5 text-muted">
          Times in Asia/Bangkok (UTC+7). Book up to three months ahead. Days with a dot have open
          times.
        </p>
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <h2 className="text-lg font-semibold">Pick your time</h2>
        <p className="text-sm text-muted">Choose consecutive half-hour slots.</p>
        {selectedDay ? (
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">
              {new Intl.DateTimeFormat("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
                timeZone: ZONE,
              }).format(atNoon(selectedDay))}
            </legend>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
              {Array.from({ length: 48 }, (_, i) => {
                const time = `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`;
                const instant = new Date(`${selectedDay}T${time}:00+07:00`).getTime();
                const slot = daySlots.find((s) => new Date(s.startedAt).getTime() === instant);
                const active = !!slot && selectedIds.includes(slot.id);
                return (
                  <button
                    key={time}
                    type="button"
                    disabled={!slot}
                    aria-pressed={active}
                    aria-label={`${time} ${slot ? "Available" : "Not available"}`}
                    onClick={() => {
                      if (!slot) return;
                      const next = nextContinuousSelection(
                        available,
                        selectedIds,
                        slot.id,
                        undefined,
                        ZONE
                      );
                      onChange(next.ids);
                      onSelectionMessage(next.message);
                    }}
                    className={`min-h-10 min-w-0 rounded-lg border px-2 py-2 text-sm tabular-nums disabled:cursor-not-allowed ${active ? "border-brand-navy bg-brand-navy text-white" : slot ? "border-line bg-transparent text-foreground hover:border-brand-navy hover:bg-surface-muted" : "border-transparent bg-surface-muted text-muted opacity-30"}`}
                  >
                    {time}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ) : (
          <p>Select a day with an available time.</p>
        )}
      </div>
    </section>
  );
}
