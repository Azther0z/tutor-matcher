#!/bin/sh
set -eu

if [ -n "${DATABASE_URL_FILE:-}" ]; then
  if [ ! -r "$DATABASE_URL_FILE" ]; then
    echo "DATABASE_URL_FILE is not readable: $DATABASE_URL_FILE" >&2
    exit 1
  fi

  DATABASE_URL="$(cat "$DATABASE_URL_FILE")"
  export DATABASE_URL
fi

exec "$@"
