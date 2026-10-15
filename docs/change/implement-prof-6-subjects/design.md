# Design: Online subject management

## Context

Subjects already belong to Tutors and power booking, but have no format, write API or settings UI. Tutor profile changes use reviewed versions; subjects are separate offerings. Existing bookings lock the total price but read subject details live. No main specs are present.

## Decisions

### Decision: Keep PROF-6 online only

Persist `ONLINE` using a subject-format enum and require it in create/update requests. Keep a visible Online format field. No venue or delivery work is included.

### Decision: Independent immediate saves

Mount an owner-only subject router beneath `/api/profiles/me/tutor/subjects`. Derive ownership from the authenticated User, permit unpublished Tutors, and never accept a Tutor ID from the body. Allow duplicate names. Use a full replacement request for the four editable fields.

### Decision: Decimal rates

Accept rate text with at most two decimals, greater than zero and within `Decimal(10,2)`. Return fixed two-decimal strings. Bound names to 100 and descriptions to 2000 characters, following existing profile field limits.

### Decision: Preserve bookings atomically

Use nullable scalar snapshot fields on Booking for legacy compatibility. New bookings capture all four subject fields. Before updating a subject, capture its current details on bookings without snapshots in the same serializable transaction. Read the snapshot as a unit so a deliberately null legacy description stays null. Keep the stored booking total untouched. A serialization conflict returns a retryable conflict response.

### Decision: Reuse owner loading

Include subjects in the existing owner profile response so settings does not introduce a second initial fetch. Keep subject edits in a separate component and state from profile drafts, review and publication.

## Implementation Notes

- `apps/backend/prisma/schema.prisma`: format and booking snapshot columns; no migrations or database reset.
- `apps/backend/src/modules/subject/`: validation, serialization, owned queries and HTTP handlers.
- Profile module: router mount and owner subject collection.
- Booking module: capture/read snapshot and return format.
- Frontend: Subjects section after approved Verification, visible add form and inline editor; preserve input on save errors and prevent duplicate submissions.

## Verification Commands

- Build: `npm --prefix apps/backend run build` and `npm --prefix apps/frontend run build`.
- Test: `npm --prefix apps/backend test -- --runInBand` and `npm --prefix apps/frontend test -- --runInBand`.
- Behavior wiring: `npm --prefix apps/backend run test:bdd`.
- Lint: `npm --prefix apps/backend run lint` and `npm --prefix apps/frontend run lint`.
- Typecheck: `cd apps/frontend && npx --no-install tsc --noEmit`.
- Schema: `npm --prefix apps/backend run prisma:validate`.
- Formatting: targeted `prettier --check` for touched managed files; `git diff --check`.
- Database regression: opt-in integration suite only against an authorized isolated database; never the configured application database implicitly.

## Risks

- Legacy booking snapshots can preserve only the subject values still available when first edited.
- Concurrent booking creation and edits must keep a consistent price and snapshot; both use serializable transactions.
- A fresh checkout requires locked dependencies and generated Prisma Client before validation. Use offline cached installs where possible.

## Changed files

Backend:

- `apps/backend/prisma/schema.prisma`
- `apps/backend/src/modules/subject/subject.schema.ts`
- `apps/backend/src/modules/subject/subject.public.ts`
- `apps/backend/src/modules/subject/subject.service.ts`
- `apps/backend/src/modules/subject/subject.routes.ts`
- `apps/backend/src/modules/subject/subject.test.ts`
- `apps/backend/src/modules/profile/profile.routes.ts`
- `apps/backend/src/modules/profile/profile.service.ts`
- `apps/backend/src/modules/booking/booking.service.ts`
- `apps/backend/src/modules/booking/booking.test.ts`
- `apps/backend/src/modules/booking/booking.integration.test.ts`

Frontend:

- `apps/frontend/src/components/tutor-subjects-manager.tsx`
- `apps/frontend/src/components/tutor-profile-editor.tsx`
- `apps/frontend/src/lib/subjects.ts`
- `apps/frontend/src/lib/tutor-application.ts`
- `apps/frontend/src/types/booking.ts`
- `apps/frontend/src/test/tutor-profile-fixtures.ts`
- `apps/frontend/app/settings/tutor/subjects.test.tsx`

Documentation:

- `AGENTS.md`: only the confirmed subject policies in Wiki Memory.
- `docs/user-journeys.md`
- `docs/database-schema.md`
- `docs/index.md`
- This change's `proposal.md`, `spec/subject-management.md`, `design.md` and `tasks.md`.
