# Deployment Environment

Deployment environment files belong in this directory as SOPS-encrypted dotenv files. The shared
homelab age recipient is configured in the repository root `.sops.yaml`. Doco-CD decrypts referenced
`env_file` entries before deploying the Compose project.

Create the backend and PostgreSQL dotenv files locally:

```bash
cp deploy/secrets/backend.env.example deploy/secrets/backend.env
${EDITOR:-vi} deploy/secrets/backend.env
sops --encrypt --input-type dotenv --output-type dotenv --output deploy/secrets/backend.enc.env deploy/secrets/backend.env
rm deploy/secrets/backend.env

cp deploy/secrets/postgres.env.example deploy/secrets/postgres.env
${EDITOR:-vi} deploy/secrets/postgres.env
sops --encrypt --input-type dotenv --output-type dotenv --output deploy/secrets/postgres.enc.env deploy/secrets/postgres.env
rm deploy/secrets/postgres.env
```

Replace both `POSTGRES_PASSWORD` placeholders with the same password. Set the `DATABASE_URL` host
to `postgres`, use the `postgres` username and `tutor_matcher` database, and commit only the
encrypted `deploy/secrets/backend.enc.env` and `deploy/secrets/postgres.enc.env` files. Doco-CD
decrypts these files and Compose passes `DATABASE_URL` and `POSTGRES_PASSWORD` directly to the
corresponding services.

Do not commit plaintext dotenv files.

The production `compose.yaml` is the single source of truth for deployment and image builds. It explicitly builds the frontend with `BACKEND_URL=http://backend:8000`, publishes the frontend on host port `3333`, runs the backend on port `8000`, and stores PostgreSQL data at `/srv/platform/tutor-matcher`. GitHub Actions executes those Compose build definitions before publishing the image names declared in the same file.
