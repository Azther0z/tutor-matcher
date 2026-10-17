# Tutor Recommendations Delta Spec

## ADDED Requirements

### Requirement: Rank recommendations for a Student

The system SHALL rank each matching Subject using its learning-area overlap with the authenticated Student, its average rating, and its next available slot within 30 days. The normalized score SHALL be `0.5R + 0.3T + 0.2A`, where relevance is matching selected Student learning areas divided by selected Student learning areas, rating is the subject average divided by five, and availability is `max(0, 1 - waitMilliseconds / (30 days in milliseconds))`. Missing rating or availability contributes zero.

#### Scenario: Student has selected learning areas

- GIVEN an authenticated Student profile has one or more learning areas
- WHEN the Student requests recommended discovery results
- THEN matching Subjects are ranked by the personalized score before pagination and the response identifies `personalized` mode

#### Scenario: No profile, no selected areas, or visitor

- GIVEN a visitor, user without a Student profile, or Student without selected learning areas requests recommendations
- WHEN the results are ranked
- THEN Subjects use `0.6T + 0.4A` and the response identifies `fallback` mode

#### Scenario: No Subject matches selected areas

- GIVEN the Student has selected learning areas but no listed Subject matches them
- WHEN recommendations are returned
- THEN the response remains in personalized mode and each Subject receives zero relevance

### Requirement: Use valid Subject availability

The system SHALL calculate availability from the earliest slot strictly after the request time and no later than 30 days after it, where the slot is open, unbooked and assigned to that Subject. A Subject without a qualifying slot SHALL remain eligible with availability score zero and `nextAvailableAt` null.

#### Scenario: Availability boundaries and exclusions

- GIVEN a Subject has past, closed, booked, unrelated or out-of-window slots
- WHEN recommendation availability is calculated
- THEN only its qualifying future slots affect the score

### Requirement: Preserve search behavior and disclose mode

The system SHALL filter matching Subjects before ranking and pagination, return one result per Subject, and preserve existing non-recommended sorts. Recommended responses SHALL include `recommendationMode` (`personalized` or `fallback`) and every result SHALL include `nextAvailableAt`; other sorts SHALL return a null mode. Personalized responses SHALL not be publicly cacheable.

#### Scenario: Non-recommended sort

- GIVEN a visitor or Student selects price or top-rated sorting
- WHEN search results are returned
- THEN the existing sort behavior is preserved and `recommendationMode` is null

### Requirement: Show useful recommendation context

The system SHALL label personalized and fallback recommendations, display the next available time in Asia/Bangkok time, and offer authenticated users in fallback mode a link to edit Student learning areas.

#### Scenario: Account changes during discovery

- GIVEN a user logs in, logs out, or switches accounts while discovery is open
- WHEN the auth state changes
- THEN outstanding requests are cancelled, results from the previous identity are cleared, pagination resets to page one and discovery reloads for the current identity

#### Scenario: Expired authentication

- GIVEN a recommendation request uses an expired or invalid token
- WHEN the API rejects it with 401
- THEN the client clears authentication using its existing flow and reloads fallback results without retaining prior-account results
