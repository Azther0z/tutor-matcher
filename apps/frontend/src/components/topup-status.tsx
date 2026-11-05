import type { TopupStatus } from "@/src/lib/wallet-api";

// Same colors as tutor review: pending amber, approved green, rejected red.
const statuses: Record<TopupStatus, { label: string; color: string }> = {
  PENDING: {
    label: "Pending approval",
    color: "bg-amber-500/10 text-amber-800 dark:text-amber-300",
  },
  APPROVED: {
    label: "Approved",
    color: "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
  },
  REJECTED: { label: "Rejected", color: "bg-rose-500/10 text-rose-800 dark:text-rose-300" },
};

export function TopupStatusBadge({ status }: { status: TopupStatus }) {
  const { label, color } = statuses[status];
  return (
    <span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${color}`}>{label}</span>
  );
}
