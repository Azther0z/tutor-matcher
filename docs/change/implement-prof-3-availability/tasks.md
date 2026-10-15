# Tasks

- [x] 1. Add slot ownership, open state and Tutor/time uniqueness; update seed and fixtures.
  - Acceptance: schema validates and existing fixture slots have explicit owners.
  - Verify: Prisma generate/validate; backend build; isolated database schema push.
  - Files: backend Prisma schema/seed and database fixtures.
- [x] 2. Implement owned calendar reads, individual slot saves and booking eligibility.
  - Acceptance: ownership, overlap, past/held/paid locks and stale-slot rejection are enforced;
    closed slots cannot be booked; expired holds release across shared subjects.
  - Verify: HTTP tests and PostgreSQL integration/race tests.
  - Files: availability module, profile router, booking service and tests.
- [x] 3. Implement the Tutor dashboard week calendar and month overview.
  - Acceptance: seven dated days, month-to-week navigation, individual slot saves,
    future Bangkok dates, shared subject toggles, discard and lock states,
    persistence, draft preservation and explicit conflict review work.
  - Verify: frontend component tests, lint, build and browser check.
  - Files: dashboard page, availability component/API helper and tests.
- [x] 4. Update authority guidance and canonical availability docs.
  - Acceptance: canonical journeys are authoritative; confirmed decisions and schema agree.
  - Verify: targeted documentation review and formatting.
  - Files: AGENTS.md, CONTEXT.md, canonical docs and these change artifacts.
- [x] 5. Complete regressions and calendar-focused runtime validation.
  - Acceptance: relevant automated suites, builds, lint, schema and formatting pass;
    disposable services are cleaned up and remaining limitations are reported.
  - Verify: commands in design.md; git diff --check.
  - Files: relevant tests and this checklist.

Calendar-focused browser evidence is captured and reviewed in the ignored local bundle at
`.agents/scratch/prof3-calendar-e2e/`; `verification.md` records the scenarios and checks.
