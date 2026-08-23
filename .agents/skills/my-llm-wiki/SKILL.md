---
name: my-llm-wiki
description: "Use when building or maintaining a personal LLM-powered knowledge base, including its raw evidence, compiled wiki pages, and root AGENTS.md wiki operating instructions. Triggers: ingesting sources into a wiki, querying wiki knowledge, linting wiki quality, shopping or buying-list research in a wiki, 'add to wiki', 'what do I know about', or any mention of 'LLM wiki', 'my LLM wiki', or 'Karpathy wiki'."
sources:
  - https://github.com/Astro-Han/karpathy-llm-wiki
  - https://www.skills.sh/astro-han/karpathy-llm-wiki/karpathy-llm-wiki
---

# Karpathy LLM Wiki

Build and maintain a personal knowledge base using LLMs. You manage two directories and one agent instruction file: `raw/` (immutable evidence), `wiki/` (compiled knowledge articles), and root `AGENTS.md` (compact operating instructions for future agents). Sources go into `raw/`; you compile them into `wiki/`; `AGENTS.md` tells future agents how to preserve the wiki's invariants.

Core ideas from Karpathy:
- "The LLM writes and maintains the wiki; the human reads and asks questions."
- "The wiki is a persistent, compounding artifact."

## Architecture

All paths are under the user's project root.

