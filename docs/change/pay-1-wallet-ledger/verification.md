# Verification: PAY-1 wallet ledger

## Findings

- Database integration execution is pending: Docker Desktop opens, but its Linux engine
  pipe is unavailable and the docker-desktop WSL distribution is stopped. No existing
  database has been synchronized or reset. The PostgreSQL tests are not counted as passing.
- Simulated top-up is deliberately unavailable in production. The displayed QR is a
  demonstration, not a payable PromptPay code. Real provider integration is not delivered.
- Existing Payment data requires reviewed conversion before this schema can replace it.
  The schema change alone is not a data migration.

## Evidence

- Backend TypeScript build and ESLint: passed.
- Backend Jest: 217 passed; 67 database-dependent tests skipped in 4 suites.
- Frontend TypeScript and ESLint: passed.
- Frontend Jest: 176 passed. Top-up/navbar rerun after fixture updates: 14 passed.
- Frontend production build: passed using Next webpack.
- Prisma generation, formatting and validation: passed.
- BDD health scenario: 1 scenario, 3 steps passed.
- Changed-file Prettier and git diff whitespace checks: passed.
- Repository-wide Prettier passes with end-of-line auto. The Windows checkout uses
  core.autocrlf=true; a strict LF-only filesystem check flags untouched CRLF files.
  No unrelated or DevOps-owned files were reformatted.

## Requirement mapping

| Requirement                               | Implementation and coverage                                                                              |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| One row per completed wallet movement     | WalletTransaction schema; wallet-ledger tests verify sign, amount and resulting balance                  |
| Successful/failed mock top-up             | wallet.service.ts and HTTP tests; frontend confirmation/failure tests                                    |
| Retry cannot double-credit                | Primary-key reference with owner/amount validation; duplicate/conflict/retry tests                       |
| Pending booking has no row                | create/expiry/cancel remove Payment writes; booking integration fixtures assert no entries               |
| Pay atomically changes booking and wallet | Shared writer inside serializable booking transaction; insufficient-funds database test added            |
| Immutable payment plus refund             | Cancellation appends REFUND; database lifecycle test checks original row and unchanged tutor             |
| Rollback/concurrency                      | PostgreSQL tests added for failed ledger insert, duplicate top-up and competing debits; not yet executed |
| Scope boundaries                          | No earning/payout/completion workflow, deployment change or real-money provider                          |

## Assessment

Implementation and non-database checks pass. Database verification remains a warning
until the disposable PostgreSQL tests run. CI results are recorded on the pull request.
