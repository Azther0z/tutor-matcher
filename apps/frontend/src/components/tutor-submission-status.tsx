import type { TutorVersionStatus } from "@/src/lib/tutor-application";

const statuses: Record<TutorVersionStatus, { label: string; color: string }> = {
  DRAFT: { label: "Draft", color: "bg-surface-muted text-secondary" },
  PENDING: {
    label: "Pending Verification",
    color: "bg-amber-500/10 text-amber-800 dark:text-amber-300",
  },
  APPROVED: {
    label: "Approved",
    color: "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
  },
  REJECTED: { label: "Rejected", color: "bg-rose-500/10 text-rose-800 dark:text-rose-300" },
  CANCELLED: { label: "Cancelled", color: "bg-surface-muted text-secondary" },
};

export function TutorSubmissionStatus({
  status,
  plain = false,
}: {
  status: TutorVersionStatus;
  plain?: boolean;
}) {
  const { label, color } = statuses[status];
  if (plain) {
    const textColor = color
      .split(" ")
      .filter((token) => !token.startsWith("bg-"))
      .join(" ");
    return <span className={`text-sm font-medium ${textColor}`}>{label}</span>;
  }
  return (
    <span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${color}`}>{label}</span>
  );
}
