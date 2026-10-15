# Availability Delta Spec

## ADDED Requirements

### Requirement: Owned subject-specific slots

The system SHALL let approved Tutors, including unpublished Tutors, manage only their own
date-specific half-hour slots on the Asia/Bangkok :00/:30 grid. Each open slot SHALL carry
at least one of that Tutor's subjects. A slot may advertise multiple subjects, but the same
Tutor's time SHALL NOT be represented by overlapping slots. No future publishing horizon
SHALL be imposed on Tutors.

#### Scenario: Publish shared availability

- GIVEN an approved Tutor owns Mathematics and English
- WHEN they open a future 10:00 slot for both subjects and save that slot
- THEN both subject booking views advertise the same slot if the listing is published
- AND reserving it for either subject makes it unavailable for both.

#### Scenario: Reject invalid ownership or overlap

- GIVEN an authenticated caller submits foreign subjects, a stale slot revision, or off-grid times
- WHEN they save a slot
- THEN the complete request is rejected without changing availability.

### Requirement: Dated calendar and individual slot saves

The editor SHALL show a seven-day calendar with selectable 30-minute cells and a monthly
availability overview. Clicking a date in the month SHALL open its week for editing.
The system SHALL allow creating, closing and reassigning free future slots through an
individual slot save, with no day or week save step.
Paid slots, active payment holds and past slots SHALL NOT be changed. Expired holds SHALL
be released through the existing booking lifecycle. A slot revision SHALL prevent stale
edits from overwriting concurrent changes to that slot. A conflict SHALL reject that save;
the editor SHALL preserve the slot's draft for explicit review and retry. Saving a different
slot SHALL NOT invalidate an otherwise current revision.

#### Scenario: Booking wins a race with a calendar edit

- GIVEN a Tutor drafts closing 10:00
- AND a student reserves 10:00 before the save completes
- WHEN the Tutor saves
- THEN the slot edit is not committed
- AND the student's booking remains protected
- AND the Tutor can review the latest slot while retaining their draft.

#### Scenario: Navigate from month to week and save one slot

- GIVEN a Tutor is viewing a future month's availability overview
- WHEN they click a date, choose a half-hour cell and assign subjects
- THEN Save slot publishes that cell immediately
- AND the month overview reflects the saved slot without a day or week save.

### Requirement: Booking uses only open assigned slots

The system SHALL expose only future, open, unclaimed slots for a selected subject on a
published listing. Closing a slot SHALL prevent both new bookings and rescheduling into
it. Existing bookings and PROF-6 subject snapshots SHALL remain intact.

#### Scenario: Close an unbooked slot

- GIVEN an open slot is assigned to Mathematics
- WHEN its owning Tutor closes it
- THEN it disappears from Mathematics booking availability
- AND a direct booking request for its ID is rejected.
