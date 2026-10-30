# Design: One wallet page with a filterable ledger and transaction detail

## Context

`WalletTransaction` rows have one owner, a type, positive amount, `balanceAfter`, `createdAt`,
optional `bookingId` and, for PAYOUT, `payoutAccountId`. There is no status or direction
column; `wallet-ledger.ts` already maps each type to a sign. `GET /api/wallet` returns only
the balance and is called by the navbar, top-up, payout and settings pages. Unpaid bookings
have no ledger row. CLASS-3 settlement does not exist yet, so no LESSON_EARNING row is
written today, and no platform fee is configured.

The user confirmed three decisions on 2026-10-30 (see
`docs/sources/pay-5-policy-confirmation.md`): derive direction from type and show status
Completed; show a Payment due notice on `/wallet` that links to `/bookings/:id`; show all four
summary figures, with pending earnings computed using the provisional 15% fee.

## Decisions

### Decision: New read endpoints, keep `GET /api/wallet` unchanged

Add `GET /api/wallet/overview`, `GET /api/wallet/transactions` and
`GET /api/wallet/transactions/:id`. The navbar keeps the cheap balance-only call; the
aggregations run only on `/wallet`. Both read `User.balance`, so the balance is the same
everywhere. `/wallet` also publishes the loaded balance to the navbar.

### Decision: Direction and status are derived

Direction is `IN` or `OUT` from the existing sign map, exported from `wallet-ledger.ts` so the
writer and reader share one source. Status is the constant `COMPLETED`. Neither is stored.

### Decision: Pending earnings are computed per booking

Pending earnings = sum over the Tutor's CONFIRMED bookings of
`totalAmount - round(totalAmount × 0.15, 2)`, so each booking matches what a later
LESSON_EARNING would credit. The fee is a single backend constant, `PLATFORM_FEE_RATE`,
for CLASS-3 to reuse. Non-Tutors get `null`.

### Decision: Bangkok calendar month

Earnings this month use the Asia/Bangkok month (UTC+7, no daylight saving), matching the
booking calendar rules.

### Decision: Offset paging

The list is newest first (`createdAt`, then `id`), 20 per page, with `page` and `type` query
parameters validated by zod. Rows are append-only, so offset paging is stable enough for
history browsing.

## Implementation Notes

- `apps/backend/src/modules/wallet/wallet-ledger.ts`: export the sign map.
- `apps/backend/src/modules/wallet/wallet.service.ts`: `getWalletOverview`,
  `listWalletTransactions`, `getWalletTransaction`, response mapping.
- `wallet.schema.ts`, `wallet.controller.ts`, `wallet.routes.ts`: query/param validation and
  routes. Owner checks use `userId` in every query, so another user's id is a 404.
- `apps/frontend/src/lib/wallet-api.ts`: types and request helpers.
- `apps/frontend/app/wallet/page.tsx`, `apps/frontend/app/wallet/transactions/[id]/page.tsx`.
- `apps/frontend/src/components/navbar.tsx`: **Wallet** link in the account menu.

## Verification Commands

- Build: `npm --prefix apps/backend run build`; `npm --prefix apps/frontend run build -- --webpack`
- Test: `npm --prefix apps/backend test -- --runInBand`; `npm --prefix apps/frontend test -- --runInBand`
- Lint: `npm --prefix apps/backend run lint`; `npm --prefix apps/frontend run lint`
- Typecheck: backend build; `npx tsc --noEmit` in `apps/frontend`
- Format: `npm run format:check` from the repository root

## Risks

- CLASS-2 moves finished lessons from CONFIRMED to COMPLETED before CLASS-3 settles them, so a
  completed but unsettled lesson is in neither pending earnings nor the balance. This follows
  the approved definition; CLASS-3 should revisit it.
- The 15% fee is provisional. Changing it changes only the displayed pending figure.
