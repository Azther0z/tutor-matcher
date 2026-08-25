# Docker Compose Deployment Shapes

## Status

The original single-file production target is superseded. Docker Compose remains
the deployment format, but local development and production use different
manifests.

## Decision

The root `docker-compose.yml` runs PostgreSQL for local development. Production
uses `deploy/compose.yaml`, which defines the Next.js frontend and Express
backend services and is deployed by Doco-CD from the Tutor Matcher repository.

Doco-CD polls the repository's `main` branch and deploys the `tutor-matcher`
Swarm stack after repository changes. Images are published by GitHub Actions
with commit SHA and `latest` tags; the deployment configuration enables image
pulling when a Git-triggered deployment occurs.

The production manifest intentionally does not define PostgreSQL. The backend
deployment secret is currently only scaffolded through the repository's
SOPS/age policy and example file; wiring the encrypted environment file into
production remains open.
