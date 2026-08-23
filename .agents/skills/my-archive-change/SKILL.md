---
name: my-archive-change
description: "Archive a completed docs/change proposal by syncing delta specs into docs/spec and moving the change into docs/change/archive. Use when the user asks to archive, finalize, close out, sync specs, or complete a my-* change. Replaces OpenSpec archive/sync without requiring the OpenSpec CLI."
sources:
  - "https://github.com/Fission-AI/OpenSpec/tree/main"
  - "https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/concepts.md"
  - "https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/workflows.md"
---

# My Archive Change

Finalize a change by merging its delta specs into main specs and preserving the full change folder under `docs/change/archive/`.

Do not use the `openspec` CLI, `openspec/` directories, stores, schemas, generated instructions, or `.openspec.yaml`.

## Paths

Active change:

```text
docs/change/<change-name>/
```

Delta specs:

```text
docs/change/<change-name>/spec/<capability>.md
```

Main specs:

```text
docs/spec/<capability>.md
```

Archive target:

```text
docs/change/archive/YYYY-MM-DD-<change-name>/
```

If `<change-name>` already starts with `YYYY-MM-DD-`, keep it as-is when archiving; do not stack a second date prefix.

## Change Selection

If the user gives a change name, use it. Otherwise:

- Infer from conversation context only when unambiguous.
- If exactly one active change exists under `docs/change/` excluding `archive/`, use it and say so.
- If multiple active changes exist, ask the user to choose.

## Pre-Archive Checks

Read the full change folder and check:

- Required artifacts exist: `proposal.md`, `spec/`, `design.md`, `tasks.md`.
- Every task checkbox in `tasks.md` is complete, or incomplete tasks are explicitly accepted by the user.
- Delta specs exist under `spec/`.
- Matching main specs under `docs/spec/` are read before merging.

Warn before archiving if artifacts or tasks are incomplete. Do not let warnings silently pass; get explicit user confirmation for incomplete work.

## Sync Delta Specs

Apply each delta spec to its matching main spec intelligently. Do not copy the delta file wholesale.

### Main Spec Format

```markdown
# <Capability> Specification

## Purpose
<What this capability does and why it exists.>

## Requirements

### Requirement: <Behavior>
The system SHALL <observable behavior>.

#### Scenario: <Scenario name>
- GIVEN <starting condition>
- WHEN <event or action>
- THEN <observable result>
```

### Merge Rules

- `## Purpose`: when creating a new main spec, seed its Purpose from the delta. When the main spec already has a Purpose, preserve the main spec Purpose unless the delta explicitly says to change it.
- `## ADDED Requirements`: add requirements that do not exist. If a requirement already exists, treat it as a modification and reconcile content.
- `## MODIFIED Requirements`: update only the named requirements or scenarios. Preserve main-spec content not mentioned by the delta.
- `## REMOVED Requirements`: remove the named requirement blocks from the main spec.
- `## RENAMED Requirements`: rename the requirement heading and preserve its content unless the delta also modifies it.

The operation should be idempotent: archiving should not duplicate requirements if the same sync is run twice.

## Conflict Handling

If multiple active changes touch the same `docs/spec/<capability>.md`, inspect the other delta specs before syncing. If order matters or the deltas conflict, ask the user whether to proceed, archive in a specific order, or stop.

If a delta is ambiguous enough that merging would invent behavior, stop and ask. The main specs become the source of truth after archive, so they must be honest.

## Move To Archive

After specs are synced successfully:

1. Create `docs/change/archive/` if needed.
2. Compute the target name with today's date, unless already date-prefixed.
3. If the target already exists, stop and report the collision.
4. Move the whole change folder into the archive target.

Do not archive if spec sync failed or verification found unresolved critical issues that the user has not explicitly accepted.

## Final Response

Report:

- Change archived and archive path.
- Main specs updated.
- Requirements added, modified, removed, or renamed.
- Any warnings accepted by the user.
- Any verification not run before archive.
