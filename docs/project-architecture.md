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
│       │   ├── lib/            ← db.ts (Prisma + pg adapter), env.ts, jwt.ts
│       │   ├── middleware/     ← auth, validate, error-handler
│       │   ├── modules/        ← one folder per domain area (see below)
│       │   ├── types/
│       │   ├── routes.ts       ← aggregates module routers
│       │   ├── app.ts          ← Express app (no listen — importable by tests)
│       │   └── server.ts       ← Server entry point (calls app.listen)
│       ├── test/
│       │   └── app.test.ts
│       ├── prisma/
│       │   ├── schema.prisma
│       │   └── seed.ts        ← Mock-data seed (@faker-js/faker)
│       ├── justfile           ← Backend Prisma/dev recipes
│       ├── cucumber.cjs
│       └── jest.config.ts
├── deploy/                    ← Doco-CD production deployment
│   ├── compose.yaml           ← Frontend and backend production services
│   ├── README.md              ← Deployment secret instructions
│   └── secrets/               ← SOPS-encrypted deployment secrets
├── docs/                      ← Project documentation
│   ├── adr/                    ← Architecture Decision Records
│   ├── backlog/                ← Git-managed product and sprint backlog
│   ├── sources/                ← Immutable evidence (prototype, exports, Final Report)
│   ├── index.md                ← Documentation entry point
│   ├── user-journeys.md        ← Route model, flows, and product invariants
│   ├── project-schema.md       ← Product data model and schema gap list
│   ├── project-architecture.md
│   ├── project-charter.md
│   └── testing.md
├── .agents/skills/             ← Shared AI agent skills (my-* + prisma-*)
├── .claude/skills/             ← Symlinks → .agents/skills/
├── .doco-cd.yaml               ← Doco-CD deployment settings
├── .sops.yaml                  ← SOPS/age encryption policy
├── docker-compose.yml          ← Full local Postgres + backend + frontend stack
├── scripts/                    ← Repo tooling (environment setup, backlog validation/generation)
├── .prettierrc                 ← Shared Prettier config
├── justfile                    ← Cross-platform dev recipes (setup/up/down/install/…)
└── package.json                ← Root: setup, install, format, backlog build/check, dev scripts
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
        └── /api/* rewrite → Express API  ── mounted at /api
                               └── PostgreSQL (port 5432)
```

Next.js is **CSR-first**: components fetch from `/api/*` on their own origin. `next.config.ts`
rewrites `/api/:path*` to `${BACKEND_URL}/api/:path*`, so the browser never needs a
cross-origin base URL and `BACKEND_URL` is the single knob pointing at the backend. It
defaults to `http://localhost:8000`, which suits running both apps on the host; container
image builds must be given the backend's service address instead (the local Compose build
uses `http://backend:8000`, and the production image uses `http://backend:8000`). No
Next.js server-side data fetching is used for authenticated flows (rendering mode is
deferred).

## Route Model

The product's routes and their access levels are defined in
[`user-journeys.md`](user-journeys.md#route-model). Guards run before render: a
logged-out user on a protected route goes to `/(auth)/login?next=…`, and a non-tutor on
a tutor route goes to `/(auth)/enroll-tutor`.

`apps/frontend/app/` currently holds placeholder pages scaffolded from the older backlog
route names, so six paths do not yet match the product route model — `/booking`,
`/payments`, `/payments/:id`, `/topup`, `/settings`, and `/settings/notification`. The
mapping is in [`backlog/reconciliation.md`](backlog/reconciliation.md#3--route-drift);
rename each folder as its slice is built.

## Backend Modules

Each module under `apps/backend/src/modules/` owns its HTTP routes, controllers,
business services, and Zod schemas. `src/routes.ts` aggregates the routers and `src/app.ts`
mounts them at `/api`. Current modules: `auth`, `booking`, `classroom`, `dashboard`,
`discovery`, `health`, `messaging`, `profile`, `review`, `wallet` — they map onto the
journeys in [`user-journeys.md`](user-journeys.md).

## Development

Common tasks are [`just`](https://just.systems) recipes (repo root and
`apps/backend`). Docker Compose orchestration is implemented directly in the root
justfile; recipes that only wrap npm work delegate to an `npm run` script and so
also work without `just`. See the task reference in [`README.md`](../README.md)
for the full list.

```bash
# First-run only: env files, Postgres, deps, migrate, seed
just setup

# Start Postgres + backend (8000) + frontend (3000) in the background (Compose;
# rebuild after source changes)
just up                 # containers survive closing the terminal
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
exercise the exported Express app from `src/app.ts` without requiring the development server
to be started.
See [Testing](testing.md) for the current coverage and extension conventions.

## Deployment Flow

Production deployment is pull-based and is separate from the root local testing
Compose file:

1. A pull request runs formatting, linting, frontend and backend Jest tests,
   backend Cucumber.js behavior tests, application builds, and production image
   builds in GitHub Actions.
2. A successful push to `main` builds the frontend and backend using the build
   definitions in `deploy/compose.yaml`, then publishes both images to Docker Hub
   with the commit SHA and `latest` tags.
3. Doco-CD polls the Tutor Matcher repository every five minutes. Its main
   instance reads `.doco-cd.yaml`, then deploys `deploy/compose.yaml` as the
   `tutor-matcher` Swarm stack.
4. `force_image_pull: true` makes Doco-CD refresh existing `latest` image tags
   when a repository change triggers deployment.

The former `homelab-gitops/apps/tutor-matcher` deployment was removed so only
the Tutor Matcher repository owns the production stack. The root
`docker-compose.yml` is the complete local testing stack; it is not the
production deployment manifest. `deploy/compose.yaml` is the single source of
truth for the production build contexts, frontend-to-backend service URL, image
names, ports, and runtime services.

Deployment secrets are intended to be SOPS-encrypted with age. The repository
contains the policy and templates under `deploy/secrets/`. Production Compose
references encrypted backend and PostgreSQL secret files, which Doco-CD
decrypts before starting the services. PostgreSQL is internal to the stack and
uses a persistent named volume.

## Deferred Decisions

- **Auth mechanism** — JWT (recommended) vs session vs third-party; not yet settled.
  The product also offers Continue with Google, so the choice has to accommodate a
  federated identity alongside email and password.
- **Rendering mode** — CSR vs SSR vs hybrid for the public `/search`, `/tutors/:id`, and
  `/tutors/:id/:subjectId` pages, which are the only routes a logged-out visitor reaches.
- **File storage for tutor verification documents** — local Docker volume vs MinIO vs
  URL field. Applies to the government ID and teaching certification uploaded at
  `/(auth)/enroll-tutor`, and to listing photos and intro videos. (This decision was
  previously recorded as "file storage for transfer proof"; the product has no
  transfer-proof upload — money moves through the wallet.)
- **Slot locking strategy** — the booking flow must block a second student before
  payment capture, not compensate afterwards. See gaps G1 and G2 in
  [`project-schema.md`](project-schema.md#reconciliation-requirement-vs-implementation).
