"use client";

import { useMemo } from "react";
import type { AvailabilitySlot } from "@/src/types/booking";

const SLOT_DURATION_MS = 30 * 60 * 1000;

type ContinuousSlotPickerProps = {
  slots: AvailabilitySlot[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onSelectionMessage?: (message: string | null) => void;
  requiredCount?: number;
  timeZone?: string;
};

function dateKey(value: string, timeZone?: string) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).format(new Date(value));
}

export function nextContinuousSelection(
  slots: AvailabilitySlot[],
  selectedIds: string[],
  clickedId: string,
  requiredCount?: number,
  timeZone?: string
) {
  const sorted = [...slots].sort(
    (left, right) => new Date(left.startedAt).getTime() - new Date(right.startedAt).getTime()
  );
  const clicked = sorted.find((slot) => slot.id === clickedId);
  if (!clicked) return { ids: selectedIds, message: null };

  const selected = sorted.filter((slot) => selectedIds.includes(slot.id));
  const clickedIndex = selected.findIndex((slot) => slot.id === clickedId);

  if (clickedIndex >= 0) {
    if (selected.length === 1) return { ids: [], message: null };
    if (clickedIndex === 0 || clickedIndex === selected.length - 1) {
      return {
        ids: selected.filter((slot) => slot.id !== clickedId).map((slot) => slot.id),
        message: null,
      };
    }
    return {
      ids: selected.map((slot) => slot.id),
      message: "Remove the first or last selected time to keep the lesson continuous.",
    };
  }

  if (selected.length === 0) return { ids: [clicked.id], message: null };

  const first = selected[0]!;
  const last = selected.at(-1)!;
  const clickedTime = new Date(clicked.startedAt).getTime();
  const firstTime = new Date(first.startedAt).getTime();
  const lastTime = new Date(last.startedAt).getTime();
  const sameDay = dateKey(clicked.startedAt, timeZone) === dateKey(first.startedAt, timeZone);
  const extendsBlock =
    sameDay &&
    (clickedTime === firstTime - SLOT_DURATION_MS || clickedTime === lastTime + SLOT_DURATION_MS);

  if (extendsBlock && (!requiredCount || selected.length < requiredCount)) {
    return {
      ids: [...selected, clicked]
        .sort(
          (left, right) => new Date(left.startedAt).getTime() - new Date(right.startedAt).getTime()
        )
        .map((slot) => slot.id),
      message: null,
    };
  }

  return {
    ids: [clicked.id],
    message:
      requiredCount && selected.length >= requiredCount
        ? `Choose exactly ${requiredCount} consecutive time ${requiredCount === 1 ? "slot" : "slots"}. A new selection was started.`
        : "Times must be consecutive and on the same day. A new selection was started.",
  };
}

export function ContinuousSlotPicker({
  slots,
  selectedIds,
  onChange,
  onSelectionMessage,
  requiredCount,
  timeZone,
}: ContinuousSlotPickerProps) {
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
        timeZone,
      }),
    [timeZone]
  );
  const timeFormatter = useMemo(
    () => new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone }),
    [timeZone]
  );
  const grouped = useMemo(() => {
    const groups = new Map<string, AvailabilitySlot[]>();
    for (const slot of [...slots].sort(
      (left, right) => new Date(left.startedAt).getTime() - new Date(right.startedAt).getTime()
    )) {
      if (slot.available === false) continue;
      const label = dateFormatter.format(new Date(slot.startedAt));
      groups.set(label, [...(groups.get(label) ?? []), slot]);
    }
    return [...groups.entries()];
  }, [dateFormatter, slots]);

  return (
    <div className="space-y-6">
      {grouped.map(([label, dateSlots]) => (
        <fieldset key={label}>
          <legend className="mb-3 font-semibold">{label}</legend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {dateSlots.map((slot) => {
              const active = selectedIds.includes(slot.id);
              return (
                <button
                  type="button"
                  key={slot.id}
                  aria-pressed={active}
                  onClick={() => {
                    const next = nextContinuousSelection(
                      slots,
                      selectedIds,
                      slot.id,
                      requiredCount,
                      timeZone
                    );
                    onChange(next.ids);
                    onSelectionMessage?.(next.message);
                  }}
                  className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                    active
                      ? "border-violet-600 bg-violet-600 text-white"
                      : "border-zinc-200 bg-white hover:border-violet-400 dark:border-zinc-700 dark:bg-zinc-950"
                  }`}
                >
                  {timeFormatter.format(new Date(slot.startedAt))}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
