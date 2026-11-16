# Refund Notifications Delta Spec

## ADDED Requirements

### Requirement: Student approval message

The system SHALL create exactly one message from the approving Admin to the requesting Student when a refund approval commits. The message SHALL state approval, the exact amount credited in THB with two decimal places, the booked subject name, and a booking reference.

#### Scenario: Successful approval

- GIVEN a paid lesson with a pending Student refund request
- WHEN an authorized non-participant Admin approves it
- THEN the Student receives the refund and one message from that Admin
- AND the message amount matches the linked REFUND ledger movement
- AND the message appears in their conversation and latest-message preview on the next normal fetch.

#### Scenario: Repeated or concurrent approval

- GIVEN an approval already committed or two Admins attempt approval concurrently
- WHEN another approval is attempted
- THEN only the winning decision creates a refund and one message.

#### Scenario: Rejection or failure

- GIVEN a rejection, unauthorized decision, or failed transaction
- WHEN the decision is processed
- THEN no approval message is created
- AND a message-write failure rolls back the approval and refund together.

#### Scenario: Offering changed after booking

- GIVEN a changed current subject name or price
- WHEN the refund is approved
- THEN the message uses the original refund amount and booked subject snapshot, with the established subject-name fallback for legacy bookings.

### Requirement: Existing messaging presentation

The message SHALL use existing authenticated conversation access and plain-text rendering. Email preferences SHALL NOT suppress it. This change SHALL NOT introduce a read-status mechanism or promise live updates to an already-open thread.
