---
name: my-grilling
description: >-
  Use this whenever the user asks to be grilled, interviewed, questioned,
  clarified, or pushed to shared understanding. Supports two modes: no-artifact
  for a pure batch grilling interview with no project files changed, and
  with-artifact for the same interview plus active domain modeling in CONTEXT.md
  and ADRs as terms and decisions settle.
sources:
  - https://www.skills.sh/mattpocock/skills/batch-grill-me
  - https://www.skills.sh/mattpocock/skills/domain-modeling
---

# My Grilling

Interview the user relentlessly until you reach shared understanding. Map the discussion as a design tree: every decision branches into the decisions that depend on it.

This skill has two modes:

- `no-artifact`: run only the batch grilling workflow. Ask questions; do not create or edit files.
- `with-artifact`: run the batch grilling workflow and actively maintain the project's domain model as terms and decisions crystallize.

Default to `no-artifact` unless the user asks for artifacts, docs, a domain model, `CONTEXT.md`, ADRs, persistent decisions, or says `with artifact`.

Treat these as `no-artifact` aliases: `no artifact`, `no artifacts`, `no docs`, `questions only`, `grill only`.

Treat these as `with-artifact` aliases: `with artifact`, `with artifacts`, `with docs`, `artifact mode`, `domain modeling`, `maintain CONTEXT.md`, `write ADRs`.

## Batch Grilling

Work the tree in rounds. The frontier is every decision whose prerequisites are already settled: the questions you can ask now without guessing at answers you have not heard yet.

Ask the whole frontier in one round. Use the `question` tool for the round whenever it is available: each frontier item should be one tool question, with the recommended answer as the first option and clearly marked `(Recommended)`. Keep options concise, include the tradeoff in the option description, and rely on the tool's custom-answer affordance when the user needs to supply their own wording. Then wait for the user's answers before the next round.

If the `question` tool is unavailable, fall back to numbered Markdown questions and give your recommended answer under each one.

Each round reshapes the tree. Settled decisions push the frontier outward and unblock questions that depended on them. Recompute the frontier before asking the next round. A question whose answer depends on another question still open in this round belongs to a later round, not this one.

Finding facts is your job, never the user's. When a frontier question needs a fact from the environment, inspect the filesystem or tools yourself. Do not ask the user for anything you can look up. Do not block the whole round on a lookup: treat the lookup as an unsettled prerequisite, ask the rest of the frontier now, and only ask downstream questions after the fact is known.

The decisions are the user's. Put each decision to them and wait.

The session is done when the frontier is empty: every branch of the design tree has been visited, with nothing silently assumed. Do not act on the result until the user confirms you have reached shared understanding.

## With-Artifact Mode

In `with-artifact` mode, actively build and sharpen the project's domain model while grilling.

The source of truth for domain artifacts lives in bundled references:

- Read [CONTEXT-FORMAT.md](./references/CONTEXT-FORMAT.md) before creating or editing `CONTEXT.md` or `CONTEXT-MAP.md`.
- Read [ADR-FORMAT.md](./references/ADR-FORMAT.md) before creating an ADR.

During the interview:

- Challenge terms that conflict with existing `CONTEXT.md` language immediately.
- Propose canonical names when the user uses vague or overloaded language.
- Stress-test domain relationships with concrete edge-case scenarios.
- Check code against stated domain behavior when the repository can answer the question.
- Update `CONTEXT.md` immediately when a term is resolved.
- Keep `CONTEXT.md` as a glossary only, not a spec, scratch pad, or implementation-decision log.
- Offer ADRs sparingly, only when the reference criteria are met.

## Markdown Fallback Format

When the `question` tool is unavailable, use this shape for each grilling round:

```md
Mode: no-artifact | with-artifact

Frontier questions:

1. {Decision question}
   Recommended answer: {your recommendation and why}

2. {Decision question}
   Recommended answer: {your recommendation and why}
```

If using `with-artifact`, include a short artifact note only when there is something ready to record:

```md
Artifact note: If you confirm question 2, I will record `{Term}` in `CONTEXT.md`.
```
