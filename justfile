# Tutor Matcher — local development workflow.
#
# Uses `just` (https://just.systems) as a cross-platform command runner so the
# same recipes work on macOS, Linux, and Windows.
#
# Container orchestration lives here and calls `docker compose` directly. The
# recipes that only wrap npm work (`setup`, `install`, `dev`) delegate to the
# matching `npm run` script, so those stay runnable without `just`.
#
#   just            list recipes
#   just setup      prepare a fresh checkout (env, Postgres, deps, migrate, seed)
#   just up         start the Postgres + backend + frontend Compose stack

# Default recipe: show the list.
default:
    @just --list

# Copy missing .env files from their .env.example templates.
env:
    node scripts/setup-env.mjs

# First-run setup: env files, Postgres, deps, migrate, seed. Then run `just up`.
setup: db-up
    npm run setup

# Install root + backend + frontend dependencies.
install:
    npm run install:all

# Build and start Postgres + backend (8000) + frontend (3000), detached.
up: env
    docker compose up -d --build --wait

# Stop and remove the local Compose stack.
down:
    docker compose down

# Restart the local Compose services.
restart:
    docker compose restart

# Stream Compose logs; pass a service to narrow, e.g. `just logs backend`.
logs *SERVICE:
    docker compose logs -f {{ SERVICE }}

# Show status of the local Compose services.
status:
    docker compose ps

# Run backend + frontend in the foreground instead (Ctrl+C stops both).
dev:
    npm run dev

# Start the Postgres container and wait until it is healthy.
db-up: env
    docker compose up -d --wait postgres

# Stop the Postgres container.
db-down:
    docker compose stop postgres
