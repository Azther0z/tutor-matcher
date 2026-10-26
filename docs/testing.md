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

### BOOK-3 cancellation acceptance

Booking detail page tests cover reviewed server quotes, failed quote loading and retry,
failed recovery after terms change, late responses after closing the panel, repeat-submit
protection, and publishing the returned wallet balance. No refund is claimed for an unpaid
cancellation. Booking unit tests cover the exact 24-hour boundary and rounding to cents.

`student-cancellation.integration.test.ts` is opt-in with `RUN_DATABASE_INTEGRATION=true`.
It refuses any database except `tutor_matcher_book3_test` on loopback. Create that dedicated
disposable database and synchronize the existing schema before running it; do not point it
at another database. Its fixtures exercise the real HTTP API and PostgreSQL for both refund
windows, ownership/authentication, unpaid cancellation, stale quotes, slot release, immutable
payments, and concurrent/repeated cancellation. Fixture cleanup is restricted to BOOK-3 IDs.

From the repository root, after setting `DATABASE_URL` to that dedicated database:

```powershell
$env:RUN_DATABASE_INTEGRATION = "true"
$env:EMAIL_DELIVERY_MODE = "log"
$env:BOOKING_CANCELLATION_WINDOW_HOURS = "24"
$env:BOOKING_LATE_REFUND_RATE = "0.7"
npm.cmd --prefix apps/backend test -- --runInBand student-cancellation.integration.test.ts
npm.cmd --prefix apps/frontend test -- --runInBand --runTestsByPath "app/bookings/[id]/page.test.tsx"
```

The policy is confirmed in [BOOK-3 user evidence](sources/book-3-policy-confirmation.md).

### BOOK-4 tutor cancellation acceptance

Booking unit tests cover the tutor and student cancel actions on the same lesson, the
`cancelledBy` field and the required tutor reason. Booking detail page tests cover the late
warning, the disabled confirmation until a reason is entered, the full refund to the
student, and the student's "Your tutor cancelled this lesson" note. Upcoming classes tests
cover the list, its links, and the empty and error states.

`tutor-cancellation.integration.test.ts` is opt-in with `RUN_DATABASE_INTEGRATION=true`.
It refuses any database except `tutor_matcher_book4_test` on loopback; create that dedicated
disposable database and synchronize the schema first. It covers full refunds in both windows,
closed slots, unpaid holds, ownership/authentication, the required reason, missing, stale and
student-issued quote tokens, concurrent cancellation, the upcoming list, and `cancelledBy` on
both the tutor and the BOOK-3 student paths. Fixture cleanup is restricted to BOOK-4 IDs.

```powershell
$env:RUN_DATABASE_INTEGRATION = "true"
$env:EMAIL_DELIVERY_MODE = "log"
$env:BOOKING_CANCELLATION_WINDOW_HOURS = "24"
npm.cmd --prefix apps/backend test -- --runInBand tutor-cancellation.integration.test.ts
```

The decisions are recorded in [BOOK-4 user evidence](sources/book-4-policy-confirmation.md).

### PROF-7 payout account acceptance

Payout account unit tests use mocked Prisma. They cover authentication, the bank list, the
first account becoming the default, `makeDefault`, input rules (bank from the list, trimmed
holder name up to 100 characters, 10 to 15 digits after removing spaces and dashes), the
5 account limit, duplicate accounts, the add and remove rate limit, the retry on a one-default race, owner-only 404s, and soft removal that
promotes the oldest account. Wallet settings page tests cover the balance and Top up link,
the empty state, masked rows with the Default badge, form validation, adding, setting the
default, the inline remove confirm (no `window.confirm`), the limit and the error states.

