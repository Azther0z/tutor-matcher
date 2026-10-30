# Proposal: One wallet page with a filterable ledger and transaction detail

## Intent

PAY-5 gives every user one money page. Top-ups, lesson payments, lesson earnings, refunds and
payouts already write Wallet Transactions (PAY-1, BOOK-3, BOOK-4, PAY-7), but no page lists
them. Users need one place to read their balance and history, without separate Payments and
Earnings pages.

## Scope

In scope:

- `/wallet`: available balance, pending earnings, earnings this month and all-time paid out,
  above one transaction list filterable by All / Top-ups / Lesson payments / Lesson earnings /
  Payouts / Refunds.
- A **Payment due** notice on `/wallet` listing the user's unpaid bookings, each linking to
  `/bookings/:id` to pay there. Unpaid bookings stay out of the ledger.
- `/wallet/transactions/:id`: read-only detail with type, amount, direction (derived from the
  type), status (always Completed), date, resulting balance, the related booking (if any) and
  the payout account for payouts. No payment action.
- Owner-only read API for the overview, the transaction list and one transaction.
- A **Wallet** link in the account menu.

Out of scope:

- Any new money movement, schema change, settlement (CLASS-3) or payout behaviour.
- Pending ledger rows, a status or direction column, or payment from wallet history.
- The Tutor dashboard's wallet and earnings preview.

## Approach

Add read-only endpoints to the existing wallet module. Direction comes from the existing
ledger sign map and status is a constant, because every row is a completed movement. Pending
earnings are computed from the Tutor's CONFIRMED bookings minus the provisional 15% platform
fee, as the approved ledger decision describes. Add the two frontend pages next to
`/wallet/topup` and `/wallet/payout`.

## Affected Specs

- `wallet`: added wallet overview, filterable ledger and read-only transaction detail.

## Impact

- `apps/backend/src/modules/wallet/`: read endpoints, query schema and tests.
- `apps/frontend/app/wallet/`: `/wallet` and `/wallet/transactions/[id]` pages and tests.
- `apps/frontend/src/lib/wallet-api.ts`, `apps/frontend/src/components/navbar.tsx`.
- `docs/user-journeys.md`, `CONTEXT.md`, `docs/testing.md`, `docs/index.md`, evidence under
  `docs/sources/`.
