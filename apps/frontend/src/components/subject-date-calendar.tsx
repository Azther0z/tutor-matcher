"use client";

import { useState } from "react";

const monthLabel = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "Asia/Bangkok",
});
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// DISC-4: any day from today to the last browsable day can be picked, so a Student can see a
// whole day's availability; days with openings carry a dot. Dates are Bangkok YYYY-MM-DD.
export function SubjectDateCalendar({
  selected,
  today,
  lastDay,
  openDates,
  onSelect,
}: {
  selected: string;
  today: string;
  lastDay: string;
  openDates: string[];
  onSelect: (date: string) => void;
}) {
  const [month, setMonth] = useState(selected.slice(0, 7));
  const open = new Set(openDates);
  const [year, monthNumber] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const offset = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay();

  function move(delta: number) {
    setMonth(new Date(Date.UTC(year, monthNumber - 1 + delta, 1)).toISOString().slice(0, 7));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          disabled={month <= today.slice(0, 7)}
          onClick={() => move(-1)}
          className="rounded-lg border border-black/10 px-3 py-2 disabled:opacity-40 dark:border-white/15"
        >
          ←
        </button>
        <h3 aria-live="polite" className="font-semibold">
          {monthLabel.format(new Date(`${month}-01T12:00:00+07:00`))}
        </h3>
        <button
          type="button"
          aria-label="Next month"
          disabled={month >= lastDay.slice(0, 7)}
          onClick={() => move(1)}
          className="rounded-lg border border-black/10 px-3 py-2 disabled:opacity-40 dark:border-white/15"
        >
          →
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {weekdays.map((label) => (
          <span key={label} className="text-xs text-zinc-500">
            {label}
          </span>
        ))}
        {Array.from({ length: offset }, (_, index) => (
          <span key={`blank-${index}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, index) => {
          const date = `${month}-${String(index + 1).padStart(2, "0")}`;
          const hasOpenings = open.has(date);
          const isSelected = date === selected;
          return (
            <button
              type="button"
              key={date}
              aria-label={hasOpenings ? `${date}, has open times` : date}
              aria-pressed={isSelected}
              disabled={date < today || date > lastDay}
              onClick={() => onSelect(date)}
              className={`rounded-lg p-2 text-sm disabled:opacity-30 ${
                isSelected
                  ? "bg-violet-600 text-white"
                  : "border border-black/10 hover:border-violet-500 dark:border-white/15"
              }`}
            >
              {index + 1}
              <span aria-hidden="true" className="block h-2 text-xs leading-none">
                {hasOpenings ? "•" : ""}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
