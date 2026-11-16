import { useState } from "react";
import styles from "./tutor-availability-calendar.module.css";
import { TutorAvailabilityTimeline, type PeriodChange } from "./tutor-availability-timeline";
import {
  bangkokToday,
  formatDate,
  shiftDate,
  type AvailabilityCalendar,
} from "@/src/lib/availability";

type Props = {
  anchor: string;
  calendar: AvailabilityCalendar;
  disabled?: boolean;
  onDate: (date: string) => void;
  onApply: (changes: PeriodChange[]) => Promise<boolean>;
};

export function TutorAvailabilityCalendar({
  anchor,
  calendar,
  disabled = false,
  onDate,
  onApply,
}: Props) {
  const today = bangkokToday();
  const [direction, setDirection] = useState("next");
  function selectDate(date: string) {
    setDirection(date < anchor ? "previous" : "next");
    onDate(date);
  }
  const nearbyDays = Array.from({ length: 7 }, (_, index) => shiftDate(anchor, index - 3));
  return (
    <div className="mt-4 flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold" aria-live="polite">
          {formatDate(anchor, { month: "long", year: "numeric" })}
        </h3>
        <label className="flex items-center gap-2 text-xs text-muted">
          Go to date
          <input
            type="date"
            min={today}
            value={anchor}
            disabled={disabled}
            onChange={(event) => {
              if (event.target.value >= today) selectDate(event.target.value);
            }}
            className="min-h-10 rounded-lg border border-line bg-transparent px-2 text-sm text-foreground"
          />
        </label>
      </div>
      <nav aria-label="Availability dates" className="min-w-0 overflow-hidden">
        <div
          key={anchor}
          className={`grid min-w-0 grid-cols-7 gap-1 ${direction === "next" ? styles.next : styles.previous}`}
          aria-label="Nearby days"
        >
          {nearbyDays.map((date) => (
            <button
              key={date}
              type="button"
              aria-label={date}
              aria-pressed={date === anchor}
              disabled={disabled || date < today}
              onClick={() => selectDate(date)}
              className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 border-b-2 px-0.5 py-2 sm:px-2 disabled:opacity-30 ${date === anchor ? "border-brand-navy font-semibold text-brand-link" : "border-transparent text-secondary hover:bg-surface-muted"}`}
            >
              <span className="text-xs">{formatDate(date, { weekday: "short" })}</span>
              <span className="whitespace-nowrap text-xs sm:text-sm">
                {formatDate(date, { day: "numeric", month: "short" })}
              </span>
            </button>
          ))}
        </div>
      </nav>
      <div key={`slots-${anchor}`} className={styles.slots}>
        <TutorAvailabilityTimeline
          date={anchor}
          calendar={calendar}
          disabled={disabled}
          onApply={onApply}
        />
      </div>
    </div>
  );
}
