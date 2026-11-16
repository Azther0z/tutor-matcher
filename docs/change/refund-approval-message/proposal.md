# Proposal: Student message after refund approval

## Intent

After an Admin approves a refund request, the Student should receive a message stating approval and the exact amount returned to their wallet.

## Scope

- One automatic message from the approving Admin to the requesting Student.
- Include approval, refunded THB amount, booked subject name, and booking reference.
- Use existing conversations and plain-text presentation.
- Preserve refund policy, authorization, ledger, and Tutor settlement behavior.

Excluded: rejection notices, emails, push delivery, real-time updates, a notification center, and historical backfill.

## Approach

Create the message inside the existing serializable approval transaction. Its guarded pending-state transition prevents duplicates. The existing Message model supports this without a schema change.

## Affected Specs

- `refund-notifications`: added notice behavior. No `docs/spec/` main specs currently exist; use `docs/user-journeys.md` and the refund/messaging implementation as the baseline.

## Impact

- Backend refund approval service and tests.
- Existing Messages UI displays the message without a new route or component.
- Update canonical product documentation after implementation.
