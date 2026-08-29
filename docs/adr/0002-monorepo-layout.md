# Monorepo Layout with Frontend and Backend Apps

The repository holds the Next.js frontend and Express backend under `apps/frontend`
and `apps/backend` in a single monorepo. The root `docker-compose.yml` orchestrates
PostgreSQL and production-style local containers for both application services.
Production uses the separate `deploy/compose.yaml` manifest for the frontend and
backend images. This layout was chosen over two repositories because the team is
small, the services are tightly coupled, and a shared repository simplifies
development workflow and deployment configuration.
