---
type: raw
source: null
collected: 2026-10-16
published: 2026-10-12
---

# Decision: wallet money is an append-only ledger

**Status:** proposed, for team review · **Date:** 2026-10-12 · **Based on:** `main` at `769d102`  
**Replaces:** `Payment`, `PaymentType`, `PaymentStatus` in `schema.prisma`

## Context

TutorMatcher has five kinds of money movement (`docs/user-journeys.md` §4): top-up, lesson payment, class earning, refund and payout. The current `Payment` table models them as one row with `fromUserId` / `toUserId`, a type (`TRANSFER`, `REFUND`, `PAYOUT`) and a status (`PENDING`, `HOLDING`, `COMPLETED`, `CANCELLED`).

That shape has three problems:

- **A lesson needs two moments.** The student's money leaves when they pay, but the tutor's share arrives only after the lesson. One row with one status can't be "done" for the student and "on hold" for the tutor at the same time.
- **The amounts differ.** The student pays 500, the tutor earns 425 after the 15% platform fee. One `amount` column can't hold both.
- **Top-up and payout have no other user.** Their money comes from or goes to a bank, so `fromUserId` or `toUserId` is always empty.

`docs/database-schema.md` already lists this as gaps G4 and G5.

## Decision

1. **One row per wallet movement.** A `WalletTransaction` row belongs to exactly one user's wallet. A lesson produces a `LESSON_PAYMENT` row on the student and, later, an `LESSON_EARNING` row on the tutor, both linked by `bookingId`. It is named `LESSON_EARNING` (not just `EARNING`) so it pairs with `LESSON_PAYMENT` and can't be confused with `PAYOUT`.
2. **A row is written only when money actually moves.** Rows are append-only: never updated, never deleted. A failed top-up or payout writes nothing.
3. **No `status` column.** Every row is a movement that already happened, so nothing is ever pending, failed or cancelled.
4. **No `direction` column.** The type decides the sign: `TOP_UP`, `LESSON_EARNING` and `REFUND` add; `LESSON_PAYMENT` and `PAYOUT` subtract.
5. **The tutor is paid when the lesson is confirmed.** The `LESSON_EARNING` row is written when the student confirms the lesson, or automatically 24 h after it ends, whichever comes first. This 24 h is the clearing period in `user-journeys.md` §4.
6. **The platform's money is not a wallet.** The platform keeps whatever was paid in and not paid back out (fees, kept cancellation money). Every baht is still traceable through `bookingId` and the booking's status.
7. **Rates are named settings.** The platform fee is a named constant read from env with a default, next to the existing `BOOKING_LATE_REFUND_RATE`. It is not hardcoded where it's used.

## Where is the student's 500 after they pay?

A lone `−500` row can look like money vanishing from the system, but it doesn't vanish. It is held by the platform for that booking, and the booking's status tells you exactly where it went:

| Booking status | Where the 500 is |
|---|---|
| CONFIRMED | Held for this booking (no tutor row yet) |
| COMPLETED | 425 in the tutor's wallet (`LESSON_EARNING`), 75 platform fee |
| CANCELLED early | All 500 back in the student's wallet (`REFUND`) |
| CANCELLED late | 350 back to the student; the other 150 goes to the tutor and/or the platform (team decision) |

The whole system can be checked with one equation:

> **Σ top-ups − Σ payouts = Σ user balances + money held for CONFIRMED bookings + platform revenue**

If it ever fails, there's a bug. The implementation guide has the query for it.

## Considered options

| Option | Why not chosen |
|---|---|
| Keep one from/to row per lesson | One status and one amount can't describe both sides (see Context). |
| Keep `status` and `direction` columns | They only exist to describe rows that haven't happened yet. Writing rows only on movement removes that need, and the type already gives the sign. |
| A platform wallet user, so every movement has a matching row (strict double entry) | Every payment would update one shared row, which slows down and conflicts under load. The platform isn't a user in the domain model. Booking status already tells us where held money is. Can be added later if the business side grows. |
| Store pending earnings as ledger rows | That brings `status` back. Pending earnings are computed from CONFIRMED bookings instead. |
| Hardcode the fee and refund rates | The numbers still need product sign-off (`user-journeys.md` §4); changing them should mean changing one setting. |

## Consequences

- **Top-up and payout must finish in one request,** mocked or confirmed before the row is written. If either becomes asynchronous later (a real PromptPay webhook, admin-approved payouts), the in-flight request gets its own table (`TopUpRequest`, `PayoutRequest`) and the ledger stays as it is.
- **"Pending earnings" on `/wallet` are calculated, not stored.** They are the tutor's CONFIRMED bookings minus the fee.
- **Booking code changes.** `createBooking` stops creating a `PENDING` `TRANSFER` row; the amount due comes from `Booking.totalAmount`. `confirmBookingPayment`, `cancelBooking`, `releaseExpiredBookings` and `quoteFor` move from `Payment` to `WalletTransaction`.
- **New work:** a "confirm lesson" action for the student, and auto-completion after 24 h.
- **Docs to update:** `database-schema.md` (payments table, rules 10 and 11, gaps G4 and G5), and `user-journeys.md` §4. Rename the glossary term **Earning** / "class earning" in `CONTEXT.md` to **Lesson Earning**. An unpaid booking no longer appears in the wallet's transaction list, only on `/bookings`.

## Open questions

- **Late cancellation share:** does the tutor get part of what the student loses, or does the platform keep it all?
- **Numbers:** the 15% fee, 24 h clearing, 70% late refund and 24 h cancellation window still need sign-off. `user-journeys.md` says 12 h for free cancellation, but the code defaults to 24 h.
- **Disputes:** what happens when a student says a lesson didn't happen. An admin settles it with either a `REFUND` or an `LESSON_EARNING`.
