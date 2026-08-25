# Project Architecture — Tutor Matcher

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend | Next.js (TypeScript, Tailwind CSS) | 16.x |
| Backend | Express (TypeScript) | 5.x |
| Database | PostgreSQL | 16 |
| ORM | Prisma | 7.x |
| Testing — Frontend | Jest, React Testing Library, jest-environment-jsdom | — |
| Testing — Backend | Jest, Supertest, @swc/jest | — |
| Formatter | Prettier | 3.x |
| Container | Docker Compose | — |

## Repository Layout

```
tutor-matcher/                  ← monorepo root
├── apps/
│   ├── frontend/               ← Next.js app
│   │   ├── app/                ← App Router pages and layouts
│   │   ├── jest.config.ts
│   │   └── jest.setup.ts
│   └── backend/                ← Express API
│       ├── src/
│       │   ├── controllers/    ← Route handlers (one file per domain)
│       │   ├── lib/
│       │   │   └── db.ts       ← Prisma client singleton
│       │   ├── middleware/     ← Auth, error handler, etc.
│       │   ├── routes/         ← Express routers
│       │   ├── app.ts          ← Express app (no listen — importable by tests)
│       │   └── index.ts        ← Server entry point (calls app.listen)
│       ├── prisma/
│       │   └── schema.prisma
│       └── jest.config.js
├── docs/                       ← Project documentation
│   ├── adr/                    ← Architecture Decision Records
│   ├── project-architecture.md
│   ├── project-charter.md
│   └── project-schema.md
├── .agents/skills/             ← Shared AI agent skills (my-* + prisma-*)
├── .claude/skills/             ← Symlinks → .agents/skills/
├── docker-compose.yml          ← Postgres service for local development
├── .prettierrc                 ← Shared Prettier config
└── package.json                ← Root: format/format:check scripts
```

## Architecture Decisions

See `docs/adr/` for full records. Summary:

| Decision | Choice | ADR |
|---|---|---|
| API layer | Separate Express backend (not Next.js API routes) | 0001 |
| Repository | Monorepo — `/apps/frontend` + `/apps/backend` | 0002 |
| Deployment | Single `docker-compose.yml` | 0003 |

## Data Flow

```
Browser
  └── Next.js (port 3000)
        └── fetch / axios → Express API (port 3001)
                              └── Prisma → PostgreSQL (port 5432)
```

Next.js is **CSR-first**: the browser calls the Express API directly. No Next.js server-side data fetching is used for authenticated flows (rendering mode is deferred).

## Development

```bash
# Start Postgres
docker-compose up -d

# Backend (port 3001)
cd apps/backend && npm run dev

# Frontend (port 3000)
cd apps/frontend && npm run dev

# Run tests
cd apps/backend && npm test
cd apps/frontend && npm test

# Format all files
npm run format          # from repo root
```

## Deferred Decisions

- **Auth mechanism** — JWT (recommended) vs session vs third-party; not yet settled.
- **Rendering mode** — CSR vs SSR vs hybrid for public tutor-search pages.
- **File storage for transfer proof** — local Docker volume vs MinIO vs URL field.
