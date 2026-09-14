# Commit Messages

## Tutor Matcher Format

Use this exact header format in this repository:

```text
<type>[<EPIC>-N]: slug
```

`<EPIC>` is an uppercase registered backlog acronym and `N` is a numeric story number.
`<type>` is one of `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `revert`,
`style`, or `test`, and `slug` is lowercase kebab-case. Do not add another scope. The epic-story
ID must match the issue, branch, and PR. Use `OPS-0` for non-story work and `<EPIC>-0` for a story
without a backlog entry. Keep the body and trailer format from Conventional Commits below when
more context is needed.

Examples:

```text
feat[AUTH-1]: create-student-account
feat[DISC-1]: search-tutors
```

Non-story example:

```text
chore[OPS-0]: update-ci-configuration
```

For a breaking change, keep the required header and add a `BREAKING CHANGE:` footer. Reference
the epic-story with `Refs: <EPIC>-N` when the commit needs a trailer.

Use official Conventional Commits v1.0.0 as the baseline.

## Generic Format

```text
<type>[optional scope][optional !]: <description>

[optional body]

[optional footer(s)]
```

Descriptions should be imperative, lowercase, and should not end with a period.

## SemVer Types

- `feat` adds a feature and maps to a minor release by default.
- `fix` fixes a bug and maps to a patch release by default.
- Any type with `!` or a `BREAKING CHANGE:` footer maps to a major release by default.

## Common Extension Types

These are allowed but do not imply SemVer impact unless breaking:

- `build`
- `chore`
- `ci`
- `docs`
- `style`
- `refactor`
- `perf`
- `test`
- `revert`

## Scope

Use a scope only when a clear codebase section exists, e.g. `fix(parser): handle empty input`. Omit
scope rather than inventing a noisy one. Tutor Matcher is the explicit exception: `[<EPIC>-N]` or
`[OPS-0]` is required as the scope.

Do not use any scope other than `[<EPIC>-N]` or `[OPS-0]` in Tutor Matcher.

## Breaking Changes

Use both the bang and footer by default:

```text
feat(api)!: remove legacy token endpoint

BREAKING CHANGE: clients must use the OAuth token endpoint instead.
```

If the repo uses only one marker, follow the repo convention.

## Bodies

Include a body when the header does not explain motivation, risk, migration, or behavior contrast clearly enough.

Good body content explains why the change exists and what changed from the previous behavior. Avoid repeating the header.

## Footers

Use trailer-style footers.

- `Refs: <EPIC>-N` for epic-story references in Tutor Matcher; use `Refs: OPS-0` for non-story
  work; use `Refs: ABC-123` outside this repository.
- `Closes:` or `Fixes:` only when the commit intentionally closes an issue in the target platform.
- `Assisted by: <agent> (<model name>)` when there is no PR and the commit is the durable artifact for agent-touched work.

## Reverts

Use `revert:` and reference reverted SHA(s):

```text
revert: restore legacy parser behavior

Refs: 676104e, a215868
```

## Initial Commit

Use:

```text
chore: init
```

## Classification Guidance

- Prefer intent and durable user-facing meaning over file paths.
- If support files such as tests or docs are part of a product feature or bug fix, decide based on the actual change intent.
- Split unrelated changes into separate commits whenever feasible.
- If one commit still contains multiple related aspects, choose the type that best represents the durable outcome.
