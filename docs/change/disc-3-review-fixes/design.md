# Design: DISC-3 Review Fixes

## Context

PR #202 starts at `99f688a`. Five inline review comments identify unguarded cleanup transactions, 92-day slot transfer, broken Unicode initials, inconsistent prices, and eager/unrestricted introduction media. The original contributor's commit remains unchanged.

## Decisions

- Remove cleanup from this public route entirely rather than swallowing write errors. Existing authenticated booking operations retain cleanup responsibility.
- Restrict `availability.findMany` to 14 days and use a parameterized `MIN(started_at) GROUP BY subject_id` query for next openings over 92 days. No schema change or slot mutations.
- Use `Array.from(lastName)[0]` and conditional punctuation.
- Use one two-decimal formatter for both rate displays.
- Add iframe `loading="lazy"`, sandbox permissions limited to scripts/same-origin/presentation, and `strict-origin-when-cross-origin`. Sending the embedding origin preserves video-provider compatibility without disclosing the full page URL.
- Use video `preload="none"` without autoplay. HTTP file URLs are external links, never embedded media.

## Verification Commands

- Tests: `npm.cmd --prefix apps/backend test -- --runInBand`; `npm.cmd --prefix apps/frontend test -- --runInBand`
- Build/typecheck: `npm.cmd --prefix apps/backend run build`; `npm.cmd --prefix apps/frontend run build`
- Lint: `npm.cmd --prefix apps/backend run lint`; `npm.cmd --prefix apps/frontend run lint`
- Formatting: staged-file checks and full formatting of LF Git contents if the Windows checkout flags baseline CRLF files.
- Database: read-only profile query against existing local fixtures; no schema synchronization or fixture writes.

## Risks

- Expired holds can briefly remain hidden until existing booking cleanup runs. This is a deliberate conservative read-only behavior.
- Playback of third-party media still depends on provider/browser policy; tests verify URL classification and restrictions, not real network playback.
