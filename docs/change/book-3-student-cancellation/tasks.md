# Tasks

## 1. Confirmation and Feedback

- [x] 1.1 Handle quote loading, retry, failed stale-quote recovery, and busy actions.
  - Acceptance: No cancellation without current terms; network failures are recoverable; requests cannot be repeated while busy; reason is bounded.
  - Verify: Booking detail page tests.
  - Files: `apps/frontend/app/bookings/[id]/page.tsx`, `page.test.tsx`
- [x] 1.2 Publish the returned wallet balance after cancellation.
  - Acceptance: Navbar receives the server balance; unpaid cancellation does not claim a refund.
  - Verify: Booking page event and result-message tests; existing wallet tests.
  - Files: `apps/frontend/src/lib/wallet-api.ts`, booking detail page and tests

## 2. Acceptance Evidence

- [x] 2.1 Resolve policy and disposable-database permission questions.
  - Acceptance: Direct user answers recorded in proposal; existing databases and schema untouched.
  - Verify: Conversation answers before dependent work.
  - Files: This change's artifacts, relevant canonical cancellation documentation
- [x] 2.2 Verify both refund windows, boundary, ownership, stale quotes, slot release, and duplicate refunds.
  - Acceptance: Money and booking state remain atomic; original payment remains immutable; only owners cancel upcoming eligible lessons.
  - Verify: Scoped backend booking unit/API and authorized disposable-database tests.
  - Files: `apps/backend/src/modules/booking/` test files and demonstrated fixes if needed

## 3. Final Verification

- [x] 3.1 Run relevant tests, lint, typecheck/build and inspect scope.
  - Acceptance: Required checks pass or limitations are recorded without claiming full acceptance.
  - Verify: Commands in `design.md`; `git diff --check`; `my-verify-change` review.
  - Files: Changed application/tests, `docs/testing.md`, `docs/index.md`, change verification report
