# Architecture Decision Records

Short records of decisions that shaped the repository, kept in one file because each one
is a few sentences. Numbers are stable IDs; append new decisions rather than renumbering.

---

## 0001 · Separate Express Backend Instead of Next.js API Routes

The application uses a standalone Express server as the API layer rather than Next.js API
routes or Server Actions. Next.js handles UI and routing only; all data access goes
through Express. This keeps the API independently deployable and independently testable,
and it was the decided starting point for the project.

---

## 0002 · Monorepo Layout with Frontend and Backend Apps

The repository holds the Next.js frontend and Express backend under `apps/frontend` and
`apps/backend` in a single monorepo. The root `docker-compose.yml` orchestrates
PostgreSQL and production-style local containers for both application services.
Production uses the separate `deploy/compose.yaml` manifest for the frontend and backend
images. This layout was chosen over two repositories because the team is small, the
services are tightly coupled, and a shared repository simplifies development workflow and
deployment configuration.

---

## 0003 · Docker Compose Deployment Shapes

**Status:** the original single-file production target is superseded. Docker Compose
remains the deployment format, but local development and production use different
manifests.

**Decision:** the root `docker-compose.yml` runs PostgreSQL, the Express backend, and the
Next.js frontend for local testing. Production uses `deploy/compose.yaml`, which defines
the Next.js frontend and Express backend services and is deployed by Doco-CD from the
Tutor Matcher repository. The production manifest is also the source of truth for image
build contexts, the frontend's compiled backend service URL (`http://backend:8000`),
image names, and published ports.

Doco-CD polls the repository's `main` branch and deploys the `tutor-matcher` Swarm stack
after repository changes. A single GitHub Actions workflow builds the production services
from that manifest and publishes images with commit SHA and `latest` tags; the deployment
configuration enables image pulling when a Git-triggered deployment occurs.

The production manifest defines PostgreSQL as an internal persistent service. It
references SOPS-encrypted dotenv files through Compose `env_file` entries for the
PostgreSQL password and backend database URL. Doco-CD decrypts those files before
deploying the stack, and Compose passes the resulting variables directly to each service.
PostgreSQL data is stored at `/srv/platform/tutor-matcher/postgres` on the deployment
host. The repository stores no plaintext production secret value.
