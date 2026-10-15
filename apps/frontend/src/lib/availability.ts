import { tutorApi } from "./tutor-application";
import type { SubjectOffering } from "./subjects";

export type EditableSlot = { isOpen: boolean; subjectIds: string[] };
export type StoredSlot = EditableSlot & {
  id: string;
  time: string;
  locked: boolean;
  revision: string;
};
export type AvailabilityDay = { date: string; slots: StoredSlot[] };
export type AvailabilityCalendar = {
  timeZone: "Asia/Bangkok";
  days: AvailabilityDay[];
  subjects: SubjectOffering[];
};
export type CalendarView = "week" | "month";
export const halfHours = Array.from(
  { length: 48 },
  (_, index) => `${String(Math.floor(index / 2)).padStart(2, "0")}:${index % 2 ? "30" : "00"}`
);

export function bangkokToday() {
  return new Date(Date.now() + 7 * 60 * 60_000).toISOString().slice(0, 10);
}
export function slotPassed(date: string, time: string) {
  return new Date(`${date}T${time}:00+07:00`).getTime() <= Date.now();
}
export function shiftDate(date: string, days: number) {
  return new Date(Date.parse(date) + days * 86_400_000).toISOString().slice(0, 10);
}
export function weekStart(date: string) {
  return shiftDate(date, -((new Date(date).getUTCDay() + 6) % 7));
}
export function shiftMonth(date: string, months: number) {
  const next = new Date(`${date.slice(0, 7)}-01T00:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next.toISOString().slice(0, 10);
}
export function calendarDates(date: string, view: CalendarView) {
  const start = weekStart(view === "week" ? date : `${date.slice(0, 7)}-01`);
  return Array.from({ length: view === "week" ? 7 : 42 }, (_, index) => shiftDate(start, index));
}
export function formatDate(date: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" }).format(new Date(date));
}
export function sameSlot(left: EditableSlot, right: EditableSlot) {
  return (
    left.isOpen === right.isOpen &&
    JSON.stringify([...left.subjectIds].sort()) === JSON.stringify([...right.subjectIds].sort())
  );
}
export function getAvailabilityCalendar(from: string, to: string) {
  return tutorApi<AvailabilityCalendar>(
    `/api/profiles/me/tutor/availability/calendar?from=${from}&to=${to}`
  );
}
export function getAvailabilityDay(date: string) {
  return tutorApi<AvailabilityDay & Pick<AvailabilityCalendar, "subjects" | "timeZone">>(
    `/api/profiles/me/tutor/availability/${date}`
  );
}
export function saveAvailabilitySlot(
  date: string,
  time: string,
  base: StoredSlot | null,
  draft: EditableSlot
) {
  return tutorApi<{ date: string; slot: StoredSlot }>(
    `/api/profiles/me/tutor/availability/${date}/${time}`,
    { method: "PUT", body: JSON.stringify({ revision: base?.revision ?? null, ...draft }) }
  );
}
