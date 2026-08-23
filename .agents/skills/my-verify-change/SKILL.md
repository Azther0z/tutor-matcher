---
name: my-verify-change
description: "Verify that implementation matches a docs/change proposal and its specs. Use before archiving, when the user asks to verify, review implementation against a change, check completeness/correctness/coherence, or validate that code matches docs/change artifacts. Replaces OpenSpec verify without requiring the OpenSpec CLI."
sources:
  - "https://github.com/Fission-AI/OpenSpec/tree/main"
  - "https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/workflows.md"
  - "https://raw.githubusercontent.com/addyosmani/agent-skills/main/skills/spec-driven-development/SKILL.md"
---

# My Verify Change

Validate that the current implementation matches a change under `docs/change/<change-name>/` before archive.

Do not use the `openspec` CLI, `openspec/` directories, stores, schemas, generated instructions, or `.openspec.yaml`.

## Inputs And Paths

Active change:

```text
docs/change/<change-name>/
```

Required artifacts:

- `proposal.md`
- `spec/<capability>.md` delta specs
- `design.md`
- `tasks.md`

Main specs:

```text
docs/spec/<capability>.md
```

If the user does not name a change, infer it only when unambiguous; otherwise ask them to choose from active directories under `docs/change/` excluding `archive/`.

## Verification Process

1. Read the change artifacts and matching main specs.
2. Inspect relevant implementation and test files.
3. Check three dimensions: completeness, correctness, and coherence.
4. Run relevant tests, lint, typecheck, or build commands when feasible and proportionate.
5. Produce a findings-first report. Do not edit code or artifacts unless the user explicitly asks for fixes.

## Completeness

Check:

- Every required artifact exists.
- Every task in `tasks.md` is checked or intentionally deferred.
- Every checked task's `Acceptance` condition is satisfied when task metadata is present.
- Every checked task's `Verify` command or manual check has evidence, or a clear reason it could not be run.
- Every delta spec requirement has implementation evidence or an explicit reason it is not code-backed.
- Every behavior scenario has test coverage or a credible manual verification path.

Treat unchecked implementation tasks and missing required behavior as critical issues.

## Correctness

Check:

- Implementation behavior matches `ADDED`, `MODIFIED`, `REMOVED`, and `RENAMED` requirements.
- Edge cases in scenarios are handled.
- Removed behavior is actually removed or blocked.
- Renamed concepts do not leave stale user-visible names where they matter.
- Tests assert the intended behavior rather than merely exercising code paths.

Use code references like `src/file.ts:123` when available.

## Coherence

Check:

- Code follows the major decisions in `design.md`.
- The proposal, specs, design, tasks, and implementation do not contradict each other.
- The implementation fits existing repo patterns.
- Main specs would make sense after archive.

Do not nitpick style unless it creates maintainability or behavior risk.

## Severity

- `CRITICAL`: must fix before archive; missing implementation, incomplete tasks, broken tests, spec contradiction that would archive false behavior.
- `WARNING`: should fix or explicitly accept; missing scenario tests, design drift, unclear requirement mapping.
- `SUGGESTION`: optional improvement; naming, small cleanup, extra tests.

Prefer lower severity when evidence is uncertain, but explain what evidence is missing.

## Report Format

```markdown
## Verification Report: <change-name>

### Summary
| Dimension | Status |
|---|---|
| Completeness | <status> |
| Correctness | <status> |
| Coherence | <status> |

### Findings
1. [CRITICAL] <issue>
   Evidence: `<file>:<line>` or artifact reference.
   Recommendation: <specific next action>.

### Verification Run
- `<command>`: <result>

### Final Assessment
<Ready to archive / not ready / ready with warnings.>
```

If there are no findings, state that clearly and list any residual risks or checks not run.
