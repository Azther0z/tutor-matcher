"use client";

import { useEffect, useRef } from "react";

const dayHeading = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Bangkok",
});
const clock = (index: number) =>
  `${String(Math.floor(index / 2)).padStart(2, "0")}:${index % 2 ? "30" : "00"}`;
// A day without openings opens on the morning, 08:00.
const MORNING = 16;

// DISC-4: the selected Bangkok day as a calendar. All 48 half-hours from 00:00 to 23:30 are
// listed, each Available or Not available, and consecutive open half-hours draw as one block.
// Nothing is clickable: booking starts from the button below the calendar.
export function SubjectDayCalendar({ date, openSlots }: { date: string; openSlots: string[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const open = new Set(openSlots.map((startedAt) => new Date(startedAt).getTime()));
  const halfHours = Array.from({ length: 48 }, (_, index) => ({
    index,
    time: clock(index),
    label: `${clock(index)}–${clock(index + 1)}`,
    available: open.has(new Date(`${date}T${clock(index)}:00+07:00`).getTime()),
  }));
  const blocks: { start: number; end: number }[] = [];
  for (const slot of halfHours) {
    if (!slot.available) continue;
    const last = blocks[blocks.length - 1];
    if (last?.end === slot.index) last.end += 1;
    else blocks.push({ start: slot.index, end: slot.index + 1 });
  }
  const blockLabel = ({ start, end }: { start: number; end: number }) =>
    `${clock(start)}–${clock(end)}`;
  const heading = dayHeading.format(new Date(`${date}T12:00:00+07:00`));
  const firstOpen = blocks[0]?.start ?? MORNING;

  // Scroll to the first opening, keeping the half-hour before it in view.
  useEffect(() => {
    const row = listRef.current?.children[Math.max(firstOpen - 1, 0)];
    if (scrollRef.current && row instanceof HTMLElement) {
      scrollRef.current.scrollTop = row.offsetTop;
    }
  }, [date, firstOpen]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="font-semibold">{heading}</h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {blocks.length
            ? `Open times: ${blocks.map(blockLabel).join(", ")}`
            : "No open times on this day"}
        </p>
      </div>
      <div
        ref={scrollRef}
        role="region"
        aria-label={`Calendar for ${heading}`}
        tabIndex={0}
        className="max-h-[28rem] overflow-y-auto rounded-2xl border border-black/10 focus-visible:outline-2 focus-visible:outline-violet-600 dark:border-white/15"
      >
        <div className="relative">
          <ol ref={listRef}>
            {halfHours.map((slot) => (
              <li
                key={slot.index}
                className={`grid h-8 grid-cols-[3.5rem_minmax(0,1fr)] ${
                  slot.index === 0
                    ? ""
                    : slot.time.endsWith(":00")
                      ? "border-t border-black/10 dark:border-white/15"
                      : "border-t border-dashed border-black/5 dark:border-white/10"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`pr-2 pt-1 text-right text-[11px] leading-none tabular-nums ${
                    slot.time.endsWith(":00")
                      ? "text-zinc-600 dark:text-zinc-300"
                      : "text-zinc-400 dark:text-zinc-500"
                  }`}
                >
                  {slot.time}
                </span>
                <span className="sr-only">
                  {`${slot.label} ${slot.available ? "Available" : "Not available"}`}
                </span>
              </li>
            ))}
          </ol>
          {blocks.map((block) => (
            <div
              key={block.start}
              aria-hidden="true"
              className="absolute left-14 right-2 overflow-hidden rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100"
              style={{
                top: `calc(${block.start * 2}rem + 2px)`,
                height: `calc(${(block.end - block.start) * 2}rem - 4px)`,
              }}
            >
              {blockLabel(block)} · Available
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
