# Student Preferences Delta Spec

## ADDED Requirements

### Requirement: Save student recommendation preferences

The system SHALL allow an authenticated student to save at least one subject,
a level, and a goal. It MAY also save preferred weekdays, a preferred local
time window, and an IANA timezone.

#### Scenario: Save complete preferences

- GIVEN an authenticated user submits one or more subjects, a level, and a goal
- WHEN the student preference request is saved
- THEN the system SHALL persist the preferences for that user
- AND THEN the system SHALL return the saved preferences without exposing credentials

#### Scenario: Reject incomplete preferences

- GIVEN an authenticated user submits no subjects, no level, or no goal
- WHEN the student preference request is validated
- THEN the system SHALL return a validation error
- AND THEN the system SHALL not create or overwrite a profile

#### Scenario: Validate an optional schedule

- GIVEN an authenticated user submits schedule preferences
- WHEN a weekday is outside ISO weekdays 1 through 7, a minute is outside 0 through 1439, or the end is not after the start
- THEN the system SHALL return a validation error

#### Scenario: Read saved preferences

- GIVEN an authenticated user has saved student preferences
- WHEN the user requests their student preferences
- THEN the system SHALL return the current subjects, level, goal, and schedule preferences

#### Scenario: Require authentication

- GIVEN a request has no valid bearer token
- WHEN it reads or writes student preferences
- THEN the system SHALL return HTTP 401
