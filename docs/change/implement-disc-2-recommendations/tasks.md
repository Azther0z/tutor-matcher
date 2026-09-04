# Tasks

## 1. Student Preference Data

- [x] 1.1 Add the Prisma student preference models and user relation
  - Acceptance: A student profile stores required level/goals, optional schedule preferences, and one or more normalized subject interests with appropriate uniqueness and foreign keys.
  - Verify: `npm run prisma:validate --workspace=backend` and `npm run prisma:format --workspace=backend`
  - Files: `apps/backend/prisma/schema.prisma`
- [x] 1.2 Generate and review the additive Prisma migration
  - Acceptance: The migration creates only the new preference tables, constraints, indexes, and foreign keys; generated client types include the new models.
  - Verify: `npm run prisma:generate --workspace=backend` and inspect `apps/backend/prisma/migrations/`
  - Files: `apps/backend/prisma/migrations/`, generated Prisma output
- [x] 1.3 Implement authenticated preference read/write endpoints
  - Acceptance: Complete preferences can be saved and read; incomplete or invalid requests return 400; unauthenticated requests return 401.
  - Verify: Backend route tests cover success, validation, persistence, and auth cases.
  - Files: `apps/backend/src/modules/profile/`, `apps/backend/src/routes.ts`

## 2. Recommendation API

- [x] 2.1 Implement the recommendation query and deterministic scoring
  - Acceptance: Only published tutors are considered; booked slots do not count; subject, goal, schedule, rating, and fallback behavior follow the delta spec.
  - Verify: Unit tests cover personalized ordering, schedule matching, fallback ordering, empty results, and stable ties.
  - Files: `apps/backend/src/modules/discovery/discovery.service.ts`, `discovery.schema.ts`
- [x] 2.2 Expose the protected recommendations endpoint
  - Acceptance: `GET /api/discovery/recommendations` returns the documented response and rejects missing or invalid bearer tokens.
  - Verify: Supertest route tests exercise HTTP responses and auth middleware.
  - Files: `apps/backend/src/modules/discovery/discovery.controller.ts`, `discovery.routes.ts`

## 3. Student Journeys

- [x] 3.1 Build the student preference form
  - Acceptance: `/settings` loads saved values, validates required fields and schedule ranges, saves successfully, and shows server errors accessibly.
  - Verify: Frontend tests cover initial load, validation, save success, and save failure.
  - Files: `apps/frontend/app/settings/page.tsx`
- [x] 3.2 Build the ranked recommendation page
  - Acceptance: `/search` displays ranked tutor cards with rating and open-slot information, plus loading, error, empty, and fallback states.
  - Verify: Frontend tests cover personalized and fallback response rendering.
  - Files: `apps/frontend/app/search/page.tsx`

## 4. Verify

- [x] 4.1 Run formatting, lint, typecheck, Prisma, backend, frontend, and repository backlog checks
  - Acceptance: All applicable commands pass and the migration is safe to deploy.
  - Verify: Run every command listed in `design.md` and review `git diff` for scope.
  - Files: All changed implementation and migration files
