# Testing — Tutor Matcher

## Current Test Suites

| Scope                      | Runner and libraries                        | Location                                              | Current coverage                                                            |
| -------------------------- | ------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------- |
| Backend conventional tests | Jest, Supertest, `ts-jest`                  | `apps/backend/test/` plus `*.test.ts` beside the code | Root, auth, profile review, discovery, messaging and booking modules        |
| Backend behavior tests     | Cucumber.js, Gherkin, TypeScript, Supertest | `apps/backend/features/`                              | Backend root-route scenario                                                 |
| Frontend tests             | Jest, React Testing Library, jsdom          | `*.test.tsx` beside the page                          | Auth, profile applications/edits, admin review, discovery and booking pages |

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

Changes to `deploy/`, `.doco-cd.yaml` or the check itself run the Deployment Configuration check,
`.github/scripts/validate-deploy-compose.sh`. It reads env files from `deploy/compose.yaml` itself,
because Compose v2 and v5 print them differently, and names each setting that doesn't match. Run
it locally from the repository root with Docker Compose, `jq` and `yq` installed. The Convention
check explains which part of a PR title or branch name is wrong and suggests a fixed one.

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

## AUTH-4 acceptance coverage

Profile workflow tests exercise initial pending applications without creating a Tutor,
admin-only approval/rejection, rejection reasons, multiple private drafts, draft-specific
editing/discard/submission, ownership and immutable submitted versions. Other drafts
remain editable during review; concurrent submissions permit only one pending request.
Certifications are optional; supplied URLs are validated and remain version-specific through
replacement, removal and retries. Withdrawal retains cancelled history without creating a draft; duplicate withdrawals cancel only once. Owner-only explicit copying creates a new draft with the exact submitted content. Admin history includes submitted statuses and excludes unsent drafts. Approved edits
switch profile versions while preserving Tutor identity and publication. Public
responses exclude identification-card references and proposed certificate versions, while
showing the current approved portfolio. Frontend tests cover application
and edit states, draft modals with sticky headers/footers and Save/Cancel close prompts with × to discard unsaved edits,
draft-specific Edit/Trash icons, submission confirmations, the absence of certification inputs
(drafts save an empty list), admin comparisons/actions, access errors, and readable
submit-button hover styles.

Run the real PostgreSQL workflow and booking regression suites against an isolated
database already synchronized to the schema:

```bash
RUN_DATABASE_INTEGRATION=true npm --prefix apps/backend test -- --runInBand
```

The booking regression verifies that unpublished tutors reject new bookings while
existing booked subject details and conversations remain accessible. The local reset
workflow is described in the README; it deletes and recreates disposable databases
without Prisma migration history. Database tests also verify that a second pending
version is rejected by the partial unique index even when bypassing workflow services.

## SAFE-2 acceptance coverage

Admin tests verify that approving a request whose identification card or certification URL has
an unsupported extension returns 422 naming each file and leaves the request pending, that
extension-less URLs stay approvable, and that rejection still works. Rejection emails the
trimmed reason to the applicant after the decision commits; an email failure is logged without
undoing the rejection. Frontend tests cover the disabled Approve action, the file list and the
server's 422 message.

## PROF-2 acceptance coverage

A database integration test edits an approved Tutor's bio and introduction video and reads the
public profile (`GET /api/discovery/tutors/:id`) before and after review: approval shows the new
content, and a later rejected edit leaves it unchanged while the owner sees the rejection reason.
Frontend tests cover the submit gate: pressing Submit with required fields missing is blocked,
highlights those fields, and clears each error once it is fixed. Search results read each Tutor's
current approved version since DISC-1 (see below), so an approved edit shows there too.

## DISC-3 acceptance coverage

Profile API tests (`discovery.test.ts`, Prisma mocked) cover the public route, the bio, rating,
per-subject rates and next openings, only the next two weeks of free open slots, recent reviews
shown as first name and last initial, and no private verification data. An unpublished tutor,
one without an approved current profile, a missing tutor and a non-UUID id all return 404 and
read no reviews or slots. Frontend tests (`app/tutors/[id]/page.test.tsx`) cover every section
rendering, inline YouTube and video-file playback, non-http(s) video links being dropped, empty
states, the unavailable message with no details, retry after an error, and messaging for
signed-in and signed-out visitors.

PR #202 review regressions also assert that profile GET never starts booking cleanup,
the detailed slot query is bounded to 14 days, and the parameterized next-opening query
groups the existing 92-day horizon into one row per subject. Unicode initials preserve
non-BMP characters and omit punctuation for empty surnames. Header/card rates share
two-decimal formatting; embeds use lazy loading, sandbox and referrer restrictions,
HTTPS video files do not preload or autoplay, and HTTP files remain external links.

Second-review regressions cover repeated Enter/click during a pending message, retry after
failure, IME composition without premature submission, bounded review stars and visible
slot subject names. The detailed-slot mock returns rows within the asserted query bounds;
later next openings are supplied only by the grouped query.

## DISC-1 acceptance coverage

Search runs as one SQL query: Postgres filters, counts each subject's reviews and classes taught,
sorts and returns only the requested page, and a second query counts every match. The price
slider's range comes from `GET /api/discovery/price-range`, which the page loads once.
Search API tests (`discovery.test.ts`) mock Prisma. They cover the public routes, invalid query
rejection before any query (including half-star ratings and a minimum price above the maximum),
one result per subject with that subject's own price, rating and classes taught, every keyword
word against the subject and every name word against the tutor, the price range, each sort
order, the minimum-rating filter, and pagination after filtering. The PostgreSQL suite
(`discovery.integration.test.ts`, opt-in like AUTH-4) runs the real query: case-insensitive and
Thai matches, `%` and `_` typed literally, paging and a page past the end, the price range, a tutor's subjects as separate results, each subject's own areas and price, ranking,
the rating filter, unpublished tutors hidden, and no results. Subject tests cover the
one-to-three learning-area rule and unknown areas. Frontend tests cover URL filters, one card
per subject, immediate and debounced re-filtering (keeping a filter picked during the pause),
the two-thumb price slider and its rounding, half-star rating, paging, the no-results state with
its broadening suggestions, Clear filters, retry after an error, and the learning-area picker in
the subject form.
