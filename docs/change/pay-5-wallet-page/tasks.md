# Tasks

## 1. Backend read API

- [x] 1.1 Add the overview, transaction list and transaction detail endpoints.
  - Acceptance: owner-only; list filters by type and pages newest first; detail returns
    direction, status COMPLETED, booking summary and masked payout account; overview returns
    balance, pending earnings (Tutors only, 15% fee per booking), Bangkok-month earnings,
    all-time paid out and unexpired Payment due bookings; invalid input returns 400.
  - Verify: `npm --prefix apps/backend test -- --runInBand wallet`
  - Files: `apps/backend/src/modules/wallet/*`

## 2. Frontend pages

- [x] 2.1 Add `/wallet` with the summary, Payment due notice, filter and paged list.
  - Acceptance: one balance, published to the navbar; Tutor-only pending earnings; filter
    kept in the URL; each row opens its detail; empty and error states with retry.
  - Verify: `npm --prefix apps/frontend test -- --runInBand --runTestsByPath app/wallet/page.test.tsx`
  - Files: `apps/frontend/app/wallet/page.tsx`, `page.test.tsx`, `src/lib/wallet-api.ts`
- [x] 2.2 Add read-only `/wallet/transactions/[id]`.
  - Acceptance: shows type, amount, direction, status, date, balance after, booking link
    and payout account; lesson payments point to `/bookings/:id`; no payment action;
    not-found and error states.
  - Verify: `npm --prefix apps/frontend test -- --runInBand --runTestsByPath "app/wallet/transactions/[id]/page.test.tsx"`
  - Files: `apps/frontend/app/wallet/transactions/[id]/page.tsx`, `page.test.tsx`
- [x] 2.3 Add a **Wallet** link to the account menu.
  - Acceptance: the menu opens `/wallet`.
  - Verify: navbar tests.
  - Files: `apps/frontend/src/components/navbar.tsx`

## 3. Documentation

- [x] 3.1 Record the user's decisions and update canonical docs.
  - Acceptance: evidence file, `docs/user-journeys.md` §4, `docs/testing.md`, `docs/index.md`,
    knowledge log and Wiki Memory reflect the shipped behaviour. `CONTEXT.md` already
    defines every term used, so it needs no change.
  - Verify: `npm run format:check`
  - Files: `docs/`, `AGENTS.md`

## 4. Verify

- [x] 4.1 Run backend and frontend build, lint, tests and the format check.
  - Acceptance: all pass, or failures are recorded with a reason.
  - Verify: commands in `design.md`
  - Files: none
