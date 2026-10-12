# Deployment Environment

Deployment environment files belong in this directory as SOPS-encrypted dotenv files, with
independent secrets in separate files and related Resend settings grouped together. The shared
homelab age recipient is configured in the repository root `.sops.yaml`.
Doco-CD automatically decrypts SOPS-encrypted files in the fetched source before deploying the
Compose project. Compose then combines the listed `env_file` entries for each service.

The example files contain safe placeholder values. Copy them to ignored plaintext files, replace the
placeholders locally, then encrypt each dotenv file with SOPS:

```bash
umask 077
cp deploy/secrets/database-url.env.example deploy/secrets/database-url.env
cp deploy/secrets/resend.env.example deploy/secrets/resend.env
cp deploy/secrets/postgres-password.env.example deploy/secrets/postgres-password.env
${EDITOR:-vi} deploy/secrets/database-url.env deploy/secrets/resend.env \
  deploy/secrets/postgres-password.env

sops --encrypt --input-type dotenv --output-type dotenv \
  --output deploy/secrets/database-url.enc.env deploy/secrets/database-url.env
sops --encrypt --input-type dotenv --output-type dotenv \
  --output deploy/secrets/resend.enc.env deploy/secrets/resend.env
sops --encrypt --input-type dotenv --output-type dotenv \
  --output deploy/secrets/postgres-password.enc.env deploy/secrets/postgres-password.env
rm deploy/secrets/database-url.env deploy/secrets/resend.env \
  deploy/secrets/postgres-password.env
```

Use the same strong password in `DATABASE_URL` and `POSTGRES_PASSWORD`. Set the database host to
`postgres`, username to `postgres`, and database name to `tutor_matcher`. `FRONTEND_URL` is ordinary
deployment configuration supplied through Compose interpolation, not part of the encrypted secret
files. All three Resend settings are kept together in `resend.env`. Edit an encrypted file with
`sops edit deploy/secrets/<name>.enc.env`; changing one independent secret does not require
re-encrypting the other files. Commit only the encrypted `*.enc.env` files.

Do not commit plaintext dotenv files.

The production `compose.yaml` is the single source of truth for deployment and image builds. It explicitly builds the frontend with `BACKEND_URL=http://backend:8000`, publishes the frontend on host port `3333`, runs the backend on port `8000`, and stores PostgreSQL data at `/srv/platform/tutor-matcher/postgres`. GitHub Actions executes those Compose build definitions before publishing the image names declared in the same file.