`payout-account.integration.test.ts` is opt-in with `RUN_DATABASE_INTEGRATION=true`.
It refuses any database except `tutor_matcher_prof7_test` on loopback; create that dedicated
disposable database and synchronize the schema first. It covers a Student who is not a
Tutor and a Tutor, the first default, `makeDefault`, atomic and concurrent default switches,
the one-default index, removal that promotes the oldest account, the 5 account limit,
owner-only access, and that no response contains a full account number. Fixture cleanup is
restricted to PROF-7 IDs.

```powershell
$env:RUN_DATABASE_INTEGRATION = "true"
$env:EMAIL_DELIVERY_MODE = "log"
npm.cmd --prefix apps/backend test -- --runInBand payout-account.integration.test.ts
npm.cmd --prefix apps/frontend test -- --runInBand --runTestsByPath "app/settings/wallet/page.test.tsx"
```

The decisions are recorded in [PROF-7 user evidence](sources/prof-7-policy-confirmation.md).

### PAY-7 payout request acceptance

Payout unit tests mock Prisma and cover the PAYOUT row with its payout account, the masked
account number in the response, the over-balance block, a missing or removed account,
repeated and conflicting references, the production switch, invalid amounts and the rate
limit, and that a user who is not a Tutor is rejected. Payout page tests cover the default account, picking another account, the confirm
step, the navbar balance update, the over-balance block, the empty state, the
Tutor-only message and the production-disabled state. Wallet settings shows Request payout
only to Tutors.

`payout.integration.test.ts` is opt-in with `RUN_DATABASE_INTEGRATION=true`. It refuses any
database except `tutor_matcher_pay7_test` on loopback; create that dedicated disposable
database and synchronize the schema first. It covers a Tutor paying out, a Student who is
not a Tutor being rejected with nothing written, exactly one PAYOUT row with the right `balanceAfter` and `payoutAccountId`, a payout
to another saved account, the over-balance block with nothing written, another user's and
removed accounts, a repeated reference, concurrent payouts that cannot overdraw, and the
production switch. Fixture cleanup is restricted to PAY-7 IDs.

```powershell
$env:RUN_DATABASE_INTEGRATION = "true"
$env:EMAIL_DELIVERY_MODE = "log"
npm.cmd --prefix apps/backend test -- --runInBand payout.integration.test.ts
npm.cmd --prefix apps/frontend test -- --runInBand --runTestsByPath "app/wallet/payout/page.test.tsx"
```

The decisions are recorded in [PAY-7 user evidence](sources/pay-7-policy-confirmation.md).

### General commands

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
| Payout                    | Tutors can pay out; non-tutors and amounts over balance are blocked (see PAY-7) |
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

## SAFE-3 acceptance coverage

A database integration test submits a listing and document change (bio and identification
card) and rejects it with a reason. It then copies the rejected request into a new draft with a
new ID, leaving the rejected version unchanged, revises and resubmits it, and approves it. The
owner's current profile then has the new bio and identification card, the public listing
(`GET /api/discovery/tutors/:id`) shows the new bio without the card, and pending or approved
versions still cannot be copied. Frontend tests cover **Revise and re-submit** in the rejection
banner, for an approved Tutor and for a rejected initial application, and **Create draft from
rejected submission** in Submission history.

## DISC-4 acceptance coverage

Discovery tests cover the public subject endpoint: only this subject's details, rating, reviews
and openings; one Bangkok day of open slots that are not closed, held or booked; the 92-day
openings grouped by Bangkok day in SQL with parameters; the next opening (or today) as the
default day; a 400 for a malformed date; and a 404 for another tutor's subject, an unpublished
or unapproved tutor, or a non-UUID id. The PostgreSQL suite (opt-in like DISC-1) checks the
00:00 and 23:30 day edges, closed, held and other-subject slots, the open-day list and
subject-only reviews. Frontend tests cover the day calendar's 48 half-hours (each Available or
Not available, none clickable), consecutive open half-hours drawn as one block, the calendar
opening at the first open time, Book this subject below the calendar with the subject and date
(and the login hand-off), the disabled button on an empty day, calendar selection through the
URL, the back link, the unavailable state and retry.
