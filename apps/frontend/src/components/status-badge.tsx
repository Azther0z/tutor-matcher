// A review outcome shared by top-up and refund requests.
export type ReviewStatus = "PENDING" | "APPROVED" | "REJECTED";

// Same colors as tutor review: pending amber, approved green, rejected red.
const statuses: Record<ReviewStatus, { label: string; color: string }> = {
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

export function StatusBadge({ status }: { status: ReviewStatus }) {
  const { label, color } = statuses[status];
  return (
    <span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${color}`}>{label}</span>
  );
}
