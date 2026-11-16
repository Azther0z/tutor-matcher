import Link from "next/link";
import { dateTime, money } from "@/src/lib/booking-format";
import type { Booking } from "@/src/types/booking";

// PAY-6: the Tutor's net earning for this lesson, and why it is still held, if it is.
export function EarningsNote({ earnings }: { earnings: NonNullable<Booking["earnings"]> }) {
  return (
    <section
      aria-label="Lesson earnings"
      className="mt-5 border-t border-zinc-200 pt-5 dark:border-zinc-800"
    >
      <h3 className="font-semibold">
        {earnings.status === "PENDING" ? "Pending earnings" : "Cleared earnings"}
      </h3>
      <p className="mt-1 text-xl font-bold">{money.format(Number(earnings.amount))}</p>
      <p className="mt-2 text-sm text-zinc-500">
        {earnings.status === "PENDING" ? (
          <>
            After the 15% platform fee. Available after{" "}
            {dateTime.format(new Date(earnings.clearsAt))}; it is not in your available balance yet
            and moves to your wallet the next time you view or use your balance.
            {earnings.holdReason === "AWAITING_COMPLETION" &&
              " The Tutor must confirm the lesson first."}
            {earnings.holdReason === "CLEARING_PERIOD" &&
              " The 24-hour clearing period is still in progress."}
            {earnings.holdReason === "REFUND_REVIEW" &&
              " It is held until the Admin decides the refund request."}
            {earnings.holdReason === "READY_TO_CLEAR" &&
              " The clearing period has ended; it will move when you next view or use your wallet."}
          </>
        ) : (
          "This earning has been cleared into your wallet."
        )}
      </p>
      <Link
        href="/wallet"
        className="mt-3 inline-block text-sm font-semibold text-violet-600 underline"
      >
        View wallet
      </Link>
    </section>
  );
}
