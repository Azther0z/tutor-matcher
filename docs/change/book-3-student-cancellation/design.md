# Design: Complete Student Lesson Cancellation

## Context

Starting commit: `cce66b8` on `origin/main`. Issue #141 remains open. PAY-1 and BOOK-1 are merged. Existing cancellation uses a quote token, a serializable transaction, and the shared wallet ledger. The page's changed-quote fallback can reject without handling the error and leave old terms enabled; cancellation does not notify the navbar of its returned balance. Existing tests cover late-refund arithmetic but not the full story's boundaries and recovery.

## Decisions

### Decision: Reuse current cancellation and wallet contracts

Preserve existing routes, schema, and quote token contract. Export the existing wallet event publication as a helper and publish the actual returned balance on success.

### Decision: Failed recovery clears the quote

Handle quote recovery separately inside the changed-quote branch. Keep confirmation disabled while loading or after failure. Offer an explicit retry. Disable other booking actions during cancellation, bound the optional reason, and distinguish unpaid cancellation in the result message.

### Decision: Gate policy and database changes on direct answers

The repository asks before database changes. The user authorized new dedicated BOOK-3 databases and confirmed the existing 24-hour / 70% defaults on 2026-10-17. The integration suite refuses any host other than loopback and any database other than `tutor_matcher_book3_test`. No existing database or Prisma schema is to be changed.

## Implementation Notes

- `apps/frontend/app/bookings/[id]/page.tsx`: safe quote lifecycle, busy state, wallet event, messaging.
- `apps/frontend/src/lib/wallet-api.ts`: export existing notification helper; retain top-up behavior.
- Booking test files: quote failure/retry, re-confirmation, both windows and exact boundary, owner checks, refund/slot atomicity.

## Verification Commands

- Build: `npm.cmd --prefix apps/backend run build`; `npm.cmd --prefix apps/frontend run build`
- Test: `npm.cmd --prefix apps/frontend test -- --runInBand --runTestsByPath "app/bookings/[id]/page.test.tsx"`; `npm.cmd --prefix apps/backend test -- --runInBand booking.test.ts`
- Database test: after permission, use a new local BOOK-3 database with `RUN_DATABASE_INTEGRATION=true` and run only scoped booking integration tests.
- Lint: `npm.cmd --prefix apps/frontend run lint`; `npm.cmd --prefix apps/backend run lint`
- Typecheck: `apps/frontend/node_modules/.bin/tsc.cmd --noEmit -p apps/frontend/tsconfig.json`; backend build covers backend typecheck.

## Risks

- Monetary values depend on server time. Use controlled test times at the exact boundary and verify stale quotes do not write money.
- Existing unrelated untracked files remain outside this change.
- No push, merge, or deployment is part of local implementation setup.
