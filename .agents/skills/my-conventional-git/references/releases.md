# Releases

Use Conventional Commits release semantics unless repo tooling says otherwise.

## Version Bumps

Infer the next stable version from commits since the last release tag:

- Breaking change: major.
- `feat`: minor.
- `fix`: patch.
- Other types: no SemVer bump by default unless repo tooling configures one.

If the user explicitly provides a version, respect it.

## Tags

Use `vX.Y.Z` by default:

```text
v1.2.0
```

If existing tags use another format, follow the repo convention.

## Release Branches

Use `release/vX.Y.Z` by default, matching the tag version:

```text
release/v1.2.0
```

## Prereleases

Handle prerelease tags or branches only when repo tooling or existing history indicates a convention. Do not invent alpha, beta, or rc rules by default.

## Changelog Defaults

Include by default:

- Breaking changes.
- `feat` commits.
- `fix` commits.

Include extension types such as `perf`, `docs`, or `chore` only when they are important to users or the repo release tooling includes them.

## Release Prep Workflow

1. Inspect latest tag and release tooling.
2. Review commits since the latest tag.
3. Determine highest SemVer impact.
4. Propose or create the release branch/tag only if asked.
5. Do not push tags or branches unless explicitly asked.
