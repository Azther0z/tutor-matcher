"use client";

import Link from "next/link";
import { useState } from "react";
import { BookingApiError, confirmPayment } from "@/src/lib/bookings-api";
import { dateTime, money } from "@/src/lib/booking-format";
import type { BookingPanelContext } from "@/src/lib/use-booking-detail";
import { publishWalletBalance } from "@/src/lib/wallet-api";

// BOOK-1: the Student pays a pending booking from the wallet; the slot may have been taken.
export function usePayment(context: BookingPanelContext) {
  const { booking, setBusy, setBooking, setMessage, reload } = context;
  const [slotUnavailable, setSlotUnavailable] = useState(false);

  async function pay() {
    if (!booking.actions.canPay || !booking.payment.canPay) return;
    setBusy(true);
    setMessage(null);
    try {
      const confirmed = await confirmPayment(booking.id);
      setBooking(confirmed);
      if (confirmed.payment.walletBalance !== null) {
        publishWalletBalance(confirmed.payment.walletBalance);
      }
      setMessage("Payment confirmed. Your lesson is booked.");
    } catch (error) {
      if (error instanceof BookingApiError && error.code === "BOOKING_EXPIRED") {
        setMessage("This payment request expired. Choose an available time to try again.");
        await reload();
      } else if (error instanceof BookingApiError && error.code === "SLOT_TAKEN") {
        setSlotUnavailable(true);
        setMessage(
          "These times are no longer available. Your wallet was not charged. Choose another time."
        );
      } else if (error instanceof BookingApiError && error.code === "BOOKING_ALREADY_PAID") {
        setMessage("This booking has already been paid.");
        await reload();
      } else if (error instanceof BookingApiError && error.code === "INSUFFICIENT_BALANCE") {
        setMessage("Your wallet balance is not enough to pay for this booking.");
        await reload();
      } else {
        setMessage(error instanceof Error ? error.message : "Payment could not be confirmed.");
      }
    } finally {
      setBusy(false);
    }
  }

  return { pay, slotUnavailable };
}

export function PaymentBox({
  context,
  onPay,
}: {
  context: BookingPanelContext;
  onPay: () => Promise<void>;
}) {
  const { booking, busy } = context;
  if (booking.status !== "PENDING_PAYMENT") return null;
  const shortfall = Number(booking.payment.shortfall ?? 0);
  const topUpHref = `/wallet/topup?${new URLSearchParams({
    amount: String(shortfall),
    returnTo: `/bookings/${booking.id}`,
  }).toString()}`;
  return (
    <>
      {booking.payment.expiresAt && (
        <p className="mt-2 text-xs text-zinc-500">
          Payment request expires {dateTime.format(new Date(booking.payment.expiresAt))}
        </p>
      )}
      {booking.payment.walletBalance !== null && (
        <button
          disabled={busy || !booking.actions.canPay || !booking.payment.canPay}
          onClick={() => void onPay()}
          className="mt-5 h-11 w-full rounded-full bg-violet-600 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Processing…" : "Confirm payment"}
        </button>
      )}
      {shortfall > 0 && (
        <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          <p>You need {money.format(shortfall)} more to pay.</p>
          <Link href={topUpHref} className="mt-2 inline-block font-semibold underline">
            Top up {money.format(shortfall)}
          </Link>
        </div>
      )}
    </>
  );
}
