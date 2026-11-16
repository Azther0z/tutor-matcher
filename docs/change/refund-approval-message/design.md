# Design: Student message after refund approval

## Context

- `reviewRefund` in `apps/backend/src/modules/refund/refund.service.ts` already runs in `runSerializable` and guards the pending decision.
- `refundBooking` appends the REFUND movement and links it to the request. The request amount comes from the original LESSON_PAYMENT.
- Message stores sender, recipient, text, and creation time. Both participants are real users.
- Existing conversation, inbox, and thread APIs expose persisted messages. The frontend shows the sender's actual name.
- `notifyUser` sends optional email; it does not persist in-app messages.

## Decisions

### Sender and wording

Use the approving `adminId` as sender and `request.userId` as recipient. Reuse that Admin's existing conversation; do not invent a shared system account. Different Admins retain separate conversations.

Proposed message:

> Refund approved by Admin. Your refund for Mathematics has been approved. THB 1,000.00 has been credited to your wallet.
>
> Booking reference: <booking ID>

Keep plain text without badges or nested cards. The reference is plain text because the existing renderer does not provide structured booking links. Sender choice and wording are recommended defaults for this plan.

### Atomic persistence

Create the message with `tx.message.create` after refund creation inside the same transaction. Do not call global-client `sendMessage` from the transaction. A small pure formatter in the refund module is sufficient if needed.

Reuse the pending-state guard and serializable retry handling. Rolled-back attempts leave neither money nor a notice. A committed approval cannot create another notice. Do not independently retry message creation after approval.

### Amount and subject

Format the persisted refund amount with Decimal-safe arithmetic and two decimal places; never recompute it from the current hourly rate or use floating point. Assert equality with the linked ledger amount in tests. Use `booking.subjectName` and its existing legacy fallback.

### Delivery timing

The message is available immediately after commit through normal APIs. Existing Messages/navbar fetch behavior discovers it; there is no new polling or socket work. The existing navbar inbox marker is not true unread tracking and remains unchanged.

## Implementation Notes

- `apps/backend/src/modules/refund/refund.service.ts`: transactional approval notice.
- `apps/backend/src/modules/refund/refund.integration.test.ts`: sender, recipient, amount, conversation visibility, concurrency, and rollback coverage.
- Optional local formatter and focused tests for decimal formatting and booking snapshots.
- No schema, migration, deployment, or frontend route changes.

## Verification Commands

- Build/typecheck: `npm run build --workspace=backend`.
- From `apps/backend`: `npm test -- --runInBand --runTestsByPath src/modules/refund/refund.test.ts src/modules/messaging/messaging.test.ts`.
- Database integration: from `apps/backend`, set `RUN_DATABASE_INTEGRATION=true` and run `npm test -- --runInBand --runTestsByPath src/modules/refund/refund.integration.test.ts` only against its guarded local `tutor_matcher_pay3_test` database. Obtain authorization before creating/resetting or directly modifying database data.
- Lint from `apps/backend`: `npx eslint src/modules/refund/`.
- Manual: inspect a disposable approved-refund fixture in Student Messages and wallet history. Do not approve a real refund solely for testing.

## Risks

- A message-write failure intentionally prevents approval to guarantee every committed approval has its notice.
- Current message fetching does not instantly refresh an already-open thread.
- Legacy bookings without a name snapshot retain the current established fallback.
