# Requirements

- Successful simulated top-up appends TOP_UP and credits the authenticated user atomically; a failed confirmation writes nothing. Duplicate references cannot credit twice.
- No Payment model or PaymentStatus/PaymentType remains. Ledger rows have one user, positive amount, balanceAfter, createdAt and optional bookingId.
- Creating, expiring or cancelling an unpaid booking writes no money row.
- Paying a PENDING_PAYMENT booking atomically debits its totalAmount, appends LESSON_PAYMENT and changes the booking to CONFIRMED. Insufficient funds roll back all changes.
- Cancelling a paid booking appends REFUND according to the existing quote, with no tutor credit. Zero refunds append nothing. Original entries never change.
- All runtime balance mutations use the shared writer. No new earning/payout workflows are introduced.
