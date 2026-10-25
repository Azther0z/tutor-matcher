# Design: Tutor-managed booking meeting URL

## Context

Booking responses currently expose nullable `zoomMeetingUrl`. The booking page shows a
Join action for that field, but Tutors have no way to edit a meeting link. Classroom API
files are placeholders. All booking routes require authentication, and the booking
service already resolves whether the viewer is the Student or assigned Tutor.

The accepted CLASS-1 decision keeps generated and Tutor-provided URLs separate, gives
the custom URL priority, and stores only the latest editor and time. Google Meet room
creation is deferred for this slice; `zoomMeetingUrl` remains the current generated-link
fallback for compatibility.

## Decisions

### Decision: Keep Tutor and generated URLs separate

Store `customMeetingUrl` alongside `zoomMeetingUrl`, plus `meetingLinkUpdatedAt` and
`meetingLinkUpdatedById`. A nullable custom URL means no override. Setting it to null
restores the generated-link fallback. Every save or removal updates latest-change
metadata.

### Decision: Enforce editing rules on the server

Use an authenticated booking endpoint. The service verifies that the authenticated user
owns the Tutor assigned to the booking, the booking is CONFIRMED, and the scheduled end
is in the future. Validate only URL syntax and HTTPS; do not contact the destination or
restrict its provider.

### Decision: Expose one effective Join action

Return both stored URLs, the effective URL (`customMeetingUrl ?? zoomMeetingUrl`),
latest-change metadata, and booleans for Tutor editing and joining. Join is available
for a confirmed booking with an effective URL until the scheduled end, including before
the start. Cancelled and completed bookings have no Join action.

## Implementation Notes

- `apps/backend/prisma/schema.prisma`: add custom URL and latest-change fields and
  relation to the User who last changed the link.
- `apps/backend/src/modules/booking/booking.schema.ts`: validate URL update payloads.
- `apps/backend/src/modules/booking/booking.routes.ts` and `booking.controller.ts`:
  expose the authenticated update operation.
- `apps/backend/src/modules/booking/booking.service.ts`: authorize, conditionally save,
  and include effective URL, edit/join actions, and latest editor in responses.
- `apps/frontend/src/types/booking.ts` and `src/lib/bookings-api.ts`: represent and send
  the meeting-link update.
- `apps/frontend/app/bookings/[id]/page.tsx`: display Join, the Tutor editor, restore
  behavior, and latest-change information.
- `docs/user-journeys.md`, `docs/database-schema.md`, and `docs/index.md`: keep canonical
  behavior, schema description, and navigation current.

## Verification Commands

- Prisma: `npm --prefix apps/backend run prisma:validate` and `npm --prefix apps/backend run gen`
- Backend: `npm --prefix apps/backend run build` and `npm --prefix apps/backend run lint`
- Frontend: `npm --prefix apps/frontend run lint` and `npm --prefix apps/frontend run build`
- Formatting: `npm run format:check`
- Tests are not added or run in this slice.

## Risks

- The existing generated-link field is still named and exposed as Zoom. Replacing it
  with Google Meet belongs to the later provider-integration change.
- Until a generated URL exists, a confirmed booking with no Tutor override has no Join
  action; payment remains confirmed and the Tutor can add a URL from the booking page.
- A valid HTTPS URL does not prove that a room exists or admits participants.
