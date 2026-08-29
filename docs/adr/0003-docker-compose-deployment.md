# Docker Compose Deployment Shapes

## Status

The original single-file production target is superseded. Docker Compose remains
the deployment format, but local development and production use different
manifests.

## Decision

The root `docker-compose.yml` runs PostgreSQL, the Express backend, and the
Next.js frontend for local testing. Production uses `deploy/compose.yaml`,
which defines the Next.js frontend and Express backend services and is deployed
by Doco-CD from the Tutor Matcher repository.

Doco-CD polls the repository's `main` branch and deploys the `tutor-matcher`
Swarm stack after repository changes. Images are published by GitHub Actions
with commit SHA and `latest` tags; the deployment configuration enables image
pulling when a Git-triggered deployment occurs.

The production manifest defines PostgreSQL as an internal persistent service and
attaches the frontend and backend to the shared external `observability` network.
It declares SOPS-encrypted Docker secrets for the PostgreSQL password and backend
database URL. Doco-CD decrypts those files before deploying the stack. The
repository stores no plaintext production secret value.
