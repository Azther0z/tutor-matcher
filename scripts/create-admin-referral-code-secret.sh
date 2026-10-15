#!/usr/bin/env bash

set -Eeuo pipefail
umask 077

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if ! repo_root="$(git -C "$script_dir/.." rev-parse --show-toplevel 2>/dev/null)"; then
  printf 'Run this script from a Tutor Matcher checkout.\n' >&2
  exit 1
fi

cd "$repo_root"

secret_dir="deploy/secrets"
encrypted_file="$secret_dir/admin-signup-key.enc.env"
plaintext_file="$secret_dir/admin-signup-key.env"

for command_name in openssl sops; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf 'Required command not found: %s\n' "$command_name" >&2
    exit 1
  fi
done

if [[ ! -f .sops.yaml ]]; then
  printf 'Missing .sops.yaml; cannot select the repository encryption recipient.\n' >&2
  exit 1
fi

if [[ -e "$plaintext_file" ]]; then
  printf 'Refusing to continue: %s already exists. Secure or remove it first.\n' "$plaintext_file" >&2
  exit 1
fi

if [[ -e "$encrypted_file" ]]; then
  printf '%s already exists; use `sops edit %s` to change it.\n' \
    "$encrypted_file" "$encrypted_file" >&2
  exit 1
fi

if [[ ! -t 0 || ! -t 1 ]]; then
  printf 'Run this script in a terminal so you can copy the generated referral code safely.\n' >&2
  exit 1
fi

read -r -p 'Generate and encrypt a new production referral code? [y/N] ' confirmation
case "$confirmation" in
  [Yy]|[Yy][Ee][Ss]) ;;
  *)
    printf 'Cancelled.\n'
    exit 0
    ;;
esac

mkdir -p -- "$secret_dir"
temporary_plaintext=""
temporary_encrypted=""
referral_code=""

cleanup() {
  if [[ -n "$temporary_plaintext" ]]; then
    rm -f -- "$temporary_plaintext" 2>/dev/null || true
  fi
  if [[ -n "$temporary_encrypted" ]]; then
    rm -f -- "$temporary_encrypted" 2>/dev/null || true
  fi
  unset referral_code
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

temporary_plaintext="$(mktemp "$secret_dir/.admin-signup-key.XXXXXX.env")"
temporary_encrypted="$(mktemp "$secret_dir/.admin-signup-key.enc.XXXXXX.env")"
referral_code="$(openssl rand -hex 32)"
if [[ ! "$referral_code" =~ ^[[:xdigit:]]{64}$ ]]; then
  printf 'OpenSSL did not return the expected 64-character code.\n' >&2
  exit 1
fi

printf 'ADMIN_SIGNUP_KEY=%s\n' "$referral_code" > "$temporary_plaintext"
sops --encrypt --input-type dotenv --output-type dotenv \
  --output "$temporary_encrypted" "$temporary_plaintext"

if [[ ! -s "$temporary_encrypted" ]]; then
  printf 'SOPS did not create the encrypted file.\n' >&2
  exit 1
fi

if [[ -e "$encrypted_file" ]]; then
  printf '%s appeared while the script was running; refusing to overwrite it.\n' "$encrypted_file" >&2
  exit 1
fi

chmod 600 "$temporary_encrypted"
mv -- "$temporary_encrypted" "$encrypted_file"

printf 'Created %s\n' "$encrypted_file"
printf 'Copy this referral code into your password manager; it is shown only now:\n%s\n' \
  "$referral_code"
printf 'Commit only the encrypted file. After creating the Admin account, empty ADMIN_SIGNUP_KEY with `sops edit` and redeploy.\n'
