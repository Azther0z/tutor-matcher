# Tasks

## 1. Backend recommendations

- [x] 1.1 Add optional authentication for tutor search and personalized cache headers.
  - Acceptance: Anonymous requests remain public; missing Student profile uses fallback; supplied invalid/expired tokens receive 401; personalized responses are private/no-store.
  - Verify: Discovery route/controller tests for anonymous, valid, invalid and expired credentials.
  - Files: Discovery routes, authentication middleware, discovery tests.
- [x] 1.2 Implement ranking and response metadata.
  - Acceptance: SQL computes the agreed scores and availability per Subject before deterministic pagination; filters, one-result-per-Subject and other sorts remain correct; response includes mode and nextAvailableAt.
  - Verify: Unit and PostgreSQL integration tests with a fixed request time and ranking fixtures.
  - Files: Discovery service, API types and discovery integration tests.
  - Note: PostgreSQL integration cases are in place but could not run because this environment has no PostgreSQL client/server, Docker executable, or listener on the required isolated test port `127.0.0.1:55434`.

## 2. Frontend recommendations

- [x] 2.1 Add account-aware discovery requests and recommendation context.
  - Acceptance: Recommended requests send the current token; auth changes abort and clear old results, reset page and reload; 401 clears auth and safely retries fallback.
  - Verify: Frontend tests cover personalized, fallback, identity change, stale response and 401.
  - Files: Discovery API, tutor search component and its tests.
- [x] 2.2 Show mode and next available time.
  - Acceptance: Personalized/fallback labels, Bangkok-local next availability, no-slot text and learning-area settings link render correctly.
  - Verify: Card and discovery page UI tests.
  - Files: Subject card, tutor search component and tests.

## 3. Documentation and verification

- [x] 3.1 Update canonical discovery documentation and schema explanation.
  - Acceptance: User journeys explain the formula, fallback and availability; schema docs explain that existing Student and Subject learning areas and availability support ranking; index links remain valid.
  - Verify: Review docs against implementation and resolve all new links.
  - Files: User journeys, database schema, documentation index.
- [x] 3.2 Run validation and inspect the final diff.
  - Acceptance: Targeted and app-wide tests, isolated database integration, builds, lint, typecheck and formatting pass; no DevOps or immutable evidence files changed.
  - Verify: Commands recorded in design.md; inspect `git diff --check` and status.
  - Files: Files touched by tasks 1–3.

## Verification results

- Backend Jest: 15 suites passed / 232 tests passed; 4 database suites skipped because the isolated PostgreSQL test database was unavailable.
- Frontend Jest: 22 suites / 193 tests passed.
- Backend and frontend lint, backend build, and frontend TypeScript no-emit check passed. Frontend production build could not fetch Geist fonts from Google Fonts in this network-restricted environment.
- Targeted Prettier check and `git diff --check` passed. Repository-wide `npm run format:check` remains red because 209 pre-existing files outside this change are unformatted.
- The PostgreSQL integration suite, production browser check and whole-repository formatting check could not be completed in this environment; no database was started or modified.
