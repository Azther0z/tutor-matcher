import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import {
  bangkokToday,
  formatDate,
  halfHours,
  slotPassed,
  type AvailabilityCalendar,
  type CalendarView,
  type StoredSlot,
} from "@/src/lib/availability";

type Props = {
  view: CalendarView;
  anchor: string;
  dates: string[];
  calendar: AvailabilityCalendar;
  onDate: (date: string) => void;
  onSlot: (date: string, time: string, slot: StoredSlot | null) => void;
};
const columns = "grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]";

export function TutorAvailabilityCalendar({
  view,
  anchor,
  dates,
  calendar,
  onDate,
  onSlot,
}: Props) {
  const scroll = useRef<HTMLDivElement>(null);
  const hintId = useId();
  const [activeCell, setActiveCell] = useState<string | null>(null);
  const cells = halfHours.flatMap((time) =>
    dates.map((date) => ({
      key: `${date}T${time}`,
      date,
      time,
      disabled: slotPassed(date, time),
    }))
  );
  const focusCell =
    cells.find((cell) => cell.key === activeCell && !cell.disabled)?.key ??
    cells.find((cell) => !cell.disabled)?.key;

  function moveFocus(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const horizontal = event.key === "ArrowRight" || event.key === "ArrowLeft";
    const rowBoundary =
      horizontal || (!event.ctrlKey && (event.key === "Home" || event.key === "End"));
    const lower = rowBoundary ? Math.floor(index / 7) * 7 : 0;
    const upper = rowBoundary ? lower + 6 : cells.length - 1;
    let next = index;
    let step = 1;
    if (event.key === "ArrowRight") next += 1;
    else if (event.key === "ArrowLeft") {
      next -= 1;
      step = -1;
    } else if (event.key === "ArrowDown") {
      next += 7;
      step = 7;
    } else if (event.key === "ArrowUp") {
      next -= 7;
      step = -7;
    } else if (event.key === "Home") next = lower;
    else if (event.key === "End") {
      next = upper;
      step = -1;
    } else return;
    event.preventDefault();
    while (next >= lower && next <= upper && cells[next].disabled) next += step;
    if (next < lower || next > upper) return;
    scroll.current
      ?.querySelector<HTMLButtonElement>(`[data-calendar-cell="${cells[next].key}"]`)
      ?.focus();
  }

  const firstDate = dates[0];
  useEffect(() => {
    if (view === "week" && scroll.current) scroll.current.scrollTop = 16 * 44;
  }, [view, firstDate]);
  const today = bangkokToday();
  const slots = new Map(
    calendar.days.map((day) => [day.date, new Map(day.slots.map((slot) => [slot.time, slot]))])
  );
  const subjects = new Map(calendar.subjects.map((subject) => [subject.id, subject.name]));

  if (view === "month")
    return (
      <div
        className="mt-5 overflow-x-auto rounded-xl border border-line"
        aria-label="Monthly availability"
      >
        <div className="grid min-w-[560px] grid-cols-7">
          {dates.slice(0, 7).map((date) => (
            <div
              key={date}
              className="border-b border-line bg-surface-muted p-3 text-center text-xs font-semibold"
            >
              {formatDate(date, { weekday: "short" })}
            </div>
          ))}
          {dates.map((date) => {
            const saved = calendar.days.find((day) => day.date === date)?.slots ?? [];
            const open = saved.filter((slot) => slot.isOpen && !slot.locked).length;
            const locked = saved.filter((slot) => slot.locked).length;
            return (
              <button
                key={date}
                type="button"
                onClick={() => onDate(date)}
                aria-label={`View week of ${date}`}
                className={`min-h-28 border-b border-r border-line p-2 text-left hover:bg-brand-soft focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-brand-link   ${date.slice(0, 7) !== anchor.slice(0, 7) ? "bg-surface-muted text-muted" : ""}`}
              >
                <span
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${date === today ? "bg-brand-navy text-white" : ""}`}
                >
                  {Number(date.slice(8))}
                </span>
                <span className="mt-2 block text-xs text-brand-link">
                  {open ? `${open} open` : "No open slots"}
                </span>
                {locked > 0 && (
                  <span className="mt-1 block text-xs text-amber-800 dark:text-amber-300">
                    {locked} locked
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );

  return (
    <>
      <p id={hintId} className="mt-4 text-sm text-secondary">
        Scroll to see all days and times. Use arrow keys to move between slots; press Enter to edit.
        Times are in Bangkok (UTC+7).
      </p>
      <div
        ref={scroll}
        className="mt-5 max-h-[36rem] overflow-auto rounded-xl border border-line"
        aria-label="Weekly availability"
      >
        <div
          role="grid"
          aria-label="Weekly half-hour calendar"
          aria-describedby={hintId}
          className="min-w-[760px]"
        >
          <div
            role="row"
            className={`${columns} sticky top-0 z-10 border-b border-line bg-surface shadow-sm  `}
          >
            <div role="columnheader" className="px-1 py-4 text-center text-xs text-muted">
              UTC+7
            </div>
            {dates.map((date) => (
              <div
                role="columnheader"
                key={date}
                className="border-l border-line px-1 py-2 text-center"
              >
                <span className="block text-xs font-medium text-muted">
                  {formatDate(date, { weekday: "short" })}
                </span>
                <span
                  className={`mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-lg font-semibold ${date === today ? "bg-brand-navy text-white" : ""}`}
                >
                  {Number(date.slice(8))}
                </span>
              </div>
            ))}
          </div>
          {halfHours.map((time, timeIndex) => (
            <div
              role="row"
              key={time}
              className={`${columns} h-11 ${time.endsWith(":00") ? "border-t border-line" : "border-t border-dashed border-line"}`}
            >
              <div
                role="rowheader"
                className="sticky left-0 z-10 bg-surface-muted pr-2 pt-1 text-right text-xs tabular-nums text-muted"
              >
                {time}
              </div>
              {dates.map((date, dayIndex) => {
                const slot = slots.get(date)?.get(time) ?? null;
                const past = slotPassed(date, time);
                const state = slot?.locked ? "Reserved / booked" : slot?.isOpen ? "Open" : "Closed";
                const names =
                  slot?.subjectIds
                    .map((id) => subjects.get(id))
                    .filter(Boolean)
                    .join(", ") ?? "";
                return (
                  <div role="gridcell" key={date} className="min-w-0 border-l border-line p-0.5">
                    <button
                      type="button"
                      aria-label={`${date} ${time}: ${state}`}
                      title={`${date} ${time} · ${state}${names ? ` · ${names}` : ""}`}
                      disabled={past}
                      data-calendar-cell={`${date}T${time}`}
                      tabIndex={focusCell === `${date}T${time}` ? 0 : -1}
                      onFocus={() => setActiveCell(`${date}T${time}`)}
                      onKeyDown={(event) => moveFocus(event, timeIndex * 7 + dayIndex)}
                      onClick={() => onSlot(date, time, slot)}
                      className={`group h-full w-full overflow-hidden rounded px-1.5 text-left text-xs leading-tight transition-colors focus-visible:outline-2 focus-visible:outline-brand-link ${slot?.locked ? "bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-200" : slot?.isOpen ? "bg-brand-soft text-brand-link hover:bg-brand-soft" : past ? "bg-surface-muted/70" : "hover:bg-brand-soft"} disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      {slot?.locked || slot?.isOpen ? (
                        <>
                          <span className="block truncate font-medium">
                            {slot.locked ? "Locked" : names}
                          </span>
                          {slot.locked && <span className="block truncate">{names}</span>}
                        </>
                      ) : (
                        <span className="text-muted opacity-100 [@media(hover:hover)]:opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100">
                          + Open slot
                        </span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
