# Testing — Tutor Matcher

## Current Test Suites

| Scope                      | Runner and libraries                        | Location                 | Current coverage                                                           |
| -------------------------- | ------------------------------------------- | ------------------------ | -------------------------------------------------------------------------- |
| Backend conventional tests | Jest, Supertest, `ts-jest`                  | `apps/backend/test/`     | `GET /` response                                                           |
| Backend behavior tests     | Cucumber.js, Gherkin, TypeScript, Supertest | `apps/backend/features/` | Backend root-route scenario                                                |
| Frontend tests             | Jest, React Testing Library, jsdom          | Frontend test files      | Test infrastructure is configured; feature coverage is not yet established |

The Jest and Cucumber.js backend suites import `apps/backend/src/apps.ts`. Supertest creates an
ephemeral listener for each request, so contributors do not need to start the backend development
server before running either suite. The current root-route test does not require PostgreSQL.

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

- `cucumber.cjs` discovers `.feature` files, loads `ts-node/register`, and loads support and step
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

The Gherkin setup currently proves the test wiring through the backend root endpoint. Domain
flows for members, classes, availability slots, bookings, payments, reviews, reports, and posts do
not yet have Gherkin scenarios. Add those scenarios as their API contracts and application behavior
are implemented.
