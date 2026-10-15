# Design: Tutor availability

## Context

Start from PR #189 (`bbbd10c`). Availability has subject joins and booking locks, but no
direct Tutor owner, open state or unique Tutor/time constraint. The dashboard is a placeholder.
No main specs exist. Search and subject-detail pages remain outside this change.

## Decisions

- Add required `Availability.tutorId`, `isOpen` and unique `(tutorId, startedAt)`; keep slot
  IDs stable when closing or reassigning. Update seed and database fixtures. Use schema
  synchronization on a fresh disposable database, not migration history or application data resets.
- Mount owner-only calendar reads and individual slot writes under
  `/api/profiles/me/tutor/availability`.
  Dates and half-hour labels are Bangkok local time; store instants consistently with booking.
- GET `/calendar?from=...&to=...` returns owned subjects and dated slots for at most 42 days.
  Each stored slot has a revision hash; absent slots use a null revision. PUT `/:date/:time`
  saves only that slot inside a serializable transaction. Validate ownership, grid alignment,
  assignments, revision and locks before writing. Other times do not share its save boundary.
  Serialization or unique races return a conflict.
- Release expired payment holds for all the Tutor's subjects before reading or saving.
  Paid and active-held rows remain immutable. Booking reads and eligibility require `isOpen`.
- Recognize both Prisma P2034 and direct PostgreSQL adapter COMMIT serialization errors
  as retryable conflicts, preserving unrelated errors. Share that classifier with booking.
- Build a seven-column dated week calendar with 48 half-hour cells per day. Clicking a cell
  opens its subject controls and Save slot / Close slot actions. Use a month overview with
  counts of open/locked slots; clicking a date opens its week. Navigation has no future cap.
- Preserve the selected slot's draft on errors and block navigation until it is saved or
  explicitly discarded. On conflict, show the latest slot and require an explicit retry
  decision; newly held/paid or past slots cannot be overwritten. No day/week save button.
- Correct only conflicting authority guidance and document confirmed decisions. Preserve
  unrelated Wiki Memory and immutable evidence.

## Implementation Notes

- `apps/backend/prisma/schema.prisma`, `prisma/seed.ts`, booking fixtures.
- `apps/backend/src/modules/availability/`, profile router, booking service and tests.
- `apps/backend/src/lib/transaction-conflict.ts`: normalized/adapter conflict classification.
- `apps/frontend/app/dashboard/tutor/`, availability component and API helper/tests.
- `AGENTS.md`, `CONTEXT.md`, `docs/user-journeys.md`, `docs/database-schema.md`, `docs/index.md`.

## Verification Commands

- Build: `npm --prefix apps/backend run build`; `npm --prefix apps/frontend run build`.
- Test: `RUN_DATABASE_INTEGRATION=true npm --prefix apps/backend test -- --runInBand` against
  an owned disposable PostgreSQL instance; `npm --prefix apps/frontend test -- --runInBand`.
- Lint: `npm --prefix apps/backend run lint`; `npm --prefix apps/frontend run lint`.
- Typecheck: `cd apps/frontend && npx --no-install tsc --noEmit` after route generation.
- Schema: `npm --prefix apps/backend run prisma:validate`; generate Prisma Client.
- Formatting: `npm run format:check`; `git diff --check`.
- Runtime: browser-check editor persistence, conflict recovery and booking filtering.

## Risks

Required ownership needs a fresh disposable development database or deliberate existing-data
backfill before synchronization. Do not infer owners for orphan/mixed-owner rows or reset an
existing database. Concurrent bookings and edits must serialize; cover real PostgreSQL races.
