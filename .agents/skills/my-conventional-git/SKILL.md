---
name: my-conventional-git
description: "Use this whenever the user asks for conventional Git help: creating or naming branches, writing commits, preparing PR titles or bodies, deciding Conventional Commit types, handling release tags/version bumps/changelogs, or making AI-agent Git workflow choices. Also use before making commits or PRs when the repo has no clearer local convention. This skill applies an opinionated profile based on official Conventional Commits and Conventional Branch, while inspecting and respecting repository-local conventions first."
sources:
  - https://www.conventionalcommits.org/en/v1.0.0/
  - https://conventionalbranch.org/
---

# My Conventional Git

Use this as a compact always-loaded operating guide. Load only the action file that matches the task.

## Default Workflow

1. Inspect the repository before choosing a branch name, commit message, PR title, release version, or tag in an existing repo.
2. Protect unrelated work before staging, committing, tagging, pushing, or opening a PR.
3. Read the action file for the current task:
   - Branch names: `references/branch-names.md`
   - Commit messages: `references/commit-messages.md`
   - Pull requests: `references/pull-requests.md`
   - Releases, tags, changelogs: `references/releases.md`
4. If repo convention conflicts with these defaults, follow the repo convention and briefly note the conflict.
5. If classification is ambiguous, decide independently. Briefly explain the choice only when the decision is non-obvious.

## Repo Inspection

Inspect lightly before applying defaults. Check recent commit subjects and bodies, current and nearby branch names, existing tags and release branches, PR templates or contribution docs, commitlint/changelog/release config, and workflows that validate branch names, commits, PR titles, tags, or releases.

If local convention conflicts with this skill, follow local convention, briefly mention the divergence, and do not rewrite unrelated history or existing names to match this skill.

When merge behavior is unknown or mixed, optimize both durable units: make individual commits conventional when creating commits, make PR titles conventional when preparing PRs, and leave default Git merge commit messages alone unless the repo clearly rewrites them.

When a change fits multiple types or branch categories, decide based on intent and durable user-facing meaning, not just file paths. Split unrelated work into separate commits or PRs when feasible. If ambiguity would materially affect release impact, explain the choice briefly.

## Safety

- Inspect status and relevant diffs before staging or committing.
- Stage only intended changes.
- Never revert, overwrite, or include unrelated user changes.
- If unrelated changes are present, work around them unless they directly block the requested action.
- If unrelated changes directly conflict with the requested action, ask the user how to proceed.
- Create branches, commits, tags, and PR text when asked.
- Do not push unless explicitly asked.
- Do not force-push unless explicitly asked and the user understands the risk.
- Do not amend commits unless explicitly asked.
- Do not use destructive commands such as hard resets or checkout-based reverts unless explicitly approved.

## AI Origin

Record AI involvement with the trailer `Assisted by: <agent> (<model name>)` for every agent touch when a durable Git artifact is being produced.

- Prefer the PR body footer when there is a PR.
- Use the commit footer when there is no PR and the commit is the durable artifact.
- Do not use AI-agent branch prefixes by default; branch prefixes should encode purpose.

## Validation

Validation is advisory in this skill. Generate good names and messages; do not make enforcement the core job unless the user asks.

Mention validation options when the user asks for hooks, CI checks, enforcement, commitlint, branch naming rules, release automation, or contributor onboarding. Prefer existing repo tooling when present. Keep regexes and hook scripts out of normal answers unless the user asks for implementation. If asked to implement validation, inspect the repo first and make the smallest change that fits existing tooling.

## Core Principles

- Official Conventional Commits v1.0.0 is the commit-message baseline.
- Conventional Branch is the branch-name baseline.
- This skill is an opinionated profile, not a new public specification.
- Use purpose-first branch prefixes; do not use AI-agent prefixes by default.
- Preserve exact user intent and protect unrelated work.
- Do not push, force-push, amend, reset, or publish unless the user explicitly asks.

## Source Policy

Summarize and attribute the sources. Do not copy substantial source text into generated docs, prompts, or skill files.
