## Code Style

- **Strings use double quotes** in TypeScript, JavaScript, JSON, and JSX (`"foo"`, not `'foo'`). Use single quotes only to avoid escaping an embedded double quote; prefer template literals for interpolation.
- Prettier is the authority for formatting (`.prettierrc`: double quotes, semicolons, 2-space indent, `printWidth` 100, `trailingComma: "es5"`). Do not hand-format against it.
- Formatting and ESLint `--fix` run on staged files via the Husky `pre-commit` hook; `npm run format` / `just format` reformat the whole tree. CI (`Quality Format`) rejects unformatted code.
- `npm run format` only covers `apps/**` — do not reformat `docs/` (especially `docs/sources/`, which is immutable evidence).

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
- Tutor Matcher is currently documented through its database design; the supplied Final Report covers the database part.

### Goals
- Design the software architecture in a later task.

### Preferences
- None recorded.

### Open Threads
- Question: What software architecture should be designed around the Tutor Matcher database?
  Status: open
  Next step: Define application layers, services, APIs, clients, deployment, authentication, and integration boundaries.

Open threads use this format:

```md
- Question: <explicit unresolved user concern>
  Status: open
  Next step: <next action>
```
