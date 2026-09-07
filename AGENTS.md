## Code Style

- **Strings use double quotes** in TypeScript, JavaScript, JSON, and JSX (`"foo"`, not `'foo'`). Use single quotes only to avoid escaping an embedded double quote; prefer template literals for interpolation.
- Prettier is the authority for formatting (`.prettierrc`: double quotes, semicolons, 2-space indent, `printWidth` 100, `trailingComma: "es5"`). Do not hand-format against it.
- Formatting and ESLint `--fix` run on staged files via the Husky `pre-commit` hook; `npm run format` / `just format` reformat the whole tree. CI (`Quality Format`) rejects unformatted code.
- `npm run format` covers managed application, documentation, deployment, workflow, and script files; do not reformat `docs/sources/`, which is immutable evidence.

## Project Documentation And LLM Knowledge
- This repository intentionally uses a project-specific convention that differs from the default `my-llm-wiki` skill layout.
- Treat `docs/sources/` as immutable evidence. Preserve source text faithfully; do not add summaries, commentary, or cleanup rewrites to source files.
- Treat canonical pages directly under `docs/` as authored project documentation. Avoid maintaining a second page for the same concept.
- Treat `docs/` reference pages with evidence metadata as compiled knowledge when they summarize sources. Ground load-bearing facts in the declared source files.
- Before a documentation task, read `docs/index.md`, then search `docs/` for the relevant terms and synonyms.
- Canonical domain vocabulary lives in `CONTEXT.md`; use its terms in project and knowledge documentation.
- Ingest or research writes evidence to `docs/sources/`, updates the affected canonical `docs/` pages, then updates `docs/index.md` and `docs/sources/knowledge-log.md`.
- The `my-llm-wiki` skill may still be used for evidence discipline, but its default root-level `raw/` and `wiki/` paths do not apply here. Do not recreate those directories without an explicit workflow decision.
- At task completion, update `Wiki Memory` only with confirmed user statements and explicit unresolved user concerns. Rewrite it to current state, leave it unchanged when nothing changed, and briefly report memory changes.
- If `Wiki Memory`, documentation content, and the current user request conflict, pause and ask before acting.
- Lint may repair only the managed documentation contract. Preserve `Wiki Memory` byte-for-byte unless the user asks to change it.
- Use the `my-llm-wiki` skill when available before ingesting, querying, archiving, or linting this knowledge base.

## Wiki Memory

### Project Description
- Tutor Matcher is a 1-1 tutoring marketplace: subject-scoped booking of a tutor's published 30-minute slots, confirmed instantly by paying from one wallet balance.
- The clickable prototype (`tutormatcher-prototype`) is the source of truth for product behaviour, not for code. Its material is preserved in `docs/sources/tutormatcher-prototype-*`.
- The database-course Final Report describes an earlier, different design. It is historical evidence, not the product schema.

### Goals
- Keep `docs/user-journeys.md`, `docs/project-schema.md`, and `CONTEXT.md` in sync with the prototype whenever product behaviour changes.

### Preferences
- For AI-assisted Sprint delivery, assign the entire story, including design integration and automated testing, to one fixed two-person pair.
- Treat Sprint `estimate_hours` values as shared pair-hours rather than multiplying them by the number of assignees.
- Retain inline story tasks for the class assignment, but treat them as a work-breakdown and evidence checklist owned by the story pair rather than separate handoffs.
- Balance workload by reassigning whole stories among the fixed pairs without changing pair membership.
- Treat `docs/backlog/backlog.html` as generated output from backlog YAML and `scripts/templates/backlog.html`; update it with `npm run backlog:build` rather than editing it directly.
- Treat the prototype as behavioural authority and `apps/backend/prisma/schema.prisma` as the authority for what the database currently contains.
- While Tutor Matcher has no real production database, do not maintain Prisma migration history; synchronize disposable databases from `schema.prisma` with `prisma db push`.

### Current Work Log

### 2026-09-12 — Rebase AUTH-3 onto current main

- Files changed: auth controller/routes/service/tests, `schema.prisma`, password-reset
  documentation, and `AGENTS.md`.
- Resolved the rebase by preserving current-main UUID authentication and `/api/auth/me`
  behavior while retaining bcrypt signup/login compatibility and the complete
  password-reset flow from the feature branch.
- Converted `PasswordResetToken` and its user relation to UUIDs, and removed the
  reintroduced migration files to preserve the disposable-database `prisma db push`
  workflow.
- Progress: Prisma validation, backend Jest (45 tests), frontend Jest (19 tests),
  backend/frontend lint, and backend/frontend production builds pass.
- Remaining: stage the resolution and complete the in-progress rebase; push the
  rewritten branch with `--force-with-lease` only when explicitly requested.

### 2026-09-08 — Issue #73 Windows justfile workflows

- Files changed: `justfile`, `apps/backend/justfile`, and `README.md`.
- `justfile` and `apps/backend/justfile` now select Windows PowerShell and use
  `npm.cmd` on Windows while retaining `npm` on Unix-like systems.
