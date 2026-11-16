# Tutor dashboard delta spec

## ADDED Requirements

### Requirement: Tutor teaching summary

The system SHALL show statistics only for the authenticated approved Tutor's teaching activity.

#### Scenario: Established Tutor

- GIVEN an approved Tutor with lessons and published reviews
- WHEN the Tutor dashboard loads
- THEN lesson, distinct-student, status and engagement statistics appear together with review information, review count and average rating.
- AND the average uses all published reviews, independently of the recent-review display limit.

#### Scenario: New Tutor

- GIVEN an approved Tutor with no lessons or reviews
- WHEN the dashboard loads
- THEN counts are zero and rating is unrated without an error.

#### Scenario: Student access

- GIVEN a Student or pending applicant
- WHEN the dashboard or teaching-summary API is requested
- THEN private Tutor dashboard statistics are not disclosed.
- AND this restriction applies to the private dashboard, not public Tutor evaluation information.

#### Scenario: Student evaluates a published Tutor

- GIVEN a published Tutor with an approved profile
- WHEN a Student or visitor opens the public Tutor profile
- THEN ratings, review count, public reviews, completed lesson count and distinct Students taught are readable without owner authorization.
- AND counts use Tutor-confirmed COMPLETED Bookings only; no learner identities, private status breakdown or earnings are exposed.

#### Scenario: Fetch failure

- GIVEN the summary cannot be loaded
- WHEN the Tutor opens the dashboard
- THEN an error and retry action appear without presenting invented zero counts.
