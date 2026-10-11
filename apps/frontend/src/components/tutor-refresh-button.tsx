"use client";

export function TutorRefreshButton({
  label,
  onClick,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-black/[.12] hover:bg-black/[.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 disabled:opacity-60 dark:border-white/[.18] dark:hover:bg-white/[.08]"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        <path d="M20 7v5h-5M20 12a8 8 0 1 0-2.4 5.7" />
      </svg>
    </button>
  );
}
