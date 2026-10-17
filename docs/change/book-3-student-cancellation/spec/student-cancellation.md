# Student Cancellation Delta Spec

## ADDED Requirements

### Requirement: Review server-calculated terms before cancelling

The system SHALL show the original paid amount, policy window, refund rate, cancellation fee, and wallet refund before requesting cancellation. An optional reason SHALL be limited to 500 characters.

#### Scenario: Quote cannot be loaded

- GIVEN the Student opens cancellation and the quote request fails
- WHEN the error is shown
- THEN confirmation remains disabled and the Student can retry or keep the lesson.

#### Scenario: Terms change before confirmation

- GIVEN a Student has reviewed a quote
- WHEN cancellation returns a changed quote
- THEN the old quote is invalidated and the Student must explicitly confirm current terms; failed quote recovery never enables the old quote.

#### Scenario: Cancellation request is in progress

- GIVEN a Student confirms cancellation
- WHEN the request is pending
- THEN repeat confirmation and competing booking actions are disabled.

### Requirement: Show the resulting wallet balance

The system SHALL publish the wallet balance returned in the successful booking response so the navbar updates without a page reload. It SHALL not calculate the new balance in the browser or report a successful refund as failed because a secondary balance fetch fails.

## MODIFIED Requirements

### Requirement: Preserve cancellation ledger guarantees

The system SHALL retain server-time policy calculation, owner-only access, serializable cancellation and slot release, immutable original LESSON_PAYMENT rows, and at most one positive REFUND row. Unpaid cancellations SHALL write no money movement. Under the approved default, a paid lesson more than 24 hours away SHALL refund 100%; at exactly 24 hours or less, before the lesson starts, it SHALL refund 70% rounded to two decimal places.

#### Scenario: Cancellation is rejected

- GIVEN a non-owner, already cancelled, completed, or started lesson
- WHEN cancellation is requested
- THEN no refund or slot change is committed.

#### Scenario: Duplicate cancellation requests

- GIVEN a paid cancellable lesson
- WHEN requests race or a successful request is repeated
- THEN only one cancellation and refund commit.
