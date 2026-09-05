# Docker Compose Deployment Shapes

## Status

The original single-file production target is superseded. Docker Compose remains
the deployment format, but local development and production use different
manifests.

## Decision

The root `docker-compose.yml` runs PostgreSQL, the Express backend, and the
Next.js frontend for local testing. Production uses `deploy/compose.yaml`,
which defines the Next.js frontend and Express backend services and is deployed
by Doco-CD from the Tutor Matcher repository. The production manifest is also the
source of truth for image build contexts, the frontend's compiled backend service
URL (`http://backend:8000`), image names, and published ports.

Doco-CD polls the repository's `main` branch and deploys the `tutor-matcher`
Swarm stack after repository changes. A single GitHub Actions workflow builds the
production services from that manifest and publishes images with commit SHA and
`latest` tags; the deployment configuration enables image pulling when a
Git-triggered deployment occurs.

The production manifest defines PostgreSQL as an internal persistent service. It
references SOPS-encrypted dotenv files through Compose `env_file` entries for the
PostgreSQL password and backend database URL. Doco-CD decrypts those files before
deploying the stack, and Compose passes the resulting variables directly to each
service. PostgreSQL data is stored at `/srv/platform/tutor-matcher/postgres` on the
deployment host. The repository stores no plaintext production secret value.
