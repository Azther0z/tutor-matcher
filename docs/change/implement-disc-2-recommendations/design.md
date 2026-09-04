# Design: Implement DISC-2 Recommendations

## Context

The current Prisma schema has `User`, tutor-owned `Subject`, `Availability`,
and `Review` records, but no student preference model. The `/settings` and
`/search` frontend routes are placeholders. The protected profile and discovery
Express routers are mounted but contain no endpoints. The existing charter
defines 30-minute availability slots, while `Availability` currently stores a
single `startedAt` timestamp and treats a non-null `bookingId` as occupied.

## Decisions

### Decision: Add a one-to-one `StudentProfile`

Add `StudentProfile` linked uniquely to `User`, containing required `level` and
free-text `goals`, optional schedule preferences, timestamps, and a related
`StudentProfileSubject` table. Student interests must not reuse `Subject`,
because `Subject` is already a tutor-owned teaching offering.

### Decision: Store schedule preferences as local-day windows

Store ISO weekdays, start/end minutes, and an IANA timezone. Availability is
matched after converting each open slot into the student's timezone. The API
will default the timezone to `UTC`; a later change can add localized defaults
without changing the ranking contract.

### Decision: Use deterministic lexical relevance

Subject names are matched case-insensitively. Meaningful terms from the goal
text are matched against tutor bios, subject names, and subject descriptions.
This is intentionally explainable and avoids introducing an ML dependency.

### Decision: Keep fallback behavior explicit

No profile, or a profile with no usable subject/goal preference, uses rating and
open-slot availability only. The response reports the ranking mode so the UI
does not imply personalization that did not occur.

### Decision: Keep `DISC-1` separate

The recommendation endpoint owns ranking and preference-aware ordering. Search
filters, pagination, and no-results filter suggestions remain `DISC-1` behavior.

## Implementation Notes

- `apps/backend/prisma/schema.prisma`: add `StudentProfile` and
  `StudentProfileSubject`; relate `User.studentProfile`.
- `apps/backend/prisma/migrations/`: generate a non-destructive migration for
  the new tables, foreign keys, unique subject-per-profile constraint, and
  indexes.
- `apps/backend/src/modules/profile/profile.schema.ts`: validate complete
  preferences and schedule ranges.
- `apps/backend/src/modules/profile/profile.service.ts`: upsert and read the
  authenticated user's profile in a transaction where needed.
- `apps/backend/src/modules/profile/profile.controller.ts` and `profile.routes.ts`:
  add `GET` and `PUT /api/profiles/student`.
- `apps/backend/src/modules/discovery/discovery.service.ts`: query published
  tutors with subjects, reviews, and unbooked availability; calculate scores
  and stable tie-breakers.
- `apps/backend/src/modules/discovery/discovery.controller.ts` and
  `discovery.routes.ts`: add `GET /api/discovery/recommendations`.
- `apps/frontend/app/settings/page.tsx`: collect subjects, level, goals, and
  optional weekday/time preferences; load and save the current profile.
- `apps/frontend/app/search/page.tsx`: fetch recommendations with the stored
  bearer token and render loading, error, empty, fallback, and ranked states.

## Verification Commands

- Prisma format: `npm run prisma:format --workspace=backend`
- Prisma validation: `npm run prisma:validate --workspace=backend`
- Prisma client generation: `npm run gen --workspace=backend`
- Backend typecheck/build: `npm run build --workspace=backend`
- Backend tests: `npm test --workspace=backend`
- Frontend lint: `npm run lint --workspace=frontend`
- Frontend tests: `npm test --workspace=frontend`
- Repository checks: `npm run format:check` and `npm run backlog:check`

## Risks

- Free-text goal matching is a useful baseline, not semantic understanding;
  keep the scoring explainable and cover it with representative tests.
- Existing availability has no explicit end time; use the documented 30-minute
  slot convention until `PROF-3` adds richer availability data.
- Existing database environments need the generated migration deployed before
  the new API can run against them.
- The frontend currently stores JWTs in local storage; this change follows the
  existing authentication pattern and does not expand auth scope.
