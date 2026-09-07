---
name: review-pr
description: Review a pull request for correctness, code cleanliness, and compliance with the project's coding guidelines. Optional PR number or URL — defaults to the PR for the current branch. Checks out the PR locally, reads the description (or infers intent from the diff), surfaces real issues without padding, and ends with a clear merge verdict. Use when the user says "review this PR", "/review-pr", or pastes a PR link asking for a review.
---

Review a pull request rigorously. The user wants a critical, no-padding review focused on **correctness**, **coding style**, and other concrete issues — not generic praise, not a summary of the diff.

`ARGUMENTS` is optional: a PR number (e.g. `42`) or a GitHub URL. If absent, review the PR for the current branch.

## Step 1 — Resolve and check out the PR

Run in parallel:

- `git status` — must be clean. If dirty, stop and tell the user to commit/stash before review.
- `git rev-parse --abbrev-ref HEAD` — record the original branch so the user can switch back.
- If `ARGUMENTS` is set, parse it: a bare number, `owner/repo#N`, or a `github.com/.../pull/N` URL all map to the same `<N>`. Otherwise, run `gh pr view --json number,headRefName,baseRefName,title,body,url` against the current branch.

If no PR resolves (no argument *and* no PR for the current branch), stop with a clear error like: "No PR for branch `<name>` on remote. Pass a PR number or push the branch first."

Once resolved, fetch the PR metadata in full:

    gh pr view <N> --json number,title,body,baseRefName,headRefName,url,state,mergeable,isDraft,additions,deletions,changedFiles,commits

If `ARGUMENTS` was set, run `gh pr checkout <N>` to switch to the PR branch. If the working tree was clean at step start, this should succeed. If it fails (e.g. closed PR, missing remote), surface the error and stop.

## Step 2 — Understand the intent

- **Body present:** read it carefully. The "Summary" / "Changes" sections name the scope and rationale — the review should hold the diff against that stated intent.
- **Body empty or trivial:** infer intent from the diff and commit messages. State your inference explicitly at the top of the review so the author can correct it.

Then read the repo's coding standards. Look for and read whichever exist:

- `AGENTS.md`, `CLAUDE.md`, `.claude/CLAUDE.md` (and any `@`-imported files referenced inside them)
- `CONTRIBUTING.md`, `docs/CONTRIBUTING.md`
- `.editorconfig`, lint configs (`ruff.toml`, `.eslintrc*`, `pyproject.toml`, `package.json` lint scripts) — for style expectations.

These set the bar for "compliance with the coding guidelines."

## Step 3 — Read the changes

Get the diff:

    gh pr diff <N>

For large PRs (≥ ~500 lines or ≥ ~10 files), use **TodoWrite** to track:
- One todo per logical area or per file group.
- Mark each in-progress while reading; completed when reviewed.

For each file changed, prefer reading the **full file** via the Read tool when the diff alone hides context — bug-prone areas are usually at the boundary between added and unchanged code.

While reading, look for:

**Correctness**
- Logic errors, off-by-one, wrong operator, swapped arguments, wrong default.
- Missing edge-case handling at *boundaries* the diff actually crosses (don't invent edge cases that aren't reachable).
- Race conditions, missing `await`, unhandled exceptions in async paths.
- Broken contracts: function signature change without callsite updates; schema/migration drift; API contract change without client/test update.
- Dead or unreachable code introduced by the change.
- Tests that don't actually exercise the new behavior (asserts on irrelevant fields, missing the failure case the bug fix was about, etc.).

**Coding style**
- Departures from the conventions stated in `AGENTS.md` / `CLAUDE.md` / lint configs.
- Comments that restate the code, narrate the task, or reference the current PR ("added for X") — flag them per the project's comment policy.
- Premature abstractions, unused parameters/types, dead imports.
- Naming that obscures intent.
- New dependencies or backwards-compat shims that the change doesn't actually need.

**Others**
- Security issues at trust boundaries (input validation, secrets handling, command injection).
- Performance regressions on hot paths (N+1, redundant I/O, unbounded loops).
- Test coverage gaps for the new behavior.
- Documentation drift if the PR changes public API or user-visible behavior.
- Out-of-scope churn bundled into the same PR.

Be **critical and direct**. Surface real issues plainly without softening. Do not pad the list with stylistic nitpicks just to have findings. If the PR is clean, say so.

## Step 4 — Verify each finding before reporting

Treat every candidate finding as a hypothesis, not a fact. Before it earns a place in the report, confirm it against the actual code — a grep hit or a diff hunk is a *lead*, not proof.

For each candidate:

- **Read the real source, not just the diff.** Open the changed file and its surrounding context with the Read tool. Many "bugs" evaporate once you see the lines the diff didn't show (an early return above, a guard below, a default set elsewhere).
- **Trace the call sites — read them, don't just grep.** For a signature change, renamed symbol, changed return type, or any contract change, use grep to *locate* callers, then **read each one** and confirm it is genuinely broken — not already updated in this PR, not guarded, not unreachable. A grep count is not a finding.
- **Double-check every condition for inversion.** Before reporting a boolean/condition bug, walk the true and false branches explicitly and confirm the polarity is actually wrong. Inverted comparisons, `!`-flipped guards, swapped early-returns, De Morgan rewrites — these are exactly where a fast read misfires. Re-read the condition and state what the correct logic would be; if it's actually correct, drop the finding.
- **Confirm the failing path is reachable.** An edge case sitting behind a guard the diff also adds is not a bug.

Drop any finding that doesn't survive this check. A surviving finding must cite the concrete evidence — the `path:line`, the caller you read, the branch you traced — so the author can confirm it the same way. If you're still unsure after verifying, report it as a question, not a defect.

## Step 5 — Report

Output in this exact structure:

    **Verdict:** Ready to merge / Needs changes / Major rework required

    **Executive summary:** 1–3 sentences. State what the PR does and the headline reason for the verdict.

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
- Each item ends with a one-sentence "Recommended action" the author (or you, on a follow-up) can act on.
- Omit a section entirely if it has zero findings — do not write "no issues" inside a section. If all three are empty, state that directly under the summary and skip the headers.
- The verdict ladder:
  - **Ready to merge** — no correctness issues; at most a couple of minor style nits the author can defer.
  - **Needs changes** — at least one correctness issue, or multiple style issues that violate the project's stated conventions.
  - **Major rework required** — fundamental design problem, broken contract, or the diff doesn't match the stated intent.
- Don't fabricate findings. Don't open with "Overall, this is a great PR." Don't end with a "happy to discuss" footer.

## Step 6 — Leave the workspace usable

If `gh pr checkout` switched branches, end the review by telling the user the current branch and how to switch back (e.g. "Currently on `pr-branch`. `git switch <original>` to return."). Do not switch back automatically — the user may want to run tests or inspect locally.

## Guardrails

- **Do not commit, push, or modify code.** This skill is read-only.
- **Do not post the review to GitHub.** Render it in chat; the user decides if and how to post.
- **Do not run the project's test suite** unless the user explicitly asks — reviews are about reading, not running.
- **Do not check out** if the working tree is dirty. Stop and surface the dirty state.
- **Do not invent findings.** A short review with two real issues is better than a long review with eight invented ones.
- **Verify before reporting.** Every finding is confirmed against the actual source and its call sites (read them, don't just grep), and every condition is checked for inversion. Unverified suspicions are dropped, not reported — or downgraded to an explicit question.
