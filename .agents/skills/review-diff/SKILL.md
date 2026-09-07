---
name: review-diff
description: Review a local diff for correctness, code cleanliness, and compliance with the project's coding guidelines. Args select the diff source — `unstaged`, `staged`, or a `<target> [<base>]` range (defaulting `<base>` to `main`). With no args, reviews both staged and unstaged worktree changes (`git diff HEAD`). Surfaces real issues without padding and ends with a ship/iterate verdict. Use when the user says "review my changes", "/review-diff", or wants a critique of work-in-progress code before committing.
---

Review a local diff rigorously. The user wants a critical, no-padding review focused on **correctness**, **coding style**, and other concrete issues — not generic praise, not a summary of the diff.

## Step 1 — Resolve the diff source

Parse `ARGUMENTS` into one of these modes:

| Args | Mode | Command |
| --- | --- | --- |
| (none) | worktree (combined) | `git diff HEAD` |
| `unstaged` | worktree (unstaged only) | `git diff` |
| `staged` | worktree (staged only) | `git diff --cached` |
| `<target>` | range, base defaults to `main` | `git diff main..<target>` |
| `<target> <base>` | range | `git diff <base>..<target>` |

`<target>` and `<base>` can each be `HEAD`, a branch name, or a commit hash. Treat them as opaque revisions and pass them through to git verbatim; let git resolve and complain.

Before reading the diff:

- For worktree modes, confirm there is actually a diff. If `git diff HEAD` (or the relevant flag) is empty, stop with: "Nothing to review — worktree is clean."
- For range modes, confirm `<target>` and `<base>` resolve via `git rev-parse --verify`. If either fails, stop with the underlying error.
- For range modes, also run `git log <base>..<target> --oneline` and check there is at least one commit ahead. If zero, stop with: "No commits between `<base>` and `<target>`."

Do **not** check out anything. This skill is read-only against the current worktree.

## Step 2 — Understand the intent

The signal depends on the mode:

- **Range mode:** read commit messages — `git log <base>..<target> --no-merges` (or `--format='%H%n%s%n%n%b'`). They are the author's stated intent; the review should hold the diff against them. If commits are messy ("wip", "fix", "fix 2"), say so explicitly in the report and infer intent from the diff.
- **Worktree mode:** no commit messages exist yet. Infer intent from the diff alone. State your inference at the top of the review so the user can correct it.

Then read the repo's coding standards. Look for and read whichever exist:

- `AGENTS.md`, `CLAUDE.md`, `.claude/CLAUDE.md` (and any `@`-imported files referenced inside them)
- `CONTRIBUTING.md`, `docs/CONTRIBUTING.md`
- `.editorconfig`, lint configs (`ruff.toml`, `.eslintrc*`, `pyproject.toml`, `package.json` lint scripts) — for style expectations.

These set the bar for "compliance with the coding guidelines."

## Step 3 — Read the changes

Get the diff with the command from step 1.

For large diffs (≥ ~500 lines or ≥ ~10 files), use **TodoWrite** to track:
- One todo per logical area or per file group.
- Mark each in-progress while reading; completed when reviewed.

For each file changed, prefer reading the **full file** via the Read tool when the diff alone hides context — bug-prone areas are usually at the boundary between added and unchanged code. The smaller scope of a diff review (vs. a full PR) is **not** a license to skim; it's a license to be more concrete.

While reading, look for:

**Correctness**
- Logic errors, off-by-one, wrong operator, swapped arguments, wrong default.
- Missing edge-case handling at *boundaries* the diff actually crosses (don't invent edge cases that aren't reachable).
- Race conditions, missing `await`, unhandled exceptions in async paths.
- Broken contracts: function signature change without callsite updates; schema/migration drift; API contract change without client/test update.
- Dead or unreachable code introduced by the change.
- Tests that don't actually exercise the new behavior (asserts on irrelevant fields, missing the failure case the bug fix was about, etc.).
- For worktree mode specifically: half-finished refactors, stray debug prints/`console.log`, leftover `// TODO` markers that the user probably meant to resolve before committing.

