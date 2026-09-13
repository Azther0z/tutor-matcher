# Testing — Tutor Matcher

## Current Test Suites

| Scope                      | Runner and libraries                        | Location                                              | Current coverage                                      |
| -------------------------- | ------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------- |
| Backend conventional tests | Jest, Supertest, `ts-jest`                  | `apps/backend/test/` plus `*.test.ts` beside the code | Root route, auth middleware, auth and profile modules |
| Backend behavior tests     | Cucumber.js, Gherkin, TypeScript, Supertest | `apps/backend/features/`                              | Backend root-route scenario                           |
| Frontend tests             | Jest, React Testing Library, jsdom          | `*.test.tsx` beside the page                          | Sign-up page, tutor settings page                     |

The Jest and Cucumber.js backend suites import `apps/backend/src/app.ts`. Supertest creates an
ephemeral listener for each request, so contributors do not need to start the backend development
server before running either suite. The root-route test does not require PostgreSQL; module tests that touch Prisma do.

## Backend Gherkin Layout

```text
apps/backend/
├── cucumber.cjs
└── features/
    ├── health.feature
    ├── step_definitions/
    │   └── health.steps.ts
    └── support/
        └── world.ts
```

- `cucumber.cjs` discovers `.feature` files, loads `ts-node/esm`, and loads support and step
  definition files.
- Feature files describe observable behavior in Gherkin.
- Step definitions translate Gherkin steps into requests and assertions.
- `TutorMatcherWorld` stores scenario-specific state such as the latest Supertest response. Do not
  use module-level mutable state to share data between steps.

## Commands

Run commands from `apps/backend` unless otherwise noted:

```bash
# Conventional backend tests
npm test -- --runInBand

# Backend Gherkin behavior tests
npm run test:bdd

# TypeScript and lint verification, including Gherkin step code
npm run lint
npm run build

# Repository formatting check, run from the repository root
npm run format:check
```

The frontend suite runs separately from `apps/frontend` with `npm test`.

### Pre-commit hook

A Husky `pre-commit` hook runs `lint-staged`, which applies `prettier --write` and the
per-app `eslint --fix` to staged backend and frontend files (auto-restaging the fixes),
then runs `npm run format:check` as a gate. Formatting and lint fixes therefore happen
automatically on commit; the checks above still run in CI.

## Adding Behavior Coverage

1. Add or extend a `.feature` file under `apps/backend/features/` using domain terms from
   [`CONTEXT.md`](../CONTEXT.md).
2. Put reusable setup and scenario state under `features/support/`.
3. Put TypeScript step definitions under `features/step_definitions/`.
4. Exercise the exported Express app through Supertest unless the behavior specifically requires
   a separately running process.
5. Keep each scenario independent so it can run alone or in a different order.
6. Run the Gherkin suite, backend Jest suite, lint, build, and formatting checks before opening a
   pull request.

## Continuous Integration

The validation matrix installs each app independently. Both apps run their Jest suite. The backend
matrix entry additionally runs `npm run test:bdd` before the backend build. A failing Gherkin
scenario therefore fails pull-request validation.

## Current Coverage Boundary

The Gherkin setup currently proves the test wiring through the backend root endpoint. None of the
product's domain flows have Gherkin scenarios yet. Add them as their API contracts and application
behavior are implemented, following the journeys in [User Journeys](user-journeys.md):

| Flow                      | What a first scenario should prove                                              |
| ------------------------- | ------------------------------------------------------------------------------- |
| Account and access        | Guards send a logged-out user to login and return them to the requested route   |
| Tutor application         | Documents plus bio are required, and approval grants the tutor capability       |
| Subjects and availability | A slot advertises only the subjects the tutor assigned to it                    |
| Booking                   | Slots must be back-to-back, and price is slot count x hourly rate / 2           |
| Payment                   | Paying from wallet balance confirms the booking and locks the slots to it       |
| Wallet                    | Every movement writes a transaction, and balances follow the ledger             |
| Payout                    | Any user with available balance can withdraw; over-balance requests are blocked |
| Reviews                   | A review is accepted only from the reviewer's own completed booking             |

The product invariants in [User Journeys](user-journeys.md#invariants) are the shortlist of
behaviours worth a scenario each.
