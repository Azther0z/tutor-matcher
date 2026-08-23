# Branch Names

Use purpose-first branch names based on Conventional Branch, with this skill's narrower defaults.

## Default Prefixes

- `feat/` for feature work.
- `fix/` for bug fixes.
- `hotfix/` for urgent production fixes.
- `release/` for release preparation branches.
- `chore/` for maintenance work that is not better described by the above.

Do not default to AI-agent prefixes such as `ai/`, `codex/`, `claude/`, `copilot/`, or `cursor/`. Record AI involvement in PR or commit footers instead.

## Slug Grammar

Use:

- Lowercase letters, numbers, hyphens, and dots for normal slug text.
- No spaces or underscores.
- No consecutive separators.
- No leading or trailing hyphens or dots.
- Dots mainly for version-like text.

Ticket ID exception: preserve tracker casing when a ticket appears in the slug, e.g. `feat/ABC-123-add-login`. Keep the rest of the slug lowercase.

## Ticket Placement

When a ticket is known, put it immediately after the prefix:

```text
feat/ABC-123-add-login
fix/JIRA-77-handle-expired-token
```

Also preserve the canonical ticket ID in PR or commit footers, usually with `Refs:`.

## Release Branches

Use:

```text
release/v1.2.0
```

For prereleases, follow existing repo convention or release tooling. Do not invent prerelease branch rules by default.

## Examples

```text
feat/add-login-page
feat/ABC-123-add-login-page
fix/header-overflow
hotfix/security-patch
release/v1.2.0
chore/update-dependencies
```
