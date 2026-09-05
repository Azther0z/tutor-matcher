# Deployment Secrets

Deployment secrets belong in this directory as SOPS-encrypted files. The shared homelab age recipient is configured in the repository root `.sops.yaml`. Doco-CD decrypts the referenced files before creating the Docker secrets.

Create the backend and PostgreSQL secrets locally:

```bash
cp deploy/secrets/backend_database_url.example deploy/secrets/backend_database_url
${EDITOR:-vi} deploy/secrets/backend_database_url
sops --encrypt --input-type binary --output-type binary --output deploy/secrets/backend_database_url.enc deploy/secrets/backend_database_url
rm deploy/secrets/backend_database_url

cp deploy/secrets/postgres_password.example deploy/secrets/postgres_password
${EDITOR:-vi} deploy/secrets/postgres_password
sops --encrypt --input-type binary --output-type binary --output deploy/secrets/postgres_password.enc deploy/secrets/postgres_password
rm deploy/secrets/postgres_password
```

Set the `DATABASE_URL` host to `postgres`, use the `postgres` username and `tutor_matcher` database, and use the same password in the URL and PostgreSQL password file. Do not commit plaintext secret files. Commit the encrypted `deploy/secrets/backend_database_url.enc` and `deploy/secrets/postgres_password.enc` files. The backend reads its Docker secret through `DATABASE_URL_FILE`; PostgreSQL reads its password through `POSTGRES_PASSWORD_FILE`.

The production `compose.yaml` is the single source of truth for deployment and image builds. The gateway publishes host port `3333`, routes `/` to the frontend on `3000`, and routes `/api/*` to the backend on `8000`; the frontend and backend ports are internal to the Compose network. `Caddyfile` contains the gateway routing used by the Cloudflare Tunnel origin. GitHub Actions executes the Compose build definitions before publishing the image names declared in the same file.
