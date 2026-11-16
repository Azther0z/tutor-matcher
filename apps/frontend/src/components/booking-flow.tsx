import type { BookingStatus } from "@/src/types/booking";

const BOOKING_STEPS = ["Pick time", "Payment", "Confirmed", "Completed"];
type BookingStep = 1 | 2 | 3 | 4;

export function BookingProgress({
  status,
  currentStep,
  className = "",
}: {
  status?: BookingStatus;
  currentStep: BookingStep;
  className?: string;
}) {
  return (
    <section aria-label="Booking progress" className={className}>
      <ol className="grid grid-cols-4 gap-2 sm:gap-3">
        {BOOKING_STEPS.map((label, index) => {
          const step = index + 1;
          const isCurrent = step === currentStep;
          const reached = step <= currentStep;
          return (
            <li key={label} aria-current={isCurrent ? "step" : undefined} className="min-w-0">
              <div
                aria-hidden="true"
                className={`h-1.5 rounded-full ${reached ? "bg-brand-navy" : "bg-surface-muted"}`}
              />
              <p
                className={`mt-2 text-[0.65rem] font-semibold leading-tight sm:text-sm ${reached ? "text-brand-link" : "text-muted"}`}
              >
                {label}
              </p>
            </li>
          );
        })}
      </ol>
      {status === "CANCELLED" && (
        <p className="mt-3 text-sm font-medium text-secondary" role="status">
          This booking was cancelled.
        </p>
      )}
    </section>
  );
}
