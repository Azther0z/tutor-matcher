# Tasks

## 1. Approval message

- [ ] 1.1 Add transactional Admin-to-Student approval notice.
  - Acceptance: One message includes approval, exact THB refund amount, booked subject, and reference; no schema change or altered refund policy.
  - Verify: Refund tests and guarded integration suite.
  - Files: `apps/backend/src/modules/refund/refund.service.ts` and optional local formatter/tests.

## 2. Verification

- [ ] 2.1 Extend refund integration coverage.
  - Acceptance: Correct sender, recipient, and amount; normal conversation/inbox/thread visibility; repeat/concurrent decisions produce one notice; failed message write rolls back money and decision; rejected/unauthorized decisions produce none.
  - Verify: Dedicated guarded refund integration suite, with authorized test-data setup only.
  - Files: `apps/backend/src/modules/refund/refund.integration.test.ts` and relevant refund tests.
- [ ] 2.2 Verify existing messaging and money behavior.
  - Acceptance: Build, lint, and relevant tests pass; Student sees the notice; ledger and Tutor settlement behavior remain intact.
  - Verify: Commands and manual scenario in `design.md`; report skipped checks explicitly.
  - Files: Refund and messaging tests; verification notes if needed.

## 3. Documentation

- [ ] 3.1 Document implemented behavior.
  - Acceptance: Canonical journeys cover notice sender, amount, transaction guarantee, and normal fetch timing without promising real-time delivery.
  - Verify: Compare documentation to implementation and tests.
  - Files: `docs/user-journeys.md`, `docs/index.md`, and confirmed `AGENTS.md` memory as needed.
