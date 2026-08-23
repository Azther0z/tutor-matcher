## LLM Wiki
- Treat `raw/` as immutable evidence. Preserve source text faithfully; do not add summaries, commentary, or cleanup rewrites to raw evidence files.
- Treat `wiki/` as compiled knowledge. Ground every load-bearing fact in referenced raw evidence or cited wiki pages.
- Before every wiki task, read `wiki/index.md` and use it to route to relevant pages. Then read those pages and search the wider wiki with key terms and synonyms before answering or writing.
- Canonical domain vocabulary lives in wiki pages, not this file. Find it through `wiki/index.md` and use the relevant vocabulary page when interpreting terms.
- Ingest writes evidence to `raw/`, updates affected wiki pages, then updates `wiki/index.md` and `wiki/log.md`. Queries do not write unless the user asks to archive.
- At task completion, update `Wiki Memory` only with confirmed user statements and explicit unresolved user concerns. Rewrite it to current state, leave it unchanged when nothing changed, and briefly report memory changes.
- If `Wiki Memory`, wiki content, and the current user request conflict, pause and ask before acting.
- Lint may repair only the managed LLM Wiki contract. Preserve `Wiki Memory` byte-for-byte unless the user asks to change it.
- Use the `my-llm-wiki` skill when available before ingesting, querying, archiving, or linting this wiki.

## Wiki Memory

### Project Description
- None recorded.

### Goals
- None recorded.

### Preferences
- None recorded.

### Open Threads
- None recorded.

Open threads use this format:

```md
- Question: <explicit unresolved user concern>
  Status: open
  Next step: <next action>
```
