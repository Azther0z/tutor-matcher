"use client";

const dayHeading = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Bangkok",
});
const clock = (index: number) =>
  `${String(Math.floor(index / 2)).padStart(2, "0")}:${index % 2 ? "30" : "00"}`;

// Show every half-hour as a separate tile, matching the booking picker.
// This preview remains informational; Book this subject opens the interactive picker.
export function SubjectDayCalendar({ date, openSlots }: { date: string; openSlots: string[] }) {
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
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="font-semibold">{heading}</h3>
        <p className="text-sm text-secondary">
          {blocks.length
            ? `Open times: ${blocks.map(blockLabel).join(", ")}`
            : "No open times on this day"}
        </p>
      </div>
      <div role="region" aria-label={`Calendar for ${heading}`}>
        <ol className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
          {halfHours.map((slot) => (
            <li
              key={slot.index}
              className={`flex min-h-10 min-w-0 items-center justify-center rounded-lg border px-1 py-2 text-center text-sm tabular-nums ${slot.available ? "border-line bg-transparent text-foreground" : "border-transparent bg-surface-muted text-muted opacity-30"}`}
            >
              <span aria-hidden="true" className="font-semibold">
                {slot.time}
              </span>
              <span className="sr-only">{`${slot.label} ${slot.available ? "Available" : "Not available"}`}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
