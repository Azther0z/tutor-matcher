---
name: my-init-spec
description: "Backfill plain Markdown main specs for behavior that is already implemented. Use when the user asks to initialize specs, backfill specs, document existing behavior, bootstrap docs/spec, migrate an existing project into the my-* spec workflow, or create source-of-truth specs after implementation already exists. This skill writes docs/spec files, not docs/change proposals."
sources:
  - "https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/existing-projects.md"
  - "https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/concepts.md"
---

# My Init Spec

Backfill main specs from an existing implementation. This is for brownfield projects where behavior already exists and the user wants `docs/spec/` to become the source of truth going forward.

Do not use the `openspec` CLI, `openspec/` directories, stores, schemas, generated instructions, or `.openspec.yaml`. This workflow writes only `docs/spec/` unless the user explicitly asks for related change artifacts.

## Core Principle

Backfill what is worth trusting. Do not invent a complete product spec from a quick code skim.

Prefer a focused, evidence-backed spec for one domain over a broad, shallow spec for the whole codebase. Existing code, tests, routes, schemas, UI behavior, public docs, and configuration are evidence; model guesses are not.

## Output Path

Main specs live at:

```text
docs/spec/<capability>.md
```

Use capability names that match how the project thinks about behavior: `auth`, `billing`, `search`, `api`, `admin-users`, `notifications`, or similar. Prefer stable product/domain names over implementation-only names.

## When To Use

Use this when:

- The implementation already exists before the spec workflow was introduced.
- The user wants to initialize or backfill `docs/spec/`.
- The user wants current behavior documented before future changes are proposed.
- A domain is about to receive changes and needs a reliable baseline spec first.

Do not use this for new behavior. New or changed behavior belongs in `docs/change/<change-name>/` via `my-explore-and-propose-spec`.

## Scope Control

Avoid boiling the ocean. If the user asks to backfill the whole project, first produce a capability map and recommend a small first batch.

Good first batches:

- One user-facing feature area.
- One API surface.
- One package or service in a monorepo.
- One domain that is about to change.

Ask for scope only when it cannot be inferred. If the user names a domain, proceed with that domain.

## Workflow

### 1. Discover Evidence

Inspect relevant sources before writing:

- Existing `docs/spec/` files, if any.
- README, product docs, API docs, ADRs, and other human docs.
- Routes, controllers, handlers, UI screens, commands, jobs, schemas, migrations, config, and public interfaces.
- Tests that encode expected behavior.
- Recent code organization and naming conventions.

Keep notes internally about evidence paths. Specs should cite evidence sparingly only when useful; they should not become code tours.

### 2. Build A Capability Map

For broad or ambiguous requests, show a short map before writing many files:

```markdown
## Proposed Spec Backfill Scope

| Capability | Evidence | Confidence | Recommended |
|---|---|---|---|
| auth | `src/auth/`, `tests/auth/*` | High | Yes |
| billing | `src/billing/`, missing tests | Medium | Later |
```

Recommend the smallest useful first batch. If the user already provided a narrow scope, this map can be brief and you may proceed after stating it.

### 3. Write Main Specs

For each selected capability, create or update:

```text
docs/spec/<capability>.md
```

Use this format:

```markdown
# <Capability> Specification

## Purpose
<What this capability does for users, operators, or downstream systems.>

## Requirements

### Requirement: <Observable behavior>
The system SHALL <current implemented behavior>.

#### Scenario: <Concrete case>
- GIVEN <starting condition>
- WHEN <event or action>
- THEN <observable result>
```

Use `SHALL` or `MUST` for behavior that is clearly implemented and relied on. Use `SHOULD` only when the evidence shows intended but non-strict behavior. Avoid `MAY` unless optional behavior is explicitly implemented.

### 4. Mark Confidence Without Polluting Requirements

When evidence is incomplete, do not write a confident requirement. Either omit it or add a separate note after the Requirements section:

```markdown
## Evidence Gaps

- <Behavior> appears in `<path>`, but no test or public docs confirm expected edge cases.
```

Evidence gaps are reminders to verify later; they are not requirements.

### 5. Merge With Existing Specs Carefully

If `docs/spec/<capability>.md` already exists:

- Read it before editing.
- Preserve existing requirements unless the implementation clearly contradicts them.
- If code and spec disagree, report the mismatch and ask whether the spec should document current code or desired behavior.
- Do not silently overwrite hand-written spec intent.

## What Belongs In Backfilled Specs

Include:

- Public or user-visible behavior.
- API contracts, command behavior, emitted events, permissions, validation rules, data lifecycle, failure modes, and compatibility guarantees.
- Edge cases that are implemented or tested.
- Security, privacy, reliability, or performance behavior when observable and supported by evidence.

Avoid:

- Internal helper names and private call sequences.
- Framework choices unless they affect observable behavior.
- Implementation plans, refactor notes, and TODOs.
- Aspirational behavior that does not exist yet.
- Requirements inferred only from naming.

## Handling Bugs And Weird Existing Behavior

Backfilling describes current behavior, even when it is awkward, if users or downstream systems may depend on it.

If behavior looks accidental or buggy:

- Document only if it is externally observable and likely relied on.
- Add an `Evidence Gaps` or `Known Current Behavior` note instead of pretending it is desirable.
- Suggest a future `docs/change/<change-name>/` proposal if the behavior should change.

## Final Response

After writing or updating specs, report:

- Specs created or updated.
- Scope covered and intentionally skipped.
- Evidence used, grouped by capability.
- Confidence level for each spec.
- Evidence gaps or code/spec mismatches.
- Suggested next backfill batch, if useful.
