# Proposal: Online subject management (PROF-6)

## Intent

Implement issue [#166](https://github.com/Azther0z/tutor-matcher/issues/166): an approved Tutor can create and independently edit each teaching offering from Tutor settings.

## Scope

In scope:

- A subject name, required description, positive THB hourly rate with at most two decimal places, and Online format.
- An Add subject form and inline editing on `/settings/tutor`, below Verification.
- Immediate, owner-only saves for published and unpublished Tutors. Duplicate names are allowed.
- Preserve booked subject details when an offering changes, as confirmed during exploration.

Out of scope:

- In-person offerings, venues, subject removal, availability management, discovery and public subject-page implementation.
- Subject review, lesson completion, earnings settlement and deployment changes.

## Approach

Add an authenticated subject-management API, reuse the existing owner profile response to load subjects, and keep subject saves separate from profile review. Store subject details on new bookings; preserve the currently available details of legacy bookings before the first subject edit.

## Affected Specs

- `subject-management`: added creation/editing and preservation requirements. No existing `docs/spec/` main spec exists.

## Impact

- Backend subject module, profile owner response and Prisma schema.
- Booking serialization/creation and regression coverage.
- Tutor settings component, subject form and tests.
- Canonical subject/schema documentation.

## Artifacts

- [Behavior specification](spec/subject-management.md)
- [Implementation design](design.md)
- [Tasks and verification](tasks.md)
