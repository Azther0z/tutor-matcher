---
name: my-explore-and-propose-spec
description: "Explore an idea and/or create a plain-Markdown change proposal with required spec artifacts. Use when the user wants to think through a change, propose a feature or fix, create a spec-driven plan, start a docs/change workflow, or replace OpenSpec-style planning without the OpenSpec CLI. This is the default entry point for new work in the user's my-* change workflow."
sources:
  - "https://github.com/Fission-AI/OpenSpec/tree/main"
  - "https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/concepts.md"
  - "https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/opsx.md"
  - "https://raw.githubusercontent.com/addyosmani/agent-skills/main/skills/spec-driven-development/SKILL.md"
---

# My Explore And Propose Spec

Think through an idea, then capture it as plain Markdown when it is ready. Preserve the useful OpenSpec artifact contract while removing OpenSpec-specific machinery.

Do not use the `openspec` CLI, `openspec/` directories, stores, schemas, generated instructions, or `.openspec.yaml`. This workflow owns only `docs/change/` and `docs/spec/`.

## Paths

Active changes live at:

```text
docs/change/<change-name>/
```

Required artifacts for every proposed change:

```text
docs/change/<change-name>/
├── proposal.md
├── spec/
│   └── <capability>.md
├── design.md
└── tasks.md
```

Main specs live at:

```text
docs/spec/<capability>.md
```

Archived changes later move to:

```text
docs/change/archive/YYYY-MM-DD-<change-name>/
```

Use `spec/` singular to align with the user's `docs/spec/...` preference. A change's files under `docs/change/<change>/spec/` are delta specs; files under `docs/spec/` are main specs.

## Modes

### Explore Mode

Use this when the user is not ready to write artifacts, asks to explore, asks for options, or brings an unclear problem.

- Read the relevant code and docs before forming conclusions.
- Ask useful questions only after inspecting facts you can discover yourself.
- Compare options, identify risks, and recommend a path when the evidence supports it.
- Do not write files or code unless the user asks to propose or capture the plan.
- When the idea crystallizes, offer to create a proposed change under `docs/change/<change-name>/`.

### Propose Mode

Use this when the user asks to propose, spec, plan, start a change, or already gives a clear implementation goal.

1. Derive a kebab-case `<change-name>` from the user's request unless they provide one.
2. Inspect the repo for relevant code, existing docs, and existing `docs/spec/` main specs.
3. Create the required artifact set under `docs/change/<change-name>/`.
4. Keep artifacts concise and behavior-focused. Do not copy huge code summaries into them.
5. If a target change already exists, update it only when the user is clearly continuing the same work; otherwise ask before overwriting or creating a similarly named change.

## Artifact Templates

### `proposal.md`

```markdown
# Proposal: <Title>

## Intent

<What problem this solves and why it matters.>

## Scope

In scope:
- <Included behavior or work>

Out of scope:
- <Explicit non-goals>

## Approach

<High-level direction, not implementation minutiae.>

## Affected Specs

- `<capability>`: <added | modified | removed | renamed behavior summary>

## Impact

- `<path-or-area>`: <expected impact>
```

### `spec/<capability>.md`

Delta specs describe what changes relative to `docs/spec/<capability>.md`. They are not full copies of the main spec.

```markdown
# <Capability> Delta Spec

## Purpose

<Only include when creating a brand-new capability or materially changing the capability's purpose.>

## ADDED Requirements

### Requirement: <New behavior>
The system SHALL <observable behavior>.

#### Scenario: <Scenario name>
- GIVEN <starting condition>
- WHEN <event or action>
- THEN <observable result>

## MODIFIED Requirements

### Requirement: <Existing behavior>
<Only the changed requirement text or changed/new scenarios. Preserve unchanged main-spec content during archive.>

## REMOVED Requirements

### Requirement: <Deprecated behavior>
<Reason it is being removed.>

## RENAMED Requirements

- FROM: `### Requirement: <Old name>`
- TO: `### Requirement: <New name>`
```

Include only sections that apply, except that every change must have at least one delta spec file under `spec/`. A pure refactor still needs a spec delta explaining the externally observable behavior that must remain unchanged, or explicitly stating the preservation requirement.

### `design.md`

```markdown
# Design: <Title>

## Context

<Current state and constraints discovered from the repo.>

## Decisions

### Decision: <Name>
<Decision, rationale, and rejected alternatives when useful.>

## Implementation Notes

- `<path-or-component>`: <expected change>

## Verification Commands

- Build: `<full command, or N/A with reason>`
- Test: `<full command, or N/A with reason>`
- Lint: `<full command, or N/A with reason>`
- Typecheck: `<full command, or N/A with reason>`

## Risks

- <Risk and mitigation>
```

### `tasks.md`

```markdown
# Tasks

## 1. <Work Area>
- [ ] 1.1 <Concrete implementation task>
  - Acceptance: <What must be true when this task is complete>
  - Verify: <Specific command or manual check>
  - Files: <Expected files or areas touched>
- [ ] 1.2 <Concrete implementation task>
  - Acceptance: <What must be true when this task is complete>
  - Verify: <Specific command or manual check>
  - Files: <Expected files or areas touched>

## 2. Verify
- [ ] 2.1 <Test, typecheck, lint, manual verification, or review step>
  - Acceptance: <What must be true when verification is complete>
  - Verify: <Specific command or manual check>
  - Files: <Expected files or areas touched>
```

Tasks must be actionable, ordered, and small enough that `my-apply-change` can work through them one at a time. Each implementation task should include `Acceptance`, `Verify`, and `Files` lines so apply and verify can prove completion instead of relying on the checkbox alone.

## Quality Bar

- Specs describe observable behavior, not private implementation details.
- Design explains how the code should change and why.
- Tasks are an implementation checklist, not a second design document.
- Artifacts may evolve during implementation; they are the live plan, not a frozen phase gate.
- Prefer one focused change over a broad change that mixes unrelated intent.

## Final Response

After creating artifacts, report:

- Change path.
- Required artifacts created.
- Main specs consulted or missing.
- Key assumptions and open questions.
- Next step: use `my-apply-change <change-name>` when ready to implement.
