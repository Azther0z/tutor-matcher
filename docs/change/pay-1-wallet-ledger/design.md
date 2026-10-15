# Design

One immutable row belongs to one user. Positive amounts use TOP_UP, LESSON_PAYMENT, LESSON_EARNING, REFUND or PAYOUT to determine the sign. Store balanceAfter and createdAt; omit status, direction and from/to users. Unique bookingId/type prevents duplicate booking movements.

A shared transaction-scoped wallet writer conditionally updates the available balance and appends its resulting balance in the same serializable transaction. Booking state and money changes commit together. Pending bookings have no ledger row. Top-up retains a UUID request reference as the ledger primary key for retry idempotency, validated against the owner and amount. The simulated confirmation is explicitly labelled and rejected in production.

Existing databases need a separately reviewed data conversion before applying this schema: do not use db push with accept-data-loss against existing payments. Test only disposable databases. Preserve cancellation policy settings and booking API compatibility where possible.

## Rollout

- Fresh/disposable development database: point DATABASE_URL at that database, run
  `prisma db push`, then `prisma generate`. Seed only if sample data is wanted.
- Existing data: back up and inspect Payment rows and user balances before any schema
  synchronization. Removing the model does not convert the old records. Do not discard
  them or invent historical balanceAfter values. A separately approved conversion must
  reconcile successful movements, existing balances and paid bookings first.
- Deploy backend and frontend together: confirmation now requires a simulation outcome,
  and returns TOP_UP with balanceAfter instead of the former status/method fields.
- Never use this simulated provider for real money. NODE_ENV=production rejects it.
  A real provider must verify amount, owner and provider reference server-side before
  calling the atomic ledger path. No deployment/environment files are changed here.

## Verification commands

Backend: `npm run gen`, `npm run prisma:validate`, `npm run build`,
`npm test -- --runInBand`, `npm run lint`, `npm run test:bdd`.
Frontend: `npx tsc --noEmit`, `npm test -- --runInBand`, `npm run lint`,
`npm run build -- --webpack`.

Database tests require a disposable PostgreSQL database synchronized with this schema:
set DATABASE_URL to that database and RUN_DATABASE_INTEGRATION=true, then run
`npm test -- --runInBand`. Fixtures are created and removed inside this database only.
The tests exercise duplicate confirmations, insufficient funds, concurrent debits,
failed ledger inserts and booking/payment/refund atomicity.
