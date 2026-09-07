---
name: address-review
description: Work through reviewer feedback on a PR systematically — accept or push back on each finding with reasoning, implement accepted ones, draft a per-finding reply to the reviewer. Optional argument is a PR number, PR URL, or a path/file containing pasted review text; defaults to the open PR for the current branch. Leaves changes staged for /make-commits; renders the reply draft in chat. Use when the user says "/address-review", "address this review", or pastes reviewer comments.
---

Take a reviewer's findings and work through them one by one. Be **critical** — agree when they're right, push back when they're not, and only implement what's genuinely correct. The output is staged code changes plus a draft reply per finding for the user to post.

`ARGUMENTS` is optional. Accepted forms, in resolution order:

1. **Empty** — review the open PR on the current branch via `gh pr view`.
2. **Bare integer** (matches `^\d+$`) — a PR number. Fetch via `gh pr view <N> --json reviews,comments`.
3. **GitHub URL** (contains `github.com/.../pull/`) — same path, with the PR number parsed from the URL.
4. **Existing file path** — read its contents as the review text.
5. **Anything else** — treat the argument verbatim as the review text. This is the common case for pasting a reviewer's comment block directly into the invocation.
6. The literal token `paste` (case-insensitive) — explicit "I'm pasting the review in my next message." Prompt the user for it.

Detect in that exact order. A 3-line pasted review starting with `1.` is review text (rule 5), not a PR number (rule 2 requires the *entire* argument to match `^\d+$`).

## Step 1 — Establish context

Run in parallel:

- `git status` — record whether the worktree is clean.
- `git rev-parse --abbrev-ref HEAD` — current branch.
- If reviewing a PR: `gh pr view <N> --json title,body,baseRefName,headRefName,url,reviews,comments` for full context.
- Read `AGENTS.md`, `CLAUDE.md`, `.claude/CLAUDE.md`, lint configs — the project's coding standards. Same set `review-pr` reads.

If the worktree has uncommitted changes from earlier work, **stop and ask** whether to address findings on top of them or whether the user wants to commit/stash first. Mixing in-progress work with review fixes makes `/make-commits` harder to split cleanly.

## Step 2 — Parse the findings

Convert the review into a numbered list of discrete findings. Each finding has:

- A claim or request (what the reviewer wants).
- Optionally a citation (`path:line`).
- A severity if stated (`nit`, `suggestion`, `blocking`, `high`, `medium`, `low`).

If the review is one long paragraph, **split it** into atomic items yourself. Don't lump multiple concerns into one finding — the per-finding reply structure depends on atomicity.

Output the parsed list to the user before doing anything else, so they can correct misparses.

## Step 3 — Evaluate each finding

For every finding, decide one of three outcomes and **state the reasoning before acting**:

- **Accept** — the reviewer is right. Plan the fix.
- **Push back** — the reviewer is wrong, the concern is already addressed, or the suggested fix would cause a worse problem. Draft a respectful but direct counter-argument citing specifics. The user can override.
- **Clarify** — need more info from the reviewer (ambiguous claim, missing repro, unclear scope). Draft the clarifying question.

Be honest. Don't accept findings just to defer to the reviewer — if you disagree, say so with reasoning. Don't push back to seem clever — if they're right, accept and move on.

For 4+ findings, use **TodoWrite** to track each finding's status (pending → in_progress → completed). One todo per finding.

## Step 4 — Implement accepted findings

For each `Accept`:

- Read the cited file(s) at the referenced lines to confirm the issue exists as described.
- Make the minimal change that fixes the concern. Don't refactor surrounding code unless the reviewer explicitly asked.
- After each fix, re-read the modified region to make sure the change is correct and complete.

Do **not** commit. The user will run `/make-commits` (or commit manually) after the draft is ready.

If implementing an accepted finding reveals that the original `Accept` was wrong (e.g. the fix breaks something the reviewer didn't see), flip it to `Push back` with the new reasoning, undo the partial change, and continue.

## Step 5 — Draft the reply

Render one reply block per finding, in the order the reviewer posted them. For each:

    **#<N>:** <verdict — Addressed / Push back / Clarifying question>
    
    <one-paragraph reply written *to the reviewer*, not about them>

Guidelines for the prose:

- For `Addressed` findings, name the concrete fix (`path:line`, what changed, what behavior is now correct). Two sentences max.
- For `Push back` findings, lead with the disagreement and cite evidence. Don't open with "Thanks for the feedback" or hedging. End with what you propose instead (or a request that they re-explain if you genuinely don't understand).
- For `Clarifying question` findings, ask the specific thing you need to know. Don't ask "can you elaborate?" — ask the targeted question.
- No "happy to discuss" or "let me know what you think" footers.

At the end of the draft, list the files you modified:

    Modified:
      <path>
      <path>
    
    Run `/make-commits` to split these into logical commits.

## Step 6 — Final report

End the response with the draft replies + the modified-files list. Nothing else. The user reads it, posts the reply themselves, and runs `/make-commits`.

## Guardrails

- **Do not commit, push, or stage.** Leave changes in the worktree for `/make-commits`.
- **Do not post the reply to GitHub.** Render it in chat.
- **Do not implement findings the agent decided to push back on.** Push back means push back.
- **Do not silently widen scope.** If a finding tempts you into a refactor the reviewer didn't ask for, surface the temptation to the user and ask.
- **Do not invent findings.** If the reviewer's text is short and clear, parse it short and clear.
- **Don't lose dissent.** When you disagree with a finding, the draft reply must say so plainly — don't soften it into vague acknowledgement.
