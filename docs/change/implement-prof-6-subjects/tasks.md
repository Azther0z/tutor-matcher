# Tasks

## 1. Backend

- [x] 1.1 Add online subject storage and an owner-only list/create/update API.
  - Acceptance: Published/unpublished Tutors can save valid offerings immediately; invalid input, missing Tutor capability and foreign ownership are rejected; duplicate names work.
  - Verify: Subject HTTP/service tests; Prisma validation and backend build.
  - Files: Prisma schema; subject module; profile router/owner response.
- [x] 1.2 Preserve booked subject details through edits.
  - Acceptance: New bookings capture details; legacy details are captured before edit; booking responses and total remain stable while future bookings use the new offering.
  - Verify: Booking mapping tests and subject persistence regression tests.
  - Files: Booking service and tests; subject service; schema.

## 2. Frontend

- [x] 2.1 Add subject creation and inline editing to Tutor settings.
  - Acceptance: Subjects follow Verification; Add subject opens a form; only the chosen row edits; Online is visible; field errors, cancel and save failures preserve correct state; saves persist across reload.
  - Verify: Tutor subject UI tests and existing settings tests.
  - Files: Subject manager component; tutor profile editor; frontend subject/booking types and tests.

## 3. Verify and document

- [x] 3.1 Update canonical documentation and confirmed Wiki Memory.
  - Acceptance: Subject policy and schema additions match the implementation; source evidence remains untouched.
  - Verify: Review affected docs and links against the final code and user decisions.
  - Files: User journeys, database schema, docs index, AGENTS.md Wiki Memory and this change.
- [x] 3.2 Run focused and broader validation.
  - Acceptance: Tests, builds, typecheck, lint, schema and formatting checks pass, or external constraints are reported precisely.
  - Verify: Commands in design.md; inspect final diff and Git status.
  - Files: Implementation and tests from tasks 1–2; this checklist.

## Verification results

- Backend Jest: all 16 suites / 241 tests passed, including all 49 PostgreSQL integration tests.
- Focused subject/booking Jest: 38 tests passed. Subject suite rerun after test typing/lint corrections: 30 tests passed.
- Frontend Jest: 20 suites / 171 tests passed, including 6 subject UI tests; rerun after the final focus change.
- Backend and frontend builds and lint passed. Frontend route type generation and TypeScript check passed.
- Prisma Client generation, schema formatting and validation passed. After explicit user approval, `prisma db push` synchronized a fresh disposable PostgreSQL 16 database on `127.0.0.1:55434`; the complete backend suite ran with `RUN_DATABASE_INTEGRATION=true`. No existing application database was changed and no reset was performed.
- Backend Cucumber wiring: 1 scenario / 3 steps passed.
- Repository-wide formatting and `git diff --check` passed. New change/index links resolve.
- The PostgreSQL regression in `booking.integration.test.ts` passed: owner-only edits preserve new and legacy booking details and prices, leave a sibling offering unchanged, persist through owner-profile reload, and apply the new offering details to future bookings.
- The test container used the cached `postgres:16-alpine` image, loopback-only port binding and temporary in-memory storage. It was stopped and automatically removed after verification; no test server was left running.
- No dependency manifests, lockfiles, deployment configuration or immutable source evidence changed.