**Coding style**
- Departures from the conventions stated in `AGENTS.md` / `CLAUDE.md` / lint configs.
- Comments that restate the code, narrate the task, or reference the current change ("added for X") — flag them per the project's comment policy.
- Premature abstractions, unused parameters/types, dead imports.
- Naming that obscures intent.
- New dependencies or backwards-compat shims that the change doesn't actually need.

**Others**
- Security issues at trust boundaries (input validation, secrets handling, command injection).
- Performance regressions on hot paths (N+1, redundant I/O, unbounded loops).
- Test coverage gaps for the new behavior.
- Documentation drift if the change touches public API or user-visible behavior.
- Out-of-scope churn that should be split into a separate commit or change.

Be **critical and direct**. Surface real issues plainly without softening. Do not pad the list with stylistic nitpicks just to have findings. If the diff is clean, say so.

## Step 4 — Verify each finding before reporting

Treat every candidate finding as a hypothesis, not a fact. Before it earns a place in the report, confirm it against the actual code — a grep hit or a diff hunk is a *lead*, not proof.

For each candidate:

- **Read the real source, not just the diff.** Open the changed file and its surrounding context with the Read tool. Many "bugs" evaporate once you see the lines the diff didn't show (an early return above, a guard below, a default set elsewhere).
- **Trace the call sites — read them, don't just grep.** For a signature change, renamed symbol, changed return type, or any contract change, use grep to *locate* callers, then **read each one** and confirm it is genuinely broken — not already updated in this change, not guarded, not unreachable. A grep count is not a finding.
- **Double-check every condition for inversion.** Before reporting a boolean/condition bug, walk the true and false branches explicitly and confirm the polarity is actually wrong. Inverted comparisons, `!`-flipped guards, swapped early-returns, De Morgan rewrites — these are exactly where a fast read misfires. Re-read the condition and state what the correct logic would be; if it's actually correct, drop the finding.
- **Confirm the failing path is reachable.** An edge case sitting behind a guard the diff also adds is not a bug.

Drop any finding that doesn't survive this check. A surviving finding must cite the concrete evidence — the `path:line`, the caller you read, the branch you traced — so the user can confirm it the same way. If you're still unsure after verifying, report it as a question, not a defect.

## Step 5 — Report

Output in this exact structure:

    **Verdict:** Looks good / Needs changes / Major rework required

    **Executive summary:** 1–3 sentences. State what the diff does (or what you inferred it does) and the headline reason for the verdict.

    ### Correctness
    1. <issue, with `path:line` citation>. *Recommended action:* <concrete fix>.
    2. …

    ### Coding style
    3. …

    ### Others
    4. …

Rules for the output:

- **Number findings continuously across all three sections** (1, 2, 3, …) — do not restart at 1 in each section — so any finding has a unique number to reference later ("issue 3"). When a section starts mid-count, begin its ordered list at the next number; the markdown renderer honors the starting ordinal.
- Cite `path:line` for every finding so the author can jump to it.
- Each item ends with a one-sentence "Recommended action" the user can act on.
- Omit a section entirely if it has zero findings — do not write "no issues" inside a section. If all three are empty, state that directly under the summary and skip the headers.
- The verdict ladder:
  - **Looks good** — no correctness issues; at most a couple of minor style nits the user can defer.
  - **Needs changes** — at least one correctness issue, or multiple style issues that violate the project's stated conventions.
  - **Major rework required** — fundamental design problem, broken contract, or the diff doesn't match the inferred or stated intent.
- For worktree mode, "Looks good" implicitly means "fine to commit." Don't actually run `git commit` — the user decides.
- Don't fabricate findings. Don't open with "Overall, this change looks great." Don't end with a "happy to discuss" footer.

## Guardrails

- **Do not commit, push, stage, or modify code.** This skill is read-only.
- **Do not run the project's test suite** unless the user explicitly asks — reviews are about reading, not running.
- **Do not invent findings.** A short review with two real issues is better than a long review with eight invented ones.
- **Verify before reporting.** Every finding is confirmed against the actual source and its call sites (read them, don't just grep), and every condition is checked for inversion. Unverified suspicions are dropped, not reported — or downgraded to an explicit question.
- **Do not switch branches or check anything out.** Range mode reviews the diff between two revisions without altering the working tree.
