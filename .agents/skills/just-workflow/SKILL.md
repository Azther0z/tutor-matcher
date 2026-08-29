---
name: just-workflow
description: "Run Tutor Matcher dev, database, and Prisma tasks through the repo's `just` recipes. Use whenever a task needs installing deps, starting/stopping servers, running migrations, regenerating the Prisma client, seeding, testing, linting, or formatting in this repo — prefer these recipes over raw npm/prisma/docker commands so behavior matches CI and the Husky hooks."
metadata:
  tags: just, task-runner, prisma, dev-workflow, tutor-matcher
---

# Just Workflow

This repo uses [`just`](https://just.systems) as the cross-platform task runner. Every recipe delegates to an `npm run` script, so the `npm run` form works identically if `just` is unavailable — but call the `just` recipe by default.

There are two justfiles:

- **Repo root** (`/justfile`) — whole-project: setup, running both servers, Postgres.
- **`apps/backend/justfile`** — Prisma and backend-only tasks. `cd apps/backend` first, or these recipes are also surfaced in the root README command table with their `npm --prefix` equivalents.

Run `just` (no args) in either directory to list its recipes.

## Repo-root recipes

| Recipe | Does | Notes |
|---|---|---|
| `just setup` | install deps → copy `.env` files → migrate → seed | Needs Postgres reachable: run `just db-up` first (or `just up`). Does **not** start Docker itself. Safe to re-run. |
| `just install` | install root + backend + frontend deps | `prisma generate` runs via backend `postinstall`. |
| `just db-up` / `just db-down` | start (wait for healthy) / stop the Postgres container | `docker compose up -d --wait` / `down`. |
| `just up` / `just down` | start / stop Postgres + backend + frontend detached via PM2 | `just up` prints the local URLs (frontend `http://localhost:3000`, backend `http://localhost:8000`). |
| `just restart` / `just logs` / `just status` | restart / stream logs / list PM2 processes | |
| `just dev` | run backend + frontend attached to the terminal | Assumes Postgres already running. |
| `just format` / `just format:check`* | Prettier write / check across `apps/**`, `docs/backlog/**`, `scripts/**` | *`format:check` is an npm script, not a just recipe. Do not reformat `docs/sources/`. |
| `just backlog:check`* | validate the git backlog | npm script: `npm run backlog:check`. |

## Backend recipes (`apps/backend/`)

| Recipe | Does | When |
|---|---|---|
| `just migrate` | `prisma migrate dev` — create + apply a migration **and** regenerate the client | **After editing `schema.prisma`** (adding/changing a field). This is the normal path. |
| `just gen` | `prisma generate` — regenerate the typed client only (`src/generated/prisma`) | When only types need rebuilding; `migrate` already does this. |
| `just db-push` | `prisma db push` — sync schema to DB with no migration | Prototyping only, never on shared/committed schema. |
| `just reset` | `prisma migrate reset` — drop DB, replay migrations, re-seed | Destructive; local only. |
| `just gen-mock-data` | `prisma db seed` (`@faker-js/faker`) | Re-seed fake data. |
| `just migrate-deploy` | `prisma migrate deploy` | Apply committed migrations (deploy/CI), no schema diffing. |
| `just studio` | `prisma studio` | Browse the DB. |
| `just validate` / `just format` | `prisma validate` / `prisma format` on `schema.prisma` | |
| `just test` / `just test-bdd` / `just lint` | Jest + Supertest / Cucumber.js / ESLint | Run before committing backend changes. |

## Rules

- **Changed a Prisma field?** → `cd apps/backend && just migrate`. Commit the generated migration folder under `apps/backend/prisma/migrations/`.
- Do not run bare `prisma`, `npm run dev`, or `docker compose` when a `just` recipe exists — the recipes keep parity with CI and the Husky `pre-commit` hook.
- `just setup` no longer starts Postgres; sequence a fresh checkout as `just db-up` → `just setup` → `just up`.
- Formatting/ESLint `--fix` run on staged files via the `pre-commit` hook; CI (`Quality Format`) rejects unformatted code.
