# Monorepo Layout with /frontend and /backend Packages

The repository holds both the Next.js frontend and the Express backend as packages within a single monorepo (`/frontend`, `/backend`). A single `docker-compose.yml` at the root orchestrates both services together with Postgres. This was chosen over two separate repos because the team is small, the services are tightly coupled, and a shared repo simplifies docker-compose wiring and type sharing.
