import type { TutorVersionStatus } from "@/src/lib/tutor-application";

const statuses: Record<TutorVersionStatus, { label: string; color: string }> = {
  DRAFT: { label: "Draft", color: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-300" },
  PENDING: {
    label: "Pending Verification",
    color: "bg-amber-500/10 text-amber-800 dark:text-amber-300",
  },
  APPROVED: {
    label: "Approved",
    color: "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
  },
  REJECTED: { label: "Rejected", color: "bg-rose-500/10 text-rose-800 dark:text-rose-300" },
  CANCELLED: { label: "Cancelled", color: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-300" },
};

export function TutorSubmissionStatus({ status }: { status: TutorVersionStatus }) {
  const { label, color } = statuses[status];
  return (
    <span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${color}`}>{label}</span>
  );
}
