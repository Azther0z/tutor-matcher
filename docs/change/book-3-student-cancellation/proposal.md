# Proposal: Complete Student Lesson Cancellation

## Intent

Complete BOOK-3 (#141) on top of merged PAY-1 (#182) and BOOK-1 (#199). Existing quote and refund endpoints already implement much of the story; finish confirmation recovery, wallet feedback, and acceptance evidence rather than replace the money flow.

## Scope

In scope:

- Show server-calculated policy and wallet refund before confirmation.
- Recover safely from unavailable or changed quotes and prevent duplicate submissions.
- Refresh the displayed wallet balance from the successful cancellation response.
- Verify ownership, policy boundaries, immutable payments, refund atomicity, and slot release.

Out of scope:

- Tutor cancellation, rescheduling changes, settlement, payouts, notifications, and DevOps configuration.
- Prisma schema changes or changes to existing user databases.

## Approach

Reuse the serializable cancellation transaction and append-only wallet writer. Improve the existing booking detail page and add focused UI/API tests. The user confirmed on 2026-10-17: more than 24 hours refunds 100%; at or below 24 hours refunds 70%. Only newly created, dedicated local BOOK-3 databases may be populated for this work; existing databases and the Prisma schema remain untouched.

## Affected Specs

- `student-cancellation`: confirmation, refund recovery, and preservation of existing ledger guarantees. No main `docs/spec/` exists on the starting branch.

## Impact

- `apps/frontend/app/bookings/[id]/`: cancellation state and acceptance tests.
- `apps/frontend/src/lib/wallet-api.ts`: reuse wallet balance notification.
- `apps/backend/src/modules/booking/`: acceptance coverage and only demonstrated cancellation fixes.
- `docs/testing.md`, `docs/user-journeys.md`: verified coverage and confirmed policy.