**raw/** — Immutable source material and faithful text extractions. `raw/` accepts arbitrary paths; there is no required topic-directory layout. It may contain:
- Native Markdown evidence files: `raw/<any-path>.md`.
- Non-Markdown original files from file inputs: `raw/<any-path>/<name>.<ext>`.
- Faithful Markdown extraction companions for non-Markdown originals: `raw/<any-path>/<name>.<ext>.md`.

**wiki/** — Compiled knowledge. Organized one level deep: `wiki/<topic>/<article>.md`. Contains two special files:
- `wiki/index.md` — Global index. One row per page, grouped by topic, with link + summary + Updated/Archived date.
- `wiki/log.md` — Append-only operation log.

**AGENTS.md** — Root agent-facing operating contract for this repository. Keep it short and high-signal: it should tell future agents that `raw/` and `wiki/` are managed wiki state, identify the key invariants, and point them back to this skill when available. Do not duplicate the full schema or templates there.

**SKILL.md** (this file) — Schema layer. Defines structure and workflow rules.

Templates live in `references/` relative to this file. Read them when you need the exact format for raw files, articles, archive pages, or the index.

### YAML Everywhere

Every Markdown file managed by this wiki uses YAML frontmatter.

Raw `.md` evidence files require:

```yaml
---
type: raw
source: <string-or-null>
collected: YYYY-MM-DD
published: YYYY-MM-DD|null
---
```

Normal wiki articles require:

```yaml
---
type: article
sources:
  - name: <author, organization, or publication>
    date: YYYY-MM-DD|null
raw:
  - raw/path/to/evidence.md
updated: YYYY-MM-DD
statuses: []
---
```

Archive pages require:

```yaml
---
type: archive
sources:
  - wiki/topic/article.md
archived: YYYY-MM-DD
---
```

Special files require:

```yaml
---
type: index
---
```

```yaml
---
type: log
---
```

Use block-style YAML lists. Paths in YAML are project-root-relative. Markdown links inside page bodies and See Also sections are relative to the current file.

### Initialization

Triggers only on the first Ingest. Check whether `raw/` and `wiki/` exist. Create only what is missing; never overwrite existing files:
- `raw/` directory (with `.gitkeep`)
- `wiki/` directory (with `.gitkeep`)
- `wiki/index.md` with `type: index` frontmatter and heading `# Knowledge Base Index`
- `wiki/log.md` with `type: log` frontmatter and heading `# Wiki Log`

Also create or update root `AGENTS.md` with the contract in `references/AGENTS.md`. If `AGENTS.md` already exists, preserve unrelated guidance and add or refresh only the managed LLM Wiki contract. Preserve any existing `Wiki Memory` section byte-for-byte unless the user asks to change it.

If Query or Lint cannot find the wiki structure, tell the user: "Run an ingest first to initialize the wiki." Do not auto-create.

## The Grounding Invariant

Every load-bearing fact in `wiki/` must be grounded in the evidence chain. Lint intentionally checks all YAML frontmatter and body content, even operational metadata, because this wiki treats the whole Markdown file as inspectable content.

Evidence sources differ by page type:
- `type: article` checks against the raw `.md` paths listed in its `raw` field. `raw: []` is schema-valid but reports no evidence.
- `type: archive` checks against the wiki pages listed in its `sources` field. `sources: []` is schema-valid but reports no evidence.
- `type: index` checks against all wiki pages, including itself.
- `type: log` checks against raw and wiki file contents and project-root-relative paths, including itself.

Compile establishes the invariant: locate numbers, dates, direct quotes, and important claims in evidence before writing. Lint verifies mechanically with `scripts/check_evidence.py`.

---

## Shopping Mode

Use shopping mode for buying-list, product-comparison, marketplace-listing, deal research, and purchase-decision repos.

When shopping mode triggers, read `references/shopping/rules.md`. For new or updated shopping articles, also read `references/shopping/article-template.md` and `references/shopping/raw-capture-checklist.md`. For shopping queries or archived answers, also read `references/shopping/query-output-template.md`.

Shopping mode keeps normal wiki page types. Each ranked candidate choice must have a dedicated 1-to-1 raw evidence file. Candidate comparison tables require: Rank, Choice, Price, Risk, Source, and one user-chosen extra column. The Source column links to the choice webpage first, then the raw file only when no webpage exists. If the extra column is not specified, ask the user at use-time.

---

## Ingest

Fetch a source into `raw/`, then compile it into `wiki/` unless the source adds nothing new. Always fetch; whether to compile depends on the triage below.

### Fetch (raw/)

1. Get the source content using whatever web or file tools your environment provides. If nothing can reach the source, ask the user to paste it directly.

2. Choose a descriptive path under `raw/`. There is no topic/date path convention. If the user gave a desired path, use it. Otherwise pick a clear descriptive filename/path. If a file with the same name already exists, append a numeric suffix before the final extension.

3. Store the raw evidence:
   - Native Markdown source files (`.md` only): save as `raw/<path>.md` with YAML frontmatter. Use `source: <URL>` for web pages or known external origins; use `source: null` for pasted/local Markdown with no external origin.
   - Ordinary web pages: save Markdown only, with `source: <page URL>`.
   - Non-Markdown file inputs: preserve the original file at `raw/<path>/<name>.<ext>` and create a faithful text extraction at `raw/<path>/<name>.<ext>.md` with `source: <name>.<ext>`. If faithful extraction is impossible, save the original, append an extraction-failed log entry, report the blocker, and stop; do not compile.
   - Text-like non-Markdown files (`.txt`, `.json`, `.csv`, `.html`, etc.) still use a companion `*.ext.md`; copy/convert the full meaningful text faithfully.

4. Raw `.md` body content is faithful source text only. Do not add an LLM summary, commentary, notes, or helper analysis. Do not add a title unless the source itself has one.

See `references/raw-template.md` for the exact format.

### Triage

After saving the raw `.md` evidence file and before editing `wiki/`, search `wiki/` with the source's key entities and synonyms, then state the disposition:
- **New** — creates one or more new articles.
- **Update** — merges into existing article(s).
- **Disputed** — contradicts existing content; may combine with New or Update.
- **No material** — adds no knowledge beyond what the wiki already holds. Keep the raw files, log it, and stop. Do not force an article out of a thin source.

New, Update, and Disputed may be combined. No material is exclusive.

### Compile (wiki/)

Determine where the new content belongs:
- **Same core thesis as existing article** → Merge into that article. Add the new source to `sources` and the raw `.md` evidence path to `raw`. Update affected sections.
- **New concept** → Create a new article in the most relevant topic directory. Name the file after the concept, not the raw file.
- **Spans multiple topics** → Place in the most relevant directory. Add See Also cross-references to related articles elsewhere.

Normal articles use `type: article`, `sources`, `raw`, `updated`, and `statuses`. The `raw` list contains project-root-relative paths to raw `.md` evidence files only, never direct non-Markdown originals. `statuses` is always present; use `statuses: []` when there are no statuses.

Status annotations live in article YAML, not body blockquotes. Add entries when a claim becomes outdated or disputed:

```yaml
statuses:
  - claim: <verbatim claim text from the article body>
    status: outdated
    date: YYYY-MM-DD
    note: <what changed and the current understanding, with source attribution>
  - claim: <verbatim claim text from the article body>
    status: disputed
    date: null
    note: <the competing claims, each with source attribution>
```

Each `claim` must appear verbatim in the article body. `status` values are exactly `outdated` or `disputed`. `date` is required for `outdated` and `null` for `disputed`.

**Source fidelity.** Every number, date, and direct quote must be located in evidence before it is written; write the value exactly as found. If the source says `42K`, write `42K`, not `42,000`. Derived values must show their components so each component is findable in evidence. If you cannot locate a value, do not write its exact form; drop it or state it without precision.

See `references/article-template.md` for article format.

### Cascade Updates

After the primary article, check for ripple effects. Do not rely on the index alone: search the full wiki for the source's key entities, aliases, and the claims it touches, then update every non-archive article whose content is materially affected. Each updated file gets its `updated` date refreshed.

When the new source supersedes or contradicts an existing claim, keep the old claim for the record and add a YAML status entry. Never silently rewrite history.

Archive pages are never cascade-updated; they are point-in-time snapshots.

### Post-Ingest

Update `wiki/index.md`: add or update entries for every touched article/archive. When adding a new topic section, include a one-line description. The Updated date reflects when the page's knowledge content last changed, not the file system timestamp. See `references/index-template.md`.

Append to `wiki/log.md` using project-root-relative paths:

```markdown
## [YYYY-MM-DD] ingest | <primary article title>
- Disposition: <New; Update; Disputed>
- Raw: raw/path/evidence.md
- Original: raw/path/original.ext
- Updated: <cascade-updated article title>
```

Omit `- Original:` when there is no non-Markdown original. Omit `- Updated:` lines when no cascade updates occur.

For No material, key the heading by the raw `.md` evidence path and list any original separately:

```markdown
## [YYYY-MM-DD] ingest | no material: raw/path/evidence.md
- Disposition: No material
- Original: raw/path/original.ext
```

For an extraction failure:

```markdown
## [YYYY-MM-DD] ingest | extraction failed: raw/path/original.ext
- Disposition: Extraction failed
```

### Research (multi-source ingest)

Use only when the user explicitly asks to research a topic or gather sources into the wiki. Ordinary knowledge questions go to Query, which never writes files.

1. Split the topic into a few angles. For each, search with a wide net: official names, abbreviations, and synonyms.
2. For any core claim you expect to conclude, deliberately search the opposing side: failures, criticism, failed replications.
3. Save selected sources to `raw/` as usual. Searching may run in parallel; compilation must not, because index, log, and cascade updates are shared state.

---

## Query

Search the wiki and answer questions. Examples:
- "What do I know about X?"
- "Summarize everything related to Y"
- "Compare A and B based on my wiki"

### Steps

1. Read `wiki/index.md` to locate candidate pages, then full-text search `wiki/` with the topic's key terms and synonyms. Never claim the wiki has no relevant content until both the index and full-text search come back empty; say that you searched.
2. Read the pages you found and synthesize an answer.
3. Prefer wiki content over your own training knowledge. Cite sources with markdown links: `[Article Title](wiki/topic/article.md)`.
4. Output the answer in the conversation. Do not write files unless asked.

### Archiving

When the user explicitly asks to archive or save the answer to the wiki:
1. Write the answer as a new `type: archive` wiki page. See `references/archive-template.md`.
   - `sources` is a YAML list of project-root-relative wiki page paths cited in the answer.
   - No `raw` field; archive content is grounded through cited wiki pages.
   - File name reflects the query topic, e.g. `transformer-architectures-overview.md`.
   - Place in the most relevant topic directory.
2. Always create a new page. Never merge into existing articles.
3. Update `wiki/index.md`. Prefix the Summary with `[Archived]`.
4. Append to `wiki/log.md`:
   ```markdown
   ## [YYYY-MM-DD] query | Archived: <page title>
   ```

---

## Lint

Quality checks on the wiki. Three categories have different authority levels.

### Safe Fixes (auto-fix)

Fix these automatically:

**AGENTS.md wiki section** — ensure root `AGENTS.md` exists and contains the LLM Wiki contract from `references/AGENTS.md`. If it exists, update only the managed LLM Wiki contract; preserve unrelated repository guidance and preserve `Wiki Memory` byte-for-byte. Do not create tool-specific instruction files.

**Index consistency** — compare `wiki/index.md` against actual wiki pages (excluding index.md and log.md):
- File exists but missing from index → add entry with `(no summary)` placeholder. Use `updated` for articles and `archived` for archives; otherwise fall back to file modified date.
- Index entry points to nonexistent file → mark as `[MISSING]` in the index. Do not delete the entry.
- Index entry's date differs from the page metadata → update the index entry to match.

**Internal links** — for every Markdown link in wiki page bodies and `sources` metadata rendered as links, excluding index.md/log.md:
- Target does not exist → search wiki/ for a file with the same name elsewhere.
- Exactly one match → fix the path.
- Zero or multiple matches → report to the user.

**Raw references** — every path in an article `raw` list must point to an existing raw `.md` file:
- Target does not exist → search raw/ for a file with the same name elsewhere.
- Exactly one match → fix the path.
- Zero or multiple matches → report to the user.

**See Also** — within each topic directory:
- Target of a See Also link does not exist → search wiki/ for a file with the same name elsewhere.
- Exactly one match → fix the path.
- Zero matches → remove the link.
- Multiple matches → report to the user.

### Mechanical Reports (no fixes)

Run these mechanically with `python3 <skill-dir>/scripts/check_evidence.py <project-root>` (optionally followed by project-root-relative page paths to limit scope). Report findings; never auto-fix facts.

**Source fidelity** — reported suspects are candidates, not verdicts. With this wiki's "check all" rule, operational metadata can appear as suspects too.

**Evidence errors** — pages the script cannot verify cleanly: unresolvable paths, raw paths that escape `raw/`, archive source paths that escape `wiki/`, invalid or missing frontmatter, status claims that do not appear verbatim in the body, article `raw: []`, archive `sources: []`, and unpaired non-Markdown originals/extractions.

**Inventory** — raw material not connected to the wiki:
- raw `.md` evidence files not referenced by any article and not logged as No material or Extraction failed.
- non-Markdown originals not covered by a referenced `*.ext.md` extraction.

### Judgment Reports (no fixes)

Report findings without auto-fixing:
- Factual contradictions across articles
- Outdated claims superseded by newer sources but missing YAML status entries
- Missing conflict annotations where sources disagree
- Obviously missing cross-references between related articles
- Malformed status entries
- Orphan pages with no inbound links from other wiki articles
- Missing cross-topic references
- Concepts frequently mentioned but lacking a dedicated page
- Archive pages whose cited source articles have been substantially updated since archival

### Post-Lint

Append to `wiki/log.md`:

```markdown
## [YYYY-MM-DD] lint | <N> issues found, <M> auto-fixed
```

---

## Conventions

- Standard Markdown with YAML frontmatter.
- `raw/` paths are arbitrary; choose descriptive paths when the user does not specify one.
- `wiki/` supports one level of topic subdirectories only. No deeper nesting.
- Root `AGENTS.md` carries the managed LLM Wiki contract and its `Wiki Memory` section; the complete schema stays in this skill and its references.
- Today's date is used for `collected`, `updated`, `archived`, and log entries. `published` comes from the source; use `null` when unavailable.
- YAML path fields are project-root-relative.
- Markdown body links are relative to the current file.
- First ingest initializes `AGENTS.md` if needed. Routine ingest updates `wiki/index.md` and `wiki/log.md`; No material updates only the log. Archive updates the index and log. Lint updates the managed `AGENTS.md` contract and `wiki/log.md`, preserves `Wiki Memory`, and may update `wiki/index.md` when auto-fixing index entries. Plain queries do not write files.
