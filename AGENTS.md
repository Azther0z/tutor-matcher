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

### Open Threads
- Question: Which backlog stories that contradict the product get cancelled, and which get reworded?
  Status: open
  Next step: Work through `docs/backlog/reconciliation.md` with the product owner; Sprint 1 commits AUTH-1, BOOK-2, BOOK-3, BOOK-4, and PROF-1, which all appear there.
- Question: When do the schema gaps that block documented journeys get closed?
  Status: open
  Next step: Booking's multi-slot/status/price gaps (formerly G1-G3) and the `zoom_meeting_url` gap (formerly G6) closed with the BOOK-1/BOOK-3/BOOK-4 schema; the wallet-ledger and availability-ownership gaps (G4, G5, G7) in `docs/project-schema.md` remain open.
- Question: Which backlog integrity fixes from action item 8 should be applied?
  Status: open
  Next step: Review the proposed dependency ordering, story-boundary correction, entity cleanup, and status semantics.

Open threads use this format:

```md
- Question: <explicit unresolved user concern>
  Status: open
  Next step: <next action>
```

## Current Work Log

### 2026-09-12 — Issue #39 [BOOK-4] Tutor cancel/reschedule

- Branch `feat/39-book-4-tutor-cancel`, cut from `feat/BOOK-1-BOOK-3-booking-flow` (PR #42, BOOK-1/BOOK-3) rather than `main`, since `main`'s booking module and schema cannot represent a cancellable, multi-slot booking at all. Needs a rebase once #42 merges.
- Files changed: `apps/backend/prisma/schema.prisma`; `apps/backend/src/modules/booking/{booking.service,booking.controller,booking.routes,booking.schema,booking.test,booking.integration.test}.ts`; `apps/frontend/app/bookings/page.tsx` and `page.test.tsx`; `apps/frontend/app/bookings/[id]/page.tsx` and `page.test.tsx`; `apps/frontend/src/lib/bookings-api.ts`; `apps/frontend/src/types/booking.ts`.
- Added `Booking.cancelledByUserId` (nullable, `SetNull`) instead of a new reliability-log model — enough to route refunds correctly and to make a future tutor-reliability count a query rather than a migration.
- The story was not a permission widening: the existing student-only code had three real defects once a tutor viewer was admitted — the cancellation refund credited the acting user's balance instead of the student's, the late-cancellation rate (0.7) applied regardless of who cancelled instead of always being 100% for a tutor-initiated cancellation, and there was no query anywhere that could list bookings by tutor. All three are fixed in `booking.service.ts`, gated by a new `bookingActor()` helper reusing the same student-or-tutor predicate `getBooking` already used.
- Descoped: "both parties are notified" (both ACs) has no infrastructure to build on — no mailer, no Notification model, no notification module — and is owned by MSG-2 (`status: todo`, a different pair). Left unimplemented and flagged in the PR rather than improvised.
- Resolved the "Is rescheduling a booking in scope?" open thread: yes, reschedule is real (BOOK-1/BOOK-3 branch, for the student) and this story extends it to the tutor under the same 24-hour window.
- `docs/backlog/reconciliation.md` BOOK-3/BOOK-4 rows updated to record the resolution; `docs/user-journeys.md` §7 and `docs/project-schema.md` updated for the new column and behaviour, per that doc's own "Changing This Schema" checklist.
- Verification: backend `npm run lint`, `npm run build`, and `npm test -- --runInBand` all pass; the new integration tests were also run for real against a local Postgres (`RUN_DATABASE_INTEGRATION=true`), 42/42 passing, after the user reset that container's pre-UUID-migration data. Frontend `npm run lint`, `npm test`, and `npm run build` pass, 26/26 tests.
- Remaining: PR not yet opened; BOOK-4's own `lifecycle`/`status` left at `backlog`/`todo` in its YAML, matching how BOOK-1/BOOK-3 were left unchanged while their PR is still open — flip only once merged.

### 2026-09-08 — Issue #73 Windows justfile workflows

- Files changed: `justfile`, `apps/backend/justfile`, and `README.md`.
- `justfile` and `apps/backend/justfile` now select Windows PowerShell and use `npm.cmd` on Windows while retaining `npm` on Unix-like systems.
- `README.md` documents PowerShell/Command Prompt usage without Git Bash or WSL.
- The temporary Ubuntu/Windows justfile smoke workflow was removed at the user's request.
- Progress: implementation and local Windows verification complete; root and backend justfiles pass formatting checks, `just env`/`status` work, and backend `just validate` passes.
- Remaining: full Docker lifecycle testing remains dependent on a local Docker Desktop environment; no dedicated justfile CI workflow is currently configured.
