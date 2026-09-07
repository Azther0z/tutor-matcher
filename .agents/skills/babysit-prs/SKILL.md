---
name: babysit-prs
description: Sweep your open PRs and drive each toward mergeable — for every PR you authored, bring stale branches up to date, fix failing CI (via /address-ci-failures), implement accepted review feedback (via /address-review), re-verify, and report per-PR status. One idempotent sweep meant to be re-run on a cadence; pair with the built-in /loop or /schedule for continuous babysitting. Acts only on your own PRs and never force-pushes, merges, or posts review replies unattended. Use when the user says "/babysit-prs", "keep my PRs green", or "watch my open PRs".
---

Drive every open PR you own toward **mergeable** — CI green, branch current, review feedback addressed — doing the mechanical work and surfacing everything that needs a human. This is **one sweep**: assess each PR against live GitHub state, act on the clear blockers, report the rest. It's designed to be **re-run** on a cadence (the built-in `/loop` interval runner, or `/schedule` for a cron cloud agent), so a single invocation does one pass and stops — the next tick picks up whatever moved. It's also an **orchestrator**: the per-PR work is delegated to the dedicated skills; invoke them and trust their output.

`ARGUMENTS` is optional:

- **Empty** → babysit every open, non-draft PR you authored (author = configured `git user.email`) in the current repo.
- A **PR number or URL** → babysit just that one.
- The literal `report` → **read-only sweep**: assess and report status for every PR, take no action, push nothing. Use it to observe before letting the loop act.

Invoking `/babysit-prs` authorizes the per-PR work below — checking out branches, committing fixes, and pushing to **your own PR branches**. It does **not** authorize force-pushing, merging, or posting comments; those stay human decisions and are surfaced, never done. Halt and surface anything ambiguous rather than guessing on an unattended run.

## Step 1 — Preflight

Run in parallel:

- `git status` — the worktree **must be clean**. If there are uncommitted changes, **stop immediately** and report — babysitting checks out other branches, and stashing the user's in-progress work unattended is not this skill's call.
- `git rev-parse --abbrev-ref HEAD` — record the starting branch; return to it at the end of the sweep.
- `git config user.email` — identifies "your own" PRs.
- `gh pr list --author "@me" --state open --json number,title,url,isDraft,headRefName` — the target set (skip drafts unless a specific PR was named).

If the target set is empty, stop with "No open PRs to babysit."

State the sweep plan in one line: which PRs are in scope, and whether this is an acting sweep or `report`-only.

## Step 2 — Sweep each PR

For each PR in the target set, read its **live** state — `gh pr view <N> --json state,mergeable,mergeStateStatus,reviewDecision,statusCheckRollup,headRefName,baseRefName` and `gh pr checks <N>` — and act on the **first** applicable blocker in this priority order. Do at most one action-pass per PR per sweep; don't wait on CI inside a sweep — let the next tick re-assess.

1. **Merged or closed** — drop it; nothing to do.
2. **Behind base / not current** — bring it up to date **only if that needs no history rewrite and no conflict resolution**: `gh pr update-branch <N>` (merges base into the head branch; a normal push, no force). If it reports a conflict or the repo requires a linear-history rebase, **surface it** for a manual `/rebase-main` and skip this PR's remaining checks.
3. **CI failing** (a real failure, not pending/queued) — `gh pr checkout <N>`, then `/address-ci-failures <N>`. It classifies each failure; if it produced fixes, gate them through `/verify-impl`, commit with `/make-commits`, and `git push`. If it judged the failures infra-flake or couldn't fix them, **report that and push nothing**.
4. **CI pending / running** — no action this sweep; the next tick sees the result.
5. **Unresolved review feedback** — `gh pr checkout <N>`, then `/address-review <N>`. Implement the findings it accepts, gate through `/verify-impl`, commit with `/make-commits`, and push. Its **reply drafts are surfaced in the report, not posted** — posting is a human action.
6. **Green, current, approved** — report **ready to merge**. Do **not** merge; that's the user's call (or a protected-branch auto-merge they configured).
7. **Green, current, awaiting review** — report **awaiting review**; no action.

After touching a PR, return to the starting branch before moving to the next (and again at sweep end), so the sweep leaves the worktree where it found it.

Every push is gated: `/verify-impl` (or the repo's verify command) must be green first — same hard gate as everywhere else. Never push red, never `--no-verify`.

## Step 3 — Sweep report

End with a compact per-PR summary:

    Babysit sweep — <N> PRs (<repo>)
      #123 <title>   acted: updated branch + fixed CI (2 commits, pushed) → CI re-running
      #128 <title>   blocked: rebase conflict — run /rebase-main manually
      #131 <title>   ready to merge (green, approved)
      #134 <title>   awaiting review — no action
      #140 <title>   review fixes pushed; 2 reply drafts below (post manually)

Then, for any PR where `/address-review` ran, include its drafted replies verbatim so the user can post them. If the sweep halted early (dirty worktree, ambiguous failure), report where and the exact next action.

## Running it on a cadence

This skill is one sweep. To babysit continuously, wrap it in a runner:

- **`/loop <interval> /babysit-prs`** — re-runs the sweep every interval in this session (e.g. every 10–15 min while you work). Good for actively-moving PRs.
- **`/schedule`** — a cron cloud agent running `/babysit-prs` on a fixed schedule (e.g. hourly) when you're away.

Each sweep reads live GitHub state, so the loop is **stateless and idempotent** — GitHub is the durable state.

## Guardrails

- **Your PRs only.** Act solely on PRs you authored. Never touch someone else's PR branch.
- **Never rewrite history unattended.** Bring branches current only via a no-force merge (`gh pr update-branch`); anything needing a rebase, force-push, or conflict resolution is surfaced for a manual `/rebase-main`, never done in the loop.
- **Never merge.** The loop reports "ready to merge"; a human (or configured auto-merge) merges.
- **Never post replies.** `/address-review`'s reply drafts are rendered for the user to post, not pushed to GitHub.
- **Green before every push.** Each push clears `/verify-impl` first; no red, no `--no-verify`.
- **Clean worktree, or halt.** Never stash or discard the user's in-progress work to free the tree.
- **One pass per PR per sweep.** Don't wait on CI within a sweep or re-run a fix already pushed — let the cadence iterate.
- **Surface, don't guess.** Ambiguous CI failures, conflicting rebases, and pushed-back review findings are reported for a human, not forced through.
