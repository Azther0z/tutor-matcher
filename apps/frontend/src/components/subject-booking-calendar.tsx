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
}: {
  slots: AvailabilitySlot[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onSelectionMessage: (message: string | null) => void;
  initialDate?: string | null;
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
  const daysWithSlots = new Set(available.map((slot) => dayKey(new Date(slot.startedAt))));
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
    <section aria-label="Booking calendar" className="space-y-5">
      <p className="text-sm text-zinc-500">
        Times in Asia/Bangkok (UTC+7). Book up to three months ahead.
      </p>
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          disabled={visibleMonth <= today.slice(0, 7)}
          onClick={() => moveMonth(-1)}
          className="rounded border px-3 py-2 disabled:opacity-40"
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
          className="rounded border px-3 py-2 disabled:opacity-40"
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
                onChange([]);
                onSelectionMessage(null);
              }}
              className={`rounded-lg p-2 disabled:opacity-30 ${selectedDay === date ? "bg-violet-600 text-white" : "border border-zinc-300"}`}
            >
              {i + 1}
              <span aria-hidden="true" className="block h-2 text-xs">
                {open ? "•" : ""}
              </span>
            </button>
          );
        })}
      </div>
      {selectedDay ? (
        <fieldset>
          <legend className="mb-3 font-semibold">{selectedDay} — choose consecutive times</legend>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
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
                  className={`rounded-lg border p-2 text-sm disabled:opacity-35 ${active ? "bg-violet-600 text-white" : "border-zinc-300"}`}
                >
                  {time}
                  <span className="block text-xs">{slot ? "Available" : "Not available"}</span>
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : (
        <p>Select a day with an available time.</p>
      )}
    </section>
  );
}
