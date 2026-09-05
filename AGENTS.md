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
