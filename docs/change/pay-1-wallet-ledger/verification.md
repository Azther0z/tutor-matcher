# Verification: PAY-1 wallet ledger

## Findings

- Docker is not required: PostgreSQL 16.15 was installed in Ubuntu WSL with user approval.
  A new isolated database, codex_pay1_test_20261016, was verified empty before schema push.
  All 22 wallet, booking and availability integration tests pass. No existing database
  was synchronized or reset.
- The unrelated AUTH-4 profile integration suite rejects this database by design: its
  guard requires its own localhost port, role and database names. That guard was preserved;
  those 45 profile integration cases were not run successfully in this environment.
- Simulated top-up is deliberately unavailable in production. The displayed QR is a
  demonstration, not a payable PromptPay code. Real provider integration is not delivered.
- Existing Payment data requires reviewed conversion before this schema can replace it.
  The schema change alone is not a data migration.

## Evidence

- Backend TypeScript build and ESLint: passed.
- Backend Jest: 217 passed; 67 database-dependent tests skipped in 4 suites.
- PostgreSQL integration rerun: 22 passed in 3 suites (wallet, booking, availability),
  with RUN_DATABASE_INTEGRATION=true and DATABASE_URL scoped to the new WSL database.
  The initial all-suite database run passed 239 tests but failed to load the unrelated
  AUTH-4 suite due to its database guard; it is not reported as an all-suite pass.
- Frontend TypeScript and ESLint: passed.
- Frontend Jest: 176 passed. Top-up/navbar rerun after fixture updates: 14 passed.
- Frontend production build: passed using Next webpack.
- Prisma generation, formatting and validation: passed.
- BDD health scenario: 1 scenario, 3 steps passed.
- GitHub CI for code commit 2b01fa4: backend, frontend, format, container and convention passed.
- Changed-file Prettier and git diff whitespace checks: passed.
- Repository-wide Prettier passes with end-of-line auto. The Windows checkout uses
  core.autocrlf=true; a strict LF-only filesystem check flags untouched CRLF files.
  No unrelated or DevOps-owned files were reformatted.

## Requirement mapping

| Requirement                               | Implementation and coverage                                                                   |
| ----------------------------------------- | --------------------------------------------------------------------------------------------- |
| One row per completed wallet movement     | WalletTransaction schema; wallet-ledger tests verify sign, amount and resulting balance       |
| Successful/failed mock top-up             | wallet.service.ts and HTTP tests; frontend confirmation/failure tests                         |
| Retry cannot double-credit                | Primary-key reference with owner/amount validation; duplicate/conflict/retry tests            |
| Pending booking has no row                | create/expiry/cancel remove Payment writes; booking integration fixtures assert no entries    |
| Pay atomically changes booking and wallet | Shared writer inside serializable booking transaction; insufficient-funds database test added |
| Immutable payment plus refund             | Cancellation appends REFUND; database lifecycle test checks original row and unchanged tutor  |
| Rollback/concurrency                      | PostgreSQL tests passed for failed ledger insert, duplicate top-up and competing debits       |
| Scope boundaries                          | No earning/payout/completion workflow, deployment change or real-money provider               |

## Assessment

Implementation and relevant database/non-database checks pass. No critical findings
remain for the approved PAY-1 scope. The unrelated AUTH-4 database suite is not included
in the verified scope. Real payments, data conversion and deferred settlement/payout work
remain the explicit boundaries above. CI results are recorded on the pull request.
