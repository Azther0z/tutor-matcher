#!/usr/bin/env bash
# Checks that deploy/compose.yaml keeps the production wiring Doco-CD expects.
# Usage: .github/scripts/validate-deploy-compose.sh [compose file, default deploy/compose.yaml]
set -euo pipefail

compose_file="${1:-deploy/compose.yaml}"
cd "$(dirname "$compose_file")"
compose_file="$(basename "$compose_file")"

docker compose -f "$compose_file" config --no-env-resolution --quiet
config="$(docker compose -f "$compose_file" config --no-env-resolution --format json)"
# Compose v2 copies env-file variables into `environment` and drops `env_file`, while v5 prints
# `{path: ...}` objects. Read the env files from the source file so either version works.
source_file="$(yq -o=json '.' "$compose_file")"

errors="$(
  jq -rn --argjson config "$config" --argjson source "$source_file" '
    # env_file may be one string, a list of strings, or a list of {path, required}.
    def env_files($service):
      ($source.services[$service].env_file // [])
      | if type == "array" then . else [.] end
      | map(if type == "string" then . else .path end | split("/")[-1]);
    def check($ok; $message): if $ok then empty else $message end;
    def equals($path; $actual; $expected):
      check($actual == $expected; "\($path) must be \($expected | tojson), got \($actual | tojson)");
    def env_files_check($service; $required; $optional):
      env_files($service) as $files
      | (($required - $files) | map("services.\($service).env_file is missing \(.)")[]),
        (($files - $required - $optional)
          | map("services.\($service).env_file has unexpected \(.); allowed: \($required + $optional | join(", "))")[]);

    equals("services.frontend.image"; $config.services.frontend.image;
      "docker.io/azther0z/tutor-matcher-frontend:latest"),
    equals("services.frontend.build.args.BACKEND_URL"; $config.services.frontend.build.args.BACKEND_URL;
      "http://backend:8000"),
    equals("services.frontend.ports[0].target"; $config.services.frontend.ports[0].target; 3000),
    equals("services.frontend.ports[0].published"; $config.services.frontend.ports[0].published; "3333"),
    equals("services.backend.image"; $config.services.backend.image;
      "docker.io/azther0z/tutor-matcher-backend:latest"),
    equals("services.backend.ports[0].target"; $config.services.backend.ports[0].target; 8000),
    equals("services.backend.ports[0].published"; $config.services.backend.ports[0].published; "8000"),
    env_files_check("backend"; ["database-url.enc.env", "resend.enc.env"]; ["admin-signup-key.enc.env"]),
    env_files_check("postgres"; ["postgres-password.enc.env"]; [])
  '
)"

if [ -n "$errors" ]; then
  while IFS= read -r error; do
    echo "::error file=deploy/compose.yaml::$error"
  done <<< "$errors"
  exit 1
fi
echo "deploy/compose.yaml keeps the expected images, ports, build args and env files."
