import type { Booking } from "@/src/types/booking";

export const TIME_ZONE = "Asia/Bangkok";
export const money = new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" });
export const dateTime = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});
export const statusStyle: Record<Booking["status"], string> = {
  PENDING_PAYMENT: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-emerald-100 text-emerald-800",
  COMPLETED: "bg-blue-100 text-blue-800",
  CANCELLED: "bg-zinc-200 text-zinc-700",
};
