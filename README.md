# Tutor Matcher

A matchmaking platform that connects tutors and students by subject, schedule, and price.

## Prerequisites

- Node.js 20+
- Docker + Docker Compose
- [`just`](https://just.systems) — cross-platform command runner used for the
  workflows below (`brew install just`, `winget install --id Casey.Just`, or see
  the [install docs](https://just.systems/man/en/packages.html)). Each recipe is a
  thin wrapper over an `npm run` script, shown in the comments if you'd rather not
  install `just`.

## Setup

```bash
git clone https://github.com/Azther0z/tutor-matcher.git
cd tutor-matcher

just setup      # npm run setup
```

`just setup` installs all dependencies, copies missing `.env` files from their
`.env.example` templates, starts Postgres (waiting until it is healthy), applies
migrations, and seeds mock data. It is safe to re-run. Edit the generated `.env`
files if your local setup differs from the defaults, then start the app with
`just up` (see [Development](#development)).

`just` recipes work the same on macOS, Linux, and Windows; the equivalent
`npm run` script is shown in a comment next to each command.

<details>
<summary>Manual setup, step by step</summary>

```bash
just install                                   # npm run install:all
cp apps/backend/.env.example apps/backend/.env
just db-up                                      # npm run db:up  (docker compose up -d --wait)
cd apps/backend && just migrate                 # npm run db:migrate:dev  (prisma migrate dev)
cd apps/backend && just gen-mock-data           # npm run gen-mock-data  (prisma db seed)
```

</details>

## Development

Start Postgres plus both dev servers. They run **in the background** via
[PM2](https://pm2.keymetrics.io/), so you can close the terminal and they keep
running:

```bash
just up        # npm run up      — docker compose up -d, then backend + frontend (detached)
just logs      # npm run logs    — stream both servers' output
just status    # npm run status  — show whether they're running
just restart   # npm run restart — restart both
just down      # npm run down    — stop both
```

Both dev servers hot-reload on source changes. To run them attached to the
current terminal instead (Ctrl+C stops both), use `just dev` (`npm run dev`);
this assumes Postgres is already running.

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

Run `just` in the repo root or in `apps/backend` to list every recipe. The
matching `npm run` script (for use without `just`) is in the last column.

| `just`                   | Location       | Description                                     | `npm run` equivalent        |
| ------------------------ | -------------- | ----------------------------------------------- | --------------------------- |
| `just setup`             | repo root      | First-run: deps, env files, db, migrate, seed   | `npm run setup`             |
| `just install`           | repo root      | Install root + backend + frontend dependencies  | `npm run install:all`       |
| `just up` / `down`       | repo root      | Start / stop Postgres + both servers (detached) | `npm run up` / `down`       |
| `just logs` / `status`   | repo root      | Stream logs / show background-server status     | `npm run logs` / `status`   |
| `just restart`           | repo root      | Restart both background servers                 | `npm run restart`           |
| `just dev`               | repo root      | Run backend + frontend attached to the terminal | `npm run dev`               |
| `just db-up` / `db-down` | repo root      | Start (wait for healthy) / stop Postgres        | `npm run db:up` / `db:down` |
| `just gen`               | `apps/backend` | Regenerate the typed Prisma client              | `npm run gen`               |
| `just gen-mock-data`     | `apps/backend` | Seed fake data (`@faker-js/faker`)              | `npm run gen-mock-data`     |
| `just migrate`           | `apps/backend` | Create and apply a new migration                | `npm run db:migrate:dev`    |
| `just reset`             | `apps/backend` | Drop, re-migrate, and re-seed the database      | `npm run db:reset`          |
| `just studio`            | `apps/backend` | Open Prisma Studio                              | `npm run db:studio`         |

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

- Jest and Supertest tests under `apps/backend/src/__tests__/` cover API behavior in the
  conventional test runner.
- Cucumber.js runs Gherkin features under `apps/backend/features/`, with TypeScript step
  definitions that exercise the exported Express app through Supertest.

Run both backend suites from the repository root:

```bash
npm --prefix apps/backend test -- --runInBand
npm --prefix apps/backend run test:bdd
```

The initial Gherkin scenario verifies `GET /health`. See
[`docs/testing.md`](docs/testing.md) for the test layout, conventions, and CI behavior.

## CI/CD

Pull requests run formatting, linting, Jest tests, backend Gherkin tests, application builds,
and Docker image builds. A push to `main` publishes the frontend and backend images with both
immutable commit tags and the `latest` tag. Doco-CD polls this repository and deploys
[`deploy/compose.yaml`](deploy/compose.yaml) after validation succeeds.

## Project Structure

```
apps/
  backend/        Express API (TypeScript, Prisma, PostgreSQL)
    features/     Cucumber.js features, support code, and step definitions
  frontend/       Next.js app (TypeScript, Tailwind CSS)
docs/             Architecture, testing, charter, schema, ADRs, review
deploy/           Doco-CD deployment Compose manifest
docker-compose.yml
```

See [`docs/index.md`](docs/index.md) for the documentation index,
[`docs/project-architecture.md`](docs/project-architecture.md) for the architecture overview,
and [`docs/testing.md`](docs/testing.md) for the testing guide.