- `README.md` documents PowerShell/Command Prompt usage without Git Bash or WSL.
- The temporary Ubuntu/Windows justfile smoke workflow was removed at the user's request.
- Progress: implementation and local Windows verification complete; root and backend
  justfiles pass formatting checks, `just env`/`status` work, and backend
  `just validate` passes.
- Remaining: full Docker lifecycle testing remains dependent on a local Docker Desktop
  environment; no dedicated justfile CI workflow is currently configured.

- Date: 2026-09-08
  Task: Add explicit development email delivery mode for password reset.
  Changed files:
  - `apps/backend/src/lib/env.ts` and `apps/backend/src/lib/email.ts` — add `EMAIL_DELIVERY_MODE` with `log`/`resend` validation, environment-based defaults, explicit Resend credential checks, and separate configuration/delivery errors.
  - `apps/backend/src/lib/email.test.ts` — mock Resend and cover defaults, log mode, real-send payloads, invalid/missing configuration, and Resend failures.
  - `apps/backend/.env.example`, `deploy/secrets/backend.env.example`, and `docker-compose.yml` — document/configure explicit local and production-style delivery modes without storing credentials.
  - `README.md` — document `just dev` opt-in setup, Resend testing restrictions, and the production-style `just up` behavior.
  Progress: Backend Jest (36 tests), lint, TypeScript build, and targeted Prettier checks pass. Resend is mocked in automated tests; no API key was read or stored.
  Remaining: Optional manual smoke test with a real Resend account using `just dev`; no code work remains.

- Date: 2026-09-06
  Task: Implement Issue #43 / AUTH-3 password reset with Resend.
  Changed files:
  - `apps/backend/prisma/schema.prisma` — add the hashed, expiring, single-use
    password-reset token model; disposable databases are synchronized with
    `prisma db push`.
  - `apps/backend/src/lib/env.ts` and `apps/backend/src/lib/email.ts` — load reset-email configuration and send reset email through Resend in production, while logging links in development and allowing tests to mock the email client.
  - `apps/backend/src/modules/auth/auth.schema.ts`, `auth.service.ts`, `auth.controller.ts`, and `auth.routes.ts` — add reset request/validate/confirm APIs, SHA-256 token handling, resend invalidation, failed-delivery cleanup, atomic consumption, and bcrypt signup/reset/login support with legacy plaintext login compatibility.
  - `apps/backend/src/modules/auth/auth.test.ts` — cover API validation, generic responses, token hashing/expiry, resend invalidation and cleanup, token lifecycle, atomic reset, and bcrypt/plaintext login behavior.
  - `apps/backend/package.json` and `apps/backend/package-lock.json` — add `bcryptjs` and the official `resend` SDK.
  - `apps/backend/.env.example`, `deploy/secrets/backend.env.example`, and `docker-compose.yml` — document/configure reset-email environment values.
  - `apps/frontend/app/(auth)/login/page.tsx`, `app/forgot-password/page.tsx`, and `app/reset-password/page.tsx` — add the forgot-password link and request/reset user flows.
  - `apps/frontend/app/forgot-password/page.test.tsx` and `app/reset-password/page.test.tsx` — cover request, validation failure, password mismatch, success, and login navigation.
  - `docs/user-journeys.md` and `docs/project-schema.md` — document the public reset routes, behavior, and implemented token table.
  Progress: Backend Jest (26 tests), frontend Jest (10 tests), backend/frontend lint, backend/frontend production builds, Prisma validation/generation, migration deploy/status, PostgreSQL schema inspection, and BDD regression on Node v22.14.0 all pass. Changed application/docs files pass targeted Prettier checks. The repository-wide format check still reports pre-existing formatting warnings across unrelated files and attempts to parse `.gitignore`.
  Remaining: Use a supported Node version (20/22/24+) as the default runtime for the repository's direct BDD command; separately clean the repository-wide pre-existing formatting baseline if the team wants `npm run format:check` green.

### Open Threads
- Question: Which backlog stories that contradict the product get cancelled, and which get reworded?
  Status: open
  Next step: Work through `docs/backlog/reconciliation.md` with the product owner; Sprint 1 commits AUTH-1, BOOK-2, BOOK-3, BOOK-4, and PROF-1, which all appear there.
- Question: Is rescheduling a booking in scope?
  Status: open
  Next step: The prototype implements cancel only, while BOOK-3, BOOK-4, and US4-8 mention reschedule. Decide before building the booking slice.
- Question: When do the schema gaps that block documented journeys get closed?
  Status: open
  Next step: `bookings` has no status column and a booking can hold only one 30-minute slot; see gaps G1-G7 in `docs/project-schema.md`.
- Question: Which backlog integrity fixes from action item 8 should be applied?
  Status: open
  Next step: Review the proposed dependency ordering, story-boundary correction, entity cleanup, and status semantics.

Open threads use this format:

```md
- Question: <explicit unresolved user concern>
  Status: open
  Next step: <next action>
```
