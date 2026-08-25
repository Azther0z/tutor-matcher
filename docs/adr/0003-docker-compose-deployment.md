# Single docker-compose Deployment

All services — Next.js frontend, Express backend, and Postgres — are run together via a single `docker-compose.yml`. This is the target deployment shape for the project. No cloud-managed services or separate hosting platforms are used; everything runs in containers on one host.
