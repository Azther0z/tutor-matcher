import { useEffect, useRef } from "react";
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
        className="mt-5 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700"
        aria-label="Monthly availability"
      >
        <div className="grid min-w-[560px] grid-cols-7">
          {dates.slice(0, 7).map((date) => (
            <div
              key={date}
              className="border-b border-zinc-200 bg-zinc-50 p-3 text-center text-xs font-semibold uppercase tracking-wide dark:border-zinc-700 dark:bg-zinc-900"
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
                className={`min-h-28 border-b border-r border-zinc-200 p-2 text-left hover:bg-violet-50 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-violet-700 dark:border-zinc-700 dark:hover:bg-violet-950 ${date.slice(0, 7) !== anchor.slice(0, 7) ? "bg-zinc-50 text-zinc-400 dark:bg-zinc-900" : ""}`}
              >
                <span
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${date === today ? "bg-violet-700 text-white" : ""}`}
                >
                  {Number(date.slice(8))}
                </span>
                <span className="mt-2 block text-xs text-violet-800 dark:text-violet-300">
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
    <div
      ref={scroll}
      className="mt-5 max-h-[36rem] overflow-auto rounded-xl border border-zinc-200 dark:border-zinc-700"
      aria-label="Weekly availability"
    >
      <div role="grid" aria-label="Weekly half-hour calendar" className="min-w-[760px]">
        <div
          role="row"
          className={`${columns} sticky top-0 z-10 border-b border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-950`}
        >
          <div role="columnheader" className="px-1 py-4 text-center text-xs text-zinc-500">
            UTC+7
          </div>
          {dates.map((date) => (
            <div
              role="columnheader"
              key={date}
              className="border-l border-zinc-200 px-1 py-2 text-center dark:border-zinc-700"
            >
              <span className="block text-xs font-medium text-zinc-500">
                {formatDate(date, { weekday: "short" })}
              </span>
              <span
                className={`mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-lg font-semibold ${date === today ? "bg-violet-700 text-white" : ""}`}
              >
                {Number(date.slice(8))}
              </span>
            </div>
          ))}
        </div>
        {halfHours.map((time) => (
          <div
            role="row"
            key={time}
            className={`${columns} h-11 ${time.endsWith(":00") ? "border-t border-zinc-200 dark:border-zinc-700" : "border-t border-dashed border-zinc-100 dark:border-zinc-800"}`}
          >
            <div
              role="rowheader"
              className="bg-zinc-50 pr-2 pt-1 text-right text-[11px] tabular-nums text-zinc-500 dark:bg-zinc-900"
            >
              {time}
            </div>
            {dates.map((date) => {
              const slot = slots.get(date)?.get(time) ?? null;
              const past = slotPassed(date, time);
              const state = slot?.locked ? "Reserved / booked" : slot?.isOpen ? "Open" : "Closed";
              const names =
                slot?.subjectIds
                  .map((id) => subjects.get(id))
                  .filter(Boolean)
                  .join(", ") ?? "";
              return (
                <div
                  role="gridcell"
                  key={date}
                  className="min-w-0 border-l border-zinc-200 p-0.5 dark:border-zinc-700"
                >
                  <button
                    type="button"
                    aria-label={`${date} ${time}: ${state}`}
                    title={`${date} ${time} · ${state}${names ? ` · ${names}` : ""}`}
                    disabled={past}
                    onClick={() => onSlot(date, time, slot)}
                    className={`group h-full w-full overflow-hidden rounded px-1.5 text-left text-[10px] leading-tight transition-colors focus-visible:outline-2 focus-visible:outline-violet-700 ${slot?.locked ? "bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-200" : slot?.isOpen ? "bg-violet-100 text-violet-950 hover:bg-violet-200 dark:bg-violet-950 dark:text-violet-200" : past ? "bg-zinc-100/70 dark:bg-zinc-900" : "hover:bg-violet-50 dark:hover:bg-violet-950"} disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    {slot?.locked || slot?.isOpen ? (
                      <>
                        <span className="block font-semibold">
                          {slot.locked ? "Locked" : names}
                        </span>
                        {slot.locked && <span className="block truncate">{names}</span>}
                      </>
                    ) : (
                      <span className="opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100">
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
  );
}
