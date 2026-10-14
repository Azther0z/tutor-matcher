# Subject Management Delta Spec

## ADDED Requirements

### Requirement: Create an online offering

The system SHALL let an approved Tutor create a subject with a trimmed nonempty name and description, a positive THB hourly rate of at most two decimal places within database precision, and `ONLINE` format. Duplicate subject names SHALL be allowed.

#### Scenario: Add an offering

- GIVEN a published or unpublished Tutor opens Tutor settings
- WHEN they open Add subject, complete valid fields and save
- THEN a distinct offering is persisted immediately and appears in their Subjects list after reload.

#### Scenario: Reject invalid input

- GIVEN a Tutor is creating or editing a subject
- WHEN required content is blank, the rate is invalid, or the format is not `ONLINE`
- THEN the save is rejected without changing stored offerings and the form preserves their input.

### Requirement: Edit only the owned offering

The system SHALL save edits immediately to only the selected subject owned by the authenticated Tutor, independently of profile review and publication.

#### Scenario: Inline edit

- GIVEN a Tutor has two offerings
- WHEN they edit and save the first offering inline
- THEN only that offering changes, the other remains unchanged, and no admin review is created.

#### Scenario: Access control

- GIVEN a caller is unauthenticated, has no approved Tutor, or targets another Tutor's subject
- WHEN they attempt subject management
- THEN access is rejected and no subject or booking details change.

#### Scenario: Cancel changes

- GIVEN the add form or an inline editor is open
- WHEN the Tutor cancels
- THEN unsaved input is discarded without a write request.

### Requirement: Preserve booked details

The system SHALL keep a booking's subject name, description, hourly rate, format and total price stable through subsequent subject edits.

#### Scenario: Edit a booked offering

- GIVEN a booking stores its agreed subject details
- WHEN the Tutor changes that subject
- THEN the booking still returns its saved details and total, while future bookings use the updated offering.

#### Scenario: Legacy booking

- GIVEN a booking predates snapshots
- WHEN the Tutor first edits its subject
- THEN the previously stored subject details are captured atomically before updating the subject. Historical values that were already overwritten before this feature cannot be reconstructed.
