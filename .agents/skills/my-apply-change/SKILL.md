---
name: my-apply-change
description: "Implement tasks from a plain docs/change proposal in the user's my-* workflow. Use when the user asks to apply, implement, continue implementation, work through tasks, or make code match a named change under docs/change. Replaces OpenSpec apply without requiring the OpenSpec CLI."
sources:
  - "https://github.com/Fission-AI/OpenSpec/tree/main"
  - "https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/workflows.md"
  - "https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/editing-changes.md"
  - "https://raw.githubusercontent.com/addyosmani/agent-skills/main/skills/spec-driven-development/SKILL.md"
---

# My Apply Change

Implement a change from `docs/change/<change-name>/` by reading its live Markdown artifacts and working through `tasks.md`.

Do not use the `openspec` CLI, `openspec/` directories, stores, schemas, generated instructions, or `.openspec.yaml`.

## Paths

Active change:

```text
docs/change/<change-name>/
├── proposal.md
├── spec/
│   └── <capability>.md
├── design.md
└── tasks.md
```

Main specs for context:

```text
docs/spec/<capability>.md
```

## Change Selection

If the user gives a change name, use it. Otherwise:

- Infer from conversation context only when unambiguous.
- If exactly one active change exists under `docs/change/` excluding `archive/`, use it and say so.
- If multiple active changes exist, ask the user to choose.

Never implement from an archived change unless the user explicitly asks to resurrect or inspect it.

## Preflight

Before editing code:

1. Read all required artifacts in the change folder.
2. Read every delta spec under `docs/change/<change>/spec/`.
3. Read matching main specs under `docs/spec/<capability>.md` when they exist.
4. Inspect the relevant implementation and test files mentioned by the artifacts or discovered from the repo.
5. Identify unchecked tasks in `tasks.md`.
6. Extract each task's `Acceptance`, `Verify`, and `Files` lines when present.

If any required artifact is missing, stop and ask whether to create or repair the planning artifacts first. The four required artifacts are `proposal.md`, `spec/`, `design.md`, and `tasks.md`.

## Implementation Loop

Work task by task until all tasks are done or you hit a real blocker.

For each unchecked task:

1. Announce the task briefly.
2. Use its `Files` line as a starting point, then inspect the repo to confirm the real edit surface.
3. Make the minimal code changes required.
4. Check the task's `Acceptance` condition against the result.
5. Run the task's `Verify` command or manual check when feasible. If it cannot be run, record why.
6. Mark the task complete by changing `- [ ]` to `- [x]` only after the acceptance condition is met and verification has passed or has a documented reason for being skipped.
7. Continue to the next unchecked task.

Use the repo's existing style and tooling. Do not introduce broad refactors unless the task explicitly calls for them.

## Fluid Plan Updates

Artifacts are the live plan. If implementation proves an artifact stale:

- If the code should follow the artifact, fix the code.
- If the artifact is wrong and the discovered implementation direction is clearly better, update the artifact before continuing.
- For material changes in intent, scope, behavior, or design, summarize the proposed artifact edit and ask before writing it.
- For small task-list corrections discovered during implementation, edit `tasks.md` directly and report it.

Keep artifact updates in the same change folder. Do not create new change folders from apply unless the user asks.

## Stop Conditions

Pause and ask when:

- A task is ambiguous enough that guessing would create wrong behavior.
- The implementation would change the proposal's core intent.
- You discover a risky migration, destructive operation, secret, credential, or production-impacting change not covered by the plan.
- Verification repeatedly fails for a reason that needs a product or design decision.

## Final Response

Report:

- Change name and path.
- Tasks completed this session.
- Verification run and results, including any task-level `Verify` checks skipped with reasons.
- Remaining unchecked tasks, if any.
- Artifact updates made, if any.
- If all tasks are complete, recommend `my-verify-change <change-name>` before archiving.
