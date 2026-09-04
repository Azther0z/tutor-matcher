# Discovery Recommendations Delta Spec

## ADDED Requirements

### Requirement: Return ranked tutor recommendations

The system SHALL provide an authenticated recommendation request that returns
published tutors ordered by relevance, review rating, and open availability.
Recommendations SHALL expose enough information for a student to understand
the tutor choice, including tutor identity, subjects, average rating, and open
slot information.

#### Scenario: Rank using student preferences

- GIVEN a student has saved subjects, level, or goals and tutors are published
- WHEN the student requests recommendations
- THEN tutors whose subjects match the student's subjects SHALL rank ahead of non-matching tutors
- AND THEN tutors whose subject descriptions or bios match meaningful goal terms SHALL receive relevance credit
- AND THEN tutors with open slots matching the student's preferred schedule SHALL receive availability credit
- AND THEN review rating SHALL be used as a tie-breaker after relevance and schedule fit

#### Scenario: Use fallback ranking without preferences

- GIVEN a student has no saved student preferences
- WHEN the student requests recommendations
- THEN the system SHALL return published tutors ordered by review rating and open availability
- AND THEN the response SHALL identify that fallback ranking was used

#### Scenario: Exclude unusable tutor slots

- GIVEN a tutor has published status and both booked and unbooked availability
- WHEN recommendations are generated
- THEN only unbooked availability SHALL contribute to availability ranking and response counts

#### Scenario: Return an empty result safely

- GIVEN no published tutor has an open slot
- WHEN recommendations are requested
- THEN the system SHALL return an empty recommendation list with HTTP 200

#### Scenario: Require authentication

- GIVEN a request has no valid bearer token
- WHEN recommendations are requested
- THEN the system SHALL return HTTP 401
