# Pull Requests

PRs should remain useful whether the repo squash-merges, rebases, or uses merge commits.

## Title

Use Conventional Commit format:

```text
<type>[optional scope][optional !]: <description>
```

Use the same description style as commits: imperative, lowercase, no period.

When a PR contains multiple commits, title the PR by the durable outcome rather than listing every internal step.

## Body

Default structure:

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

- `Refs: ABC-123` by default for issue or ticket references.
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
