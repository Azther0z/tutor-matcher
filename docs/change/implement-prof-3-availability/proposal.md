# Proposal: Tutor availability

## Intent

Deliver PROF-3 (#163) on top of PROF-6 PR #189 so Tutors can publish subject-specific,
non-overlapping availability and students can book those slots.

## Scope

In scope: a seven-day Tutor calendar, a month overview that opens a selected date's week,
owner-only APIs, shared subject assignments, individual slot saves, closing and editing free
future slots, and integration with existing booking.
Paid bookings and active payment holds lock their slots. Tutors may publish any future date.

Out of scope: search and subject-detail pages, recurring availability, the rest of the Tutor
dashboard, production changes, migrations, commits and publication.

## Approach

Use one tutor-owned slot per half-hour, with subject joins and an explicit open state.
Check each slot's revision and save that slot in one serializable transaction. Preserve its
draft on conflicts. Canonical `docs/user-journeys.md` defines product behavior; the prototype
is historical evidence. Its three-month student-calendar rule is not a Tutor publishing cap.

## Affected Specs

- `availability`: added management, concurrency and booking eligibility requirements.

## Impact

- Prisma schema, seed and fixtures: ownership, open state and unique Tutor/start.
- Backend availability/profile/booking modules: calendar reads, slot editing and bookability.
- Frontend Tutor dashboard and availability components: editor and conflict recovery.
- Canonical docs and authority guidance: confirmed behavior and sources.
