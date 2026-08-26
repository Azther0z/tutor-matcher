# Tutor Matcher

A matchmaking platform that connects tutors and students by subject, schedule, and price.

## Prerequisites

- Node.js 20+
- Docker + Docker Compose

## Setup

1. **Clone and install dependencies**

   ```bash
   git clone https://github.com/Azther0z/tutor-matcher.git
   cd tutor-matcher

   # Install root tooling (Prettier, Husky)
   npm install

   # Install backend dependencies (also runs prisma generate via postinstall)
   cd apps/backend && npm install && cd ../..

   # Install frontend dependencies
   cd apps/frontend && npm install && cd ../..
   ```

2. **Configure environment variables**

   ```bash
   cp apps/backend/.env.example apps/backend/.env
   cp apps/frontend/.env.local.example apps/frontend/.env.local
   ```

   Edit the copied files if your local setup differs from the defaults.

3. **Start Postgres**

   ```bash
   docker-compose up -d
   ```

4. **Apply database migrations**

   ```bash
   cd apps/backend
   npx prisma migrate dev
   ```

## Development

Run each in a separate terminal:

```bash
# Backend (port 3001)
cd apps/backend && npm run dev

# Frontend (port 3000)
cd apps/frontend && npm run dev
```

## Commands

| Command                  | Location        | Description                                |
| ------------------------ | --------------- | ------------------------------------------ |
| `npm run dev`            | `apps/backend`  | Start Express with hot reload              |
| `npm run dev`            | `apps/frontend` | Start Next.js dev server                   |
| `npm test`               | `apps/backend`  | Run backend tests (Jest + Supertest)       |
| `npm run test:bdd`       | `apps/backend`  | Run backend Gherkin tests (Cucumber.js)    |
| `npm test`               | `apps/frontend` | Run frontend tests (Jest + RTL)            |
| `npm run lint`           | `apps/backend`  | Run ESLint on backend source               |
| `npm run format`         | repo root       | Format all files with Prettier             |
| `npm run format:check`   | repo root       | Check formatting without writing           |
| `npx prisma studio`      | `apps/backend`  | Open Prisma database browser               |
| `npx prisma migrate dev` | `apps/backend`  | Create and apply a new migration           |
| `npm run db:migrate`     | `apps/backend`  | Apply committed migrations in a deployment |

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
