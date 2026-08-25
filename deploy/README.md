# Deployment Secrets

Deployment secrets belong in this directory as SOPS-encrypted files. The shared homelab age recipient is configured in the repository root `.sops.yaml`.

Create the backend secret locally:

```bash
cp deploy/secrets/backend.env.example deploy/secrets/backend.env
${EDITOR:-vi} deploy/secrets/backend.env
sops --encrypt --input-type dotenv --output deploy/secrets/backend.env.enc deploy/secrets/backend.env
rm deploy/secrets/backend.env
```

Do not commit plaintext secret files. The encrypted file can be referenced by Doco-CD once the production database connection is provisioned.
