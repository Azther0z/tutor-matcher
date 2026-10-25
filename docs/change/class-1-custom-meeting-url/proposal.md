# Proposal: Let Tutors manage a booking meeting link

## Intent

Give the booked Tutor a way to provide or repair a meeting link while platform-generated
meeting creation is deferred. This unblocks online lessons without coupling the Tutor URL
to the future Google Meet integration.

## Scope

In scope:

- Store a Tutor-provided URL separately from the existing generated-link field.
- Prefer the Tutor URL for the single Join action; removing it restores the existing link.
- Let the booked Tutor add, replace, or remove the URL on a confirmed booking until its
  scheduled end.
- Accept valid HTTPS URLs without checking the provider or testing the meeting room.
- Show the latest editor and update time on the booking page.

Out of scope:

- Creating Google Meet rooms, OAuth, retries, provider capacity, or host controls.
- Changing payment, cancellation, or rescheduling policy.
- New email or inbox notifications, calendar events, or copied-link revocation.

## Approach

Add a nullable custom URL and latest-edit metadata to Booking. Add an authenticated
booking endpoint that checks Tutor ownership, booking status, and the scheduled end on
the server. Return both stored links and expose the effective URL and edit/join actions
in the booking response. The booking page provides the Tutor editor and one effective
Join action. The existing `zoomMeetingUrl` remains the generated-link fallback until a
separate provider-integration change replaces it.

## Affected Specs

- `lesson-delivery`: add Tutor-managed meeting-link behavior to confirmed bookings.

## Impact

- `apps/backend/prisma/schema.prisma`: store the custom URL and latest editor/time.
- `apps/backend/src/modules/booking/`: authorize edits and return effective link state.
- `apps/frontend/app/bookings/[id]/page.tsx`: let the Tutor manage the override and let
  either participant join through the effective URL.
- `docs/user-journeys.md`, `docs/database-schema.md`, and `docs/index.md`: document the
  shipped behavior and current storage.
