# Review replies delta spec

## ADDED Requirements

### Requirement: One public Tutor reply

The system SHALL accept one nonempty public reply from the Tutor to whom the review belongs.

#### Scenario: Successful reply

- GIVEN a review on the Tutor's profile
- WHEN that Tutor submits a valid reply
- THEN the saved reply is displayed beneath the review, including after reloading.

#### Scenario: Deleted review

- GIVEN a review has been deleted before submission
- WHEN the Tutor submits a reply
- THEN submission is rejected and the UI explains that the review no longer exists.

#### Scenario: Unauthorized or duplicate reply

- GIVEN an unauthenticated user, a Student, a different Tutor, or a review with an existing reply
- WHEN a reply is submitted
- THEN the write is rejected without changing the existing reply.

#### Scenario: Concurrent submissions

- GIVEN two valid submissions for the same unreplied review
- WHEN both reach storage
- THEN only one reply is accepted.

#### Scenario: Owner edits a reply

- GIVEN the reviewed Tutor has an existing reply
- WHEN the Tutor saves changed valid text against the current reply revision
- THEN that same reply displays the new text, preserves its publication date and shows Edited with the latest edit time, including after reload and to public viewers.
- AND Student and other-Tutor edits are rejected.

#### Scenario: Stale or failed edit

- GIVEN the reply changed in another tab or the request fails
- WHEN the Tutor attempts to save a draft
- THEN newer content is not silently overwritten and the draft remains available to copy or retry.
