# Tutor Matcher

A matchmaking platform that connects tutors and students by subject, schedule, and price.
A student opens one of a tutor's subjects, picks a continuous block of that tutor's
published 30-minute slots, and pays from a single wallet balance — which confirms the
lesson immediately. What the product does is documented in
[`docs/user-journeys.md`](docs/user-journeys.md).

An interactive HTML prototype of the intended UI is published at
<https://idealkritarat.github.io/tutormatcher-prototype>.

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
starts Postgres and waits for it, installs all dependencies, syncs `schema.prisma`
with the disposable database using `prisma db push`,
and seeds mock data. It is safe to re-run. Start the complete local Compose stack
with `just up` (see [Development](#development)).

`just` recipes work the same on macOS, Linux, and Windows. Recipes that only wrap
npm work show the equivalent `npm run` script in a comment; Compose orchestration
lives in the justfile and has no `npm run` form.

On Windows, `just` runs recipes through the built-in Windows PowerShell and selects
`npm.cmd` automatically, so the commands work from either PowerShell or Command
Prompt without requiring Git Bash or WSL. Docker Desktop is still required for the
Compose recipes.

<details>
<summary>Manual setup, step by step</summary>

```bash
just env                              # node scripts/setup-env.mjs  (copy .env templates)
just db-up                            # start Postgres and wait for it
just install                          # npm run install:all
cd apps/backend
just db-push                          # npm run db:push  (prisma db push)
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
just reset-db         # recreate, seed, and restart the disposable database
```

Use `just reset-db` after a schema change that the existing database cannot accept. It
deletes all local PostgreSQL data, recreates the disposable database, and reseeds it;
unlike `just down`, this command is destructive.

The detached Compose stack uses production-style images and does not hot-reload
source changes; rerun `just up` after changing application code. To run both dev
servers with hot reload attached to the current terminal instead (Ctrl+C stops
both), use `just dev` (`npm run dev`); this assumes Postgres is already running.

The root `.env` file is created from `.env.example` automatically and is read by Docker
Compose. Edit `FRONTEND_PORT` or `BACKEND_PORT` there to avoid port conflicts on your device;
the same file also holds the Compose password-reset delivery mode and Resend settings.
The backend `.env` is a separate file for host development with `just dev`; it uses the local
database URL and defaults to logging reset links.

### Password reset email delivery

The backend uses `EMAIL_DELIVERY_MODE` to make reset-email delivery explicit:

- `log` prints the reset URL in the backend terminal. This is the default in
  development and test environments.
- `resend` sends a real email through Resend. It requires `RESEND_API_KEY`,
  `RESEND_FROM_EMAIL`, and `FRONTEND_URL`.

For the host development flow, `just dev` reads `apps/backend/.env`. Keep the
default `EMAIL_DELIVERY_MODE="log"` for local development, or opt in deliberately:

```ini
EMAIL_DELIVERY_MODE="resend"
RESEND_API_KEY="re_..."
RESEND_FROM_EMAIL="Tutor Matcher <onboarding@resend.dev>"
FRONTEND_URL="http://localhost:3000"
```

Use `onboarding@resend.dev` only for testing and send to the email address that
owns the Resend account. Never commit an API key; `*.env` files are ignored by Git.
The `just up` Compose flow remains production-style and defaults to `resend`, so
configure its Resend credentials explicitly when password-reset email is needed.
Do not add `apps/backend/.env` as a Compose `env_file`: its `DATABASE_URL` points to
`localhost`, while the backend container must connect to the `postgres` service.

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
| `just setup`             | repo root      | First-run: env, Postgres, deps, schema sync, seed   | `npm run setup` (partial) |
| `just install`           | repo root      | Install root + backend + frontend dependencies      | `npm run install:all`     |
| `just env`               | repo root      | Copy missing `.env` files from templates            | `npm run setup:env`       |
| `just up` / `down`       | repo root      | Start / stop the local Compose stack                | —                         |
| `just reset-db`          | repo root      | Recreate, seed, and restart the disposable database | —                         |
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

| `just`                | Description                          | `npm run` equivalent      |
| --------------------- | ------------------------------------ | ------------------------- |
| `just test`           | Backend tests (Jest + Supertest)     | `npm test`                |
| `just test-bdd`       | Backend Gherkin tests (Cucumber.js)  | `npm run test:bdd`        |
| `just lint`           | ESLint on backend source             | `npm run lint`            |
| `just validate`       | Validate `schema.prisma`             | `npm run prisma:validate` |
| `just format`         | Format `schema.prisma`               | `npm run prisma:format`   |
| `just db-push`        | Sync the database without migrations | `npm run db:push`         |
| `just migrate-deploy` | Apply committed migrations (deploy)  | `npm run db:migrate`      |

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
validation succeeds. Full deployment shape and reasoning:
[ADR 0003](docs/adr/decisions.md#0003--docker-compose-deployment-shapes).

## Architecture

| Layer              | Technology                                          | Version |
| ------------------ | --------------------------------------------------- | ------- |
| Frontend           | Next.js (TypeScript, Tailwind CSS)                  | 16.x    |
| Backend            | Express (TypeScript)                                | 5.x     |
| Database           | PostgreSQL                                          | 16      |
| ORM                | Prisma                                              | 7.x     |
| Testing — Frontend | Jest, React Testing Library, jest-environment-jsdom | —       |
| Testing — Backend  | Jest, Supertest, @swc/jest, Cucumber.js             | —       |
| Formatter          | Prettier                                            | 3.x     |
| Container          | Docker Compose                                      | —       |

```
apps/
  backend/        Express API (TypeScript, Prisma, PostgreSQL)
    src/
      lib/        db.ts (Prisma + pg adapter), env.ts, jwt.ts
      middleware/ auth, validate, error-handler
      modules/    one folder per domain area (see "Backend modules" below)
      routes.ts   aggregates module routers, mounted at /api by app.ts
    features/     Cucumber.js features, support code, and step definitions
    prisma/       schema.prisma, seed.ts
  frontend/       Next.js app (TypeScript, Tailwind CSS)
    app/          App Router pages and layouts
docs/             User journeys, schema, testing guide, backlog, ADRs, sources
deploy/           Doco-CD production Compose manifest and secrets
docker-compose.yml  Full local Postgres + backend + frontend stack
```

**Decisions:** see [`docs/adr/decisions.md`](docs/adr/decisions.md) — a separate Express
backend instead of Next.js API routes (0001), this frontend/backend monorepo layout
(0002), and the local vs. production Compose deployment shapes (0003).

**Data flow:**

```
Browser
  └── Next.js (port 3000)
        └── /api/* rewrite → Express API  ── mounted at /api
                               └── PostgreSQL (port 5432)
```

Next.js is CSR-first: components fetch from `/api/*` on their own origin.
`next.config.ts` rewrites `/api/:path*` to `${BACKEND_URL}/api/:path*`, so the browser
never needs a cross-origin base URL. `BACKEND_URL` defaults to `http://localhost:8000`
for running both apps on the host; container builds use `http://backend:8000` instead.
No Next.js server-side data fetching is used for authenticated flows yet (rendering mode
is deferred — see below).

**Route model:** the product's routes and access levels are defined in
[`docs/user-journeys.md`](docs/user-journeys.md#route-model). Guards run before render: a
logged-out user on a protected route goes to `/(auth)/login?next=…`, and a non-tutor on a
tutor route goes to `/(auth)/enroll-tutor`. `apps/frontend/app/` still has some
placeholder route folders named after an older backlog export; the mapping to current
routes is in
[`docs/backlog/reconciliation.md`](docs/backlog/reconciliation.md#3--route-drift).

**Backend modules:** each folder under `apps/backend/src/modules/` owns its HTTP routes,
controllers, business services, and Zod schemas — `auth`, `booking`, `classroom`,
`dashboard`, `discovery`, `health`, `messaging`, `profile`, `review`, `wallet`. They map
onto the journeys in [`docs/user-journeys.md`](docs/user-journeys.md).

**Deferred decisions:**

- **Auth mechanism** — JWT (recommended) vs. session vs. third-party; not yet settled.
  The product also offers Continue with Google, so the choice has to accommodate a
  federated identity alongside email and password.
- **Rendering mode** — CSR vs. SSR vs. hybrid for the public `/search`, `/tutors/:id`,
  and `/tutors/:id/:subjectId` pages, the only routes a logged-out visitor reaches.
- **File storage for tutor verification documents** — local Docker volume vs. MinIO vs.
  URL field. Applies to the government ID and teaching certification uploaded at
  `/(auth)/enroll-tutor`, and to listing photos and intro videos.
- **Slot locking strategy** — the booking flow must block a second student before
  payment capture, not compensate afterwards. See gaps G1 and G2 in
  [`docs/database-schema.md`](docs/database-schema.md#reconciliation-requirement-vs-implementation).

## Documentation

See [`docs/index.md`](docs/index.md) for the full documentation index. Before working on
a product change, read [`docs/user-journeys.md`](docs/user-journeys.md) for what the
product does, [`docs/database-schema.md`](docs/database-schema.md) for what it stores, and
[`CONTEXT.md`](CONTEXT.md) for what to call things. See [`docs/testing.md`](docs/testing.md)
for the testing guide.
