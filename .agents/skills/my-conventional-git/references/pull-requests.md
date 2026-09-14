# Pull Requests

PRs should remain useful whether the repo squash-merges, rebases, or uses merge commits.

## Tutor Matcher Title

Use this exact title format in this repository:

```text
<type>[<EPIC>-N]: slug
```

The epic-story ID must match the PR branch and every contributor commit in the PR. Use `OPS-0` for
non-story work and `<EPIC>-0` for a story without a backlog entry. Use the same
commit types and lowercase kebab-case slug grammar documented in
[`commit-messages.md`](commit-messages.md).

Examples:

```text
feat[AUTH-1]: create-student-account
feat[DISC-1]: search-tutors
```

Non-story example:

```text
chore[OPS-0]: update-ci-configuration
```

The body starter is `.github/pull_request_template.md`. Its work-item, acceptance-criteria,
verification, risk, and naming checklist should be completed before review.

## Generic Title

Use Conventional Commit format:

```text
<type>[optional scope][optional !]: <description>
```

Use the same description style as commits: imperative, lowercase, no period.

When a PR contains multiple commits, title the PR by the durable outcome rather than listing every internal step.

## Body

The default structure below remains the baseline outside Tutor Matcher. In this repository, use
`.github/pull_request_template.md` so the work-item context and verification evidence are captured.

```markdown
## Summary
- ...

## Verification
- ...

Refs: ABC-123
Assisted by: <agent> (<model name>)
```

Use concise bullets. Add or remove sections to match existing repo templates.

## Footers

- `Refs: <EPIC>-N` for epic-story references in Tutor Matcher; use `Refs: OPS-0` for non-story
  work; use `Refs: ABC-123` outside this repository.
- `Closes:` or `Fixes:` only when the PR should auto-close an issue.
- `BREAKING CHANGE:` when the PR introduces a breaking change.
- `Assisted by: <agent> (<model name>)` for every agent touch.

## Breaking PRs

Use `!` in the title and add a `BREAKING CHANGE:` footer in the PR body:

```text
feat(api)!: require signed webhook payloads
```

```text
BREAKING CHANGE: webhook consumers must verify the new signature header.
```

## Mixed Changes

If a PR would combine unrelated changes, split it when feasible. If the changes are related, pick the PR title that describes the durable outcome.
