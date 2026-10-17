# Proposal: Address DISC-3 Review Feedback

## Intent

Address the five review comments from `piranatw` on PR #202 while preserving Nesta1223's public tutor-profile feature and its existing API contract.

## Scope

In scope: read-only profile loading; bounded availability transfer; Unicode-safe reviewer initials; consistent two-decimal rates; deferred and restricted introduction media.

Out of scope: booking cleanup changes, schema or data changes, DevOps configuration, unrelated stories, and rewriting existing commits.

## Approach

Remove expired-hold cleanup from this public read. Return detailed openings for 14 days and compute each subject's next opening within the existing 92-day horizon in a grouped SQL query. Keep held slots conservatively unavailable until the existing booking flow releases them. Share rate formatting. Defer iframe/video loading and open insecure file URLs as links rather than embedding them.

## Affected Specs

- `tutor-profile`: modified public-load, availability, display, and media requirements. No main `docs/spec/` exists on the starting branch.

## Impact

- Discovery service and tests.
- Tutor profile page, media URL helper, and page tests.
- Relevant testing documentation and this review-fix plan.
