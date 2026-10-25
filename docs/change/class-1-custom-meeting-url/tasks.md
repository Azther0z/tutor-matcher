# Tasks

## 1. Store and return the Tutor meeting-link override

- [x] 1.1 Add the custom URL and latest-change metadata to Booking, and expose the
      effective URL and `canEditMeetingLink` / `canJoin` actions in booking responses.
  - Acceptance: generated and custom URLs remain separate; custom wins; edit and join
    availability follow the confirmed status, Tutor identity, and scheduled-end rules.
  - Verify: Prisma validate/generate and backend build.
  - Files: `apps/backend/prisma/schema.prisma`, `apps/backend/src/modules/booking/booking.service.ts`,
    `apps/backend/src/modules/booking/booking.test.ts` (existing typed fixture only).

## 2. Add the Tutor update operation

- [x] 2.1 Add an authenticated endpoint to set or remove the custom URL.
  - Acceptance: only the assigned Tutor can change a confirmed booking before its end;
    only syntactically valid HTTPS URLs or null are accepted; each change records the
    latest editor and time.
  - Verify: backend build and lint.
  - Files: `apps/backend/src/modules/booking/booking.schema.ts`, `booking.routes.ts`,
    `booking.controller.ts`, `booking.service.ts`.

## 3. Add booking-page controls

- [x] 3.1 Use the effective URL for Join and let the assigned Tutor replace or remove
      their custom URL.
  - Acceptance: both participants see the same Join destination; Tutor changes take
    effect on the page; removing the custom URL restores the generated fallback; latest
    editor/time are shown; Join is hidden after cancellation, completion, or scheduled
    end.
  - Verify: frontend lint and build.
  - Files: `apps/frontend/src/types/booking.ts`, `apps/frontend/src/lib/bookings-api.ts`,
    `apps/frontend/app/bookings/[id]/page.tsx`.

## 4. Align canonical documentation

- [x] 4.1 Document the manual URL behavior and current database fields.
  - Acceptance: user journey and schema docs describe the shipped override and do not
    imply that Google Meet room creation is already implemented.
  - Verify: `npm run format:check` and Markdown links resolve.
  - Files: `docs/user-journeys.md`, `docs/database-schema.md`, `docs/index.md`.
