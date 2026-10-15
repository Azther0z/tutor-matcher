# Verification: Tutor availability

## Summary

| Dimension    | Status |
| ------------ | ------ |
| Completeness | Passed |
| Correctness  | Passed |
| Coherence    | Passed |

The implementation matches this change's proposal, delta spec, design and confirmed user
decisions. All five tasks are complete. No main availability spec exists yet; this delta
remains active and has not been archived, committed or merged.

## Findings

- [WARNING] The existing navigation bar overflows a 390px viewport: the document is 422px
  wide. The availability card itself is 358px wide and fits within the viewport. The nav bar
  was not changed by this work; this is a pre-existing dashboard issue.

## Verification run

- Backend integration: **17 suites / 213 tests passed** against a disposable PostgreSQL
  database. The separate profile integration suite passed **44 tests** against its own
  disposable database because that suite enforces a dedicated database guard. Combined:
  **257 backend tests passed**. This includes availability ownership, concurrency, booking
  eligibility and transaction-conflict coverage.
- Frontend: **21 suites / 181 tests passed**, including the availability editor tests.
- Backend and frontend lint passed. Both production builds passed; the frontend TypeScript
  no-emit check passed during its build.
- Prisma Client generation, schema formatting, validation and synchronization to fresh
  disposable databases passed. No Prisma migration history or application database was
  changed.
- Root `npm run format:check` and `git diff --check` passed after the documentation update.
- Seven real Chrome E2E scenarios passed against the production frontend/backend builds and
  PostgreSQL, with no API response mocks and no browser page errors. The scenarios cover
  calendar creation on multiple dates, month-to-week navigation, individual reassignment and
  closure, publishing beyond three months, stale-slot conflict recovery, paid/held/past locks,
  and mobile use. Database assertions confirmed each saved or locked state.
- Fifteen final screenshots were reviewed. Three recordings were slowed to half speed; full
  FFmpeg decode, near-2x duration checks and Chrome playback all passed. The offline gallery
  and evidence bundle are under `.agents/scratch/prof3-calendar-e2e/`.
- The two test servers and both named disposable PostgreSQL containers/volumes were removed.
  Ports 3100, 8100, 55434 and 55435 were clear after cleanup.

## Requirement evidence

| Requirement                                  | Implementation                                            | Evidence                                       |
| -------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------- |
| Tutor-owned shared half-hours; no horizon    | Availability schema, service and calendar APIs            | PostgreSQL and HTTP integration tests; C1, C4  |
| Week calendar and month overview             | Tutor dashboard calendar and editor                       | Component tests; C1-C4, C7; screenshots        |
| Save only one slot; preserve conflicts       | Per-slot revision and serializable save; editor recovery  | Integration tests; C5; two-browser recording   |
| Paid, held and past slots stay locked        | Availability service lock checks and calendar state       | Integration tests; C6; screenshots             |
| Booking sees only open assigned slots        | Booking availability and eligibility filters              | Booking integration tests; database assertions |
| Canonical docs and confirmed decisions agree | User journeys, schema notes, glossary and authority guide | Targeted documentation review                  |

## Agent guidance and documentation

`AGENTS.md` and `CONTEXT.md` now follow the user's decision that `docs/user-journeys.md` is
the product authority and the prototype is historical evidence. The calendar behavior,
per-slot saves, unlimited future publishing, shared subject assignments and lock rules agree
across the proposal, delta spec, design, canonical journeys, schema documentation and code.
Immutable source evidence and unrelated guidance were preserved. No DevOps-owned files,
dependencies, lockfiles, deployment or environment configuration changed.

## Changed implementation files relative to PR #189

- `AGENTS.md`, `CONTEXT.md`
- `apps/backend/prisma/schema.prisma`, `apps/backend/prisma/seed.ts`
- `apps/backend/src/lib/transaction-conflict.ts` and its test
- `apps/backend/src/modules/availability/`
- `apps/backend/src/modules/booking/booking.service.ts` and its integration test
- `apps/backend/src/modules/profile/profile.routes.ts`
- `apps/frontend/app/dashboard/tutor/page.tsx`
- `apps/frontend/src/components/tutor-availability-calendar.tsx`
- `apps/frontend/src/components/tutor-availability-editor.tsx` and its test
- `apps/frontend/src/lib/availability.ts`
- `docs/user-journeys.md`, `docs/database-schema.md`, `docs/index.md`
- This change's proposal, delta spec, design, tasks and verification artifacts

## Residual risks and scope boundaries

- Required slot ownership needs a fresh development database or a deliberate backfill before
  synchronizing an existing populated database. Do not reset existing data or guess owners
  for orphaned or mixed-owner rows. No production data migration is supplied.
- Search and subject-detail pages remain separate work. The existing student booking picker
  does not enforce the documented three-month navigation horizon; the three-month rule stays
  scoped to student navigation and does not cap Tutor publishing.
- Existing Prisma/pg deprecation and Next.js workspace-root warnings did not fail checks.
- This change is stacked on PR #189 (`bbbd10c`) and contains only PROF-3 scope. No
  production data, deployment or CI/CD configuration was changed.
