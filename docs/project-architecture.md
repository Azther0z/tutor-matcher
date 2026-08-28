# Project Architecture — Tutor Matcher

## Tech Stack

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

## Repository Layout

```
tutor-matcher/                  ← monorepo root
├── apps/
│   ├── frontend/               ← Next.js app
│   │   ├── app/                ← App Router pages and layouts
│   │   ├── jest.config.ts
│   │   └── jest.setup.ts
│   └── backend/                ← Express API
│       ├── features/           ← Cucumber.js behavior tests
│       │   ├── step_definitions/
│       │   ├── support/
│       │   └── health.feature
│       ├── src/
│       │   ├── controllers/    ← Route handlers (one file per domain)
│       │   ├── lib/
│       │   │   └── db.ts       ← PostgreSQL connection pool
│       │   ├── middleware/     ← Auth, error handler, etc.
│       │   ├── routes/         ← Express routers
│       │   ├── apps.ts         ← Express app (no listen — importable by tests)
│       │   └── server.ts       ← Server entry point (calls app.listen)
│       ├── test/
│       │   └── app.test.ts
│       ├── prisma/
│       │   ├── schema.prisma
│       │   └── seed.ts        ← Mock-data seed (@faker-js/faker)
│       ├── justfile           ← Backend Prisma/dev recipes
│       ├── cucumber.cjs
│       └── jest.config.js
├── deploy/                    ← Doco-CD production deployment
│   ├── compose.yaml           ← Frontend and backend production services
│   ├── README.md              ← Deployment secret instructions
│   └── secrets/               ← SOPS-encrypted deployment secrets
├── docs/                      ← Project documentation
│   ├── adr/                    ← Architecture Decision Records
│   ├── project-architecture.md
│   ├── project-charter.md
│   ├── project-schema.md
│   └── testing.md
├── .agents/skills/             ← Shared AI agent skills (my-* + prisma-*)
├── .claude/skills/             ← Symlinks → .agents/skills/
├── .doco-cd.yaml               ← Doco-CD deployment settings
├── .sops.yaml                  ← SOPS/age encryption policy
├── docker-compose.yml          ← Postgres service for local development
├── ecosystem.config.js         ← PM2 config: backend + frontend background dev servers
├── scripts/                    ← Repo tooling (setup-env.mjs: copy .env templates)
├── .prettierrc                 ← Shared Prettier config
├── justfile                    ← Cross-platform dev recipes (setup/up/down/install/…)
└── package.json                ← Root: setup + format + up/down/dev/db:* scripts
```

## Architecture Decisions

See `docs/adr/` for full records. Summary:

| Decision   | Choice                                                          | ADR  |
| ---------- | --------------------------------------------------------------- | ---- |
| API layer  | Separate Express backend (not Next.js API routes)               | 0001 |
| Repository | Monorepo — `/apps/frontend` + `/apps/backend`                   | 0002 |
| Deployment | Doco-CD polls this repository and deploys `deploy/compose.yaml` | 0003 |

## Data Flow

```
Browser
  └── Next.js (port 3000)
        └── fetch / axios → Express API (port 8000)
                              └── PostgreSQL (port 5432)
```

Next.js is **CSR-first**: the browser calls the Express API directly. No Next.js server-side data fetching is used for authenticated flows (rendering mode is deferred).

## Development

Common tasks are wrapped as [`just`](https://just.systems) recipes (repo root and
`apps/backend`), each a thin alias over an `npm run` script so they also work
without `just`. See the task reference in [`README.md`](../README.md) for the full
list.

```bash
# First-run only: deps, env files, Postgres (wait for healthy), migrate, seed
just setup               # or: npm run setup

# Start Postgres + backend (8000) + frontend (3000) in the background (PM2)
just up                 # or: npm run up   — servers survive closing the terminal
just logs               # stream output
just down               # stop them

# Or run backend + frontend attached to the terminal (Ctrl+C stops both)
just dev                # or: npm run dev

# Seed the database with fake data
cd apps/backend && just gen-mock-data     # or: npm run gen-mock-data

# Run tests
cd apps/backend && npm test
cd apps/backend && npm run test:bdd
cd apps/frontend && npm test

# Format all files
npm run format          # from repo root
```

Jest and Supertest provide the conventional backend test suite. Cucumber.js provides the
backend behavior suite from Gherkin features and TypeScript step definitions. Both suites
exercise the exported Express app from `src/apps.ts` without requiring the development server
to be started.
See [Testing](testing.md) for the current coverage and extension conventions.

## Deployment Flow

Production deployment is pull-based and is separate from the root development
Compose file:

1. A pull request runs formatting, linting, frontend and backend Jest tests,
   backend Cucumber.js behavior tests, application builds, and Docker image
   builds in GitHub Actions.
2. A successful push to `main` publishes frontend and backend images to Docker
   Hub with both the commit SHA and `latest` tags.
3. Doco-CD polls the Tutor Matcher repository every five minutes. Its main
   instance reads `.doco-cd.yaml`, then deploys `deploy/compose.yaml` as the
   `tutor-matcher` Swarm stack.
4. `force_image_pull: true` makes Doco-CD refresh existing `latest` image tags
   when a repository change triggers deployment.

The former `homelab-gitops/apps/tutor-matcher` deployment was removed so only
the Tutor Matcher repository owns this stack. The root `docker-compose.yml`
remains the local PostgreSQL development setup; it is not the production
deployment manifest.

Deployment secrets are intended to be SOPS-encrypted with age. The repository
contains the policy and template under `deploy/secrets/`, but the encrypted
backend environment file is not yet connected to the production Compose file.

## Deferred Decisions

- **Auth mechanism** — JWT (recommended) vs session vs third-party; not yet settled.
- **Rendering mode** — CSR vs SSR vs hybrid for public tutor-search pages.
- **File storage for transfer proof** — local Docker volume vs MinIO vs URL field.
