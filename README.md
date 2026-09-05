# Tutor Matcher

A matchmaking platform that connects tutors and students by subject, schedule, and price.
A student opens one of a tutor's subjects, picks a continuous block of that tutor's
published 30-minute slots, and pays from a single wallet balance — which confirms the
lesson immediately. What the product does is documented in
[`docs/user-journeys.md`](docs/user-journeys.md).

## Prerequisites

- Node.js 22+
- Docker + Docker Compose
- [`just`](https://just.systems) — cross-platform command runner used for the
  workflows below (`brew install just`, `winget install --id Casey.Just`, or see
  the [install docs](https://just.systems/man/en/packages.html)). Compose
  orchestration is implemented in the justfile; the remaining recipes wrap an
  `npm run` script, shown in the comments if you'd rather not install `just`.

## Setup

```bash
git clone https://github.com/Azther0z/tutor-matcher.git
cd tutor-matcher

just setup
```

`just setup` creates missing `.env` files from their `.env.example` templates,
starts Postgres and waits for it, installs all dependencies, applies migrations,
and seeds mock data. It is safe to re-run. Start the complete local Compose stack
with `just up` (see [Development](#development)).

`just` recipes work the same on macOS, Linux, and Windows. Recipes that only wrap
npm work show the equivalent `npm run` script in a comment; Compose orchestration
lives in the justfile and has no `npm run` form.

<details>
<summary>Manual setup, step by step</summary>

```bash
just env                              # node scripts/setup-env.mjs  (copy .env templates)
just db-up                            # start Postgres and wait for it
just install                          # npm run install:all
cd apps/backend
just migrate                          # npm run db:migrate:dev  (prisma migrate dev)
just gen-mock-data                    # npm run gen-mock-data   (prisma db seed)
```

</details>

## Development

Start Postgres plus the backend and frontend containers. They run **in the
background** via Docker Compose, so you can close the terminal and they keep
running:

```bash
just up               # build and start Postgres + backend + frontend
just logs             # stream all container output
just logs backend     # ...or just one service
just status           # show Compose service status
just restart          # restart all services
just down             # stop and remove the local stack
```

The detached Compose stack uses production-style images and does not hot-reload
source changes; rerun `just up` after changing application code. To run both dev
servers with hot reload attached to the current terminal instead (Ctrl+C stops
both), use `just dev` (`npm run dev`); this assumes Postgres is already running.

The root `.env` file is created from `.env.example` automatically. Edit
`FRONTEND_PORT` or `BACKEND_PORT` there to avoid port conflicts on your device.

<details>
<summary>Run each server in its own terminal</summary>

```bash
# Backend (port 8000)
cd apps/backend && npm run dev

# Frontend (port 3000)
cd apps/frontend && npm run dev
```

</details>

### Task reference

Run `just` in the repo root or in `apps/backend` to list every recipe. Docker
Compose orchestration is implemented in the justfile and has no `npm run`
equivalent; the remaining recipes wrap an npm script shown in the last column.

| `just`                   | Location       | Description                                         | `npm run` equivalent      |
| ------------------------ | -------------- | --------------------------------------------------- | ------------------------- |
| `just setup`             | repo root      | First-run: env files, Postgres, deps, migrate, seed | `npm run setup` (partial) |
| `just install`           | repo root      | Install root + backend + frontend dependencies      | `npm run install:all`     |
| `just env`               | repo root      | Copy missing `.env` files from templates            | `npm run setup:env`       |
| `just up` / `down`       | repo root      | Start / stop the local Compose stack                | —                         |
| `just logs` / `status`   | repo root      | Stream logs / show Compose service status           | —                         |
| `just restart`           | repo root      | Restart the local Compose services                  | —                         |
| `just db-up` / `db-down` | repo root      | Start (wait for healthy) / stop Postgres            | —                         |
| `just dev`               | repo root      | Run backend + frontend attached to the terminal     | `npm run dev`             |
| `just gen`               | `apps/backend` | Regenerate the typed Prisma client                  | `npm run gen`             |
| `just gen-mock-data`     | `apps/backend` | Seed fake data (`@faker-js/faker`)                  | `npm run gen-mock-data`   |
| `just migrate`           | `apps/backend` | Create and apply a new migration                    | `npm run db:migrate:dev`  |
| `just reset`             | `apps/backend` | Drop, re-migrate, and re-seed the database          | `npm run db:reset`        |
| `just studio`            | `apps/backend` | Open Prisma Studio                                  | `npm run db:studio`       |

### More recipes

Beyond the table above, `apps/backend` also exposes:

| `just`                | Description                         | `npm run` equivalent      |
| --------------------- | ----------------------------------- | ------------------------- |
| `just test`           | Backend tests (Jest + Supertest)    | `npm test`                |
| `just test-bdd`       | Backend Gherkin tests (Cucumber.js) | `npm run test:bdd`        |
| `just lint`           | ESLint on backend source            | `npm run lint`            |
| `just validate`       | Validate `schema.prisma`            | `npm run prisma:validate` |
| `just format`         | Format `schema.prisma`              | `npm run prisma:format`   |
| `just migrate-deploy` | Apply committed migrations (deploy) | `npm run db:migrate`      |

From the repo root, `npm run format` / `npm run format:check` run Prettier over
all files. The frontend test suite is `npm test` in `apps/frontend`.

### Git hooks

A Husky `pre-commit` hook runs `lint-staged` on staged files — `prettier --write`
plus the per-app `eslint --fix` for `apps/backend` and `apps/frontend` — and then
`npm run format:check` as a gate. Formatting and lint fixes are applied and
re-staged automatically; no need to run them by hand before committing.

## Testing

The backend has two complementary test suites:

- Jest and Supertest tests under `apps/backend/test/` cover API behavior in the
  conventional test runner.
- Cucumber.js runs Gherkin features under `apps/backend/features/`, with TypeScript step
  definitions that exercise the exported Express app through Supertest.

Run both backend suites from the repository root:

```bash
npm --prefix apps/backend test -- --runInBand
npm --prefix apps/backend run test:bdd
```

The initial Gherkin scenario verifies the backend root endpoint. See
[`docs/testing.md`](docs/testing.md) for the test layout, conventions, and CI behavior.

## CI/CD

Pull requests run formatting, linting, Jest tests, backend Gherkin tests, application builds, and
production image builds. A push to `main` runs the production Compose build from
[`deploy/compose.yaml`](deploy/compose.yaml), then publishes both images with immutable commit
tags and the `latest` tag. Doco-CD polls this repository and deploys the same manifest after
validation succeeds.

## Project Structure

```
apps/
  backend/        Express API (TypeScript, Prisma, PostgreSQL)
    features/     Cucumber.js features, support code, and step definitions
  frontend/       Next.js app (TypeScript, Tailwind CSS)
docs/             Journeys, schema, architecture, testing, charter, backlog, ADRs
deploy/           Doco-CD deployment Compose manifest
docker-compose.yml
```

See [`docs/index.md`](docs/index.md) for the documentation index. Before working on a
product change, read [`docs/user-journeys.md`](docs/user-journeys.md) for what the product
does, [`docs/project-schema.md`](docs/project-schema.md) for what it stores, and
[`CONTEXT.md`](CONTEXT.md) for what to call things. See
[`docs/project-architecture.md`](docs/project-architecture.md) for the architecture overview
and [`docs/testing.md`](docs/testing.md) for the testing guide.
