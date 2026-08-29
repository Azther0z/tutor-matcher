# Tutor Matcher — local development workflow.
#
# Uses `just` (https://just.systems) as a cross-platform command runner so the
# same recipes work on macOS, Linux, and Windows. Every recipe just delegates to
# an `npm run` script in package.json, so there is no shell-specific logic — you
# can also run the `npm run` form directly if you don't have `just`.
#
#   just            list recipes
#   just setup      prepare a fresh checkout (deps, env, db, migrate, seed)
#   just up         start the Postgres + backend + frontend Compose stack

# Default recipe: show the list.
default:
    @just --list

# First-run setup: install deps, copy env files, migrate, seed. Run `just db-up`
# first so Postgres is reachable for migrate/seed. Then start with `just up`.
setup:
    npm run setup

# Install root + backend + frontend dependencies.
install:
    npm run install:all

# Start Postgres + backend (8000) + frontend (3000) detached through Compose.
up:
    npm run up

# Stop and remove the local Compose stack.
down:
    npm run down

# Restart all local Compose services.
restart:
    npm run restart

# Stream logs from the local Compose stack (Ctrl+C to stop watching).
logs:
    npm run logs

# Show status of the local Compose services.
status:
    npm run status

# Run backend + frontend in the foreground instead (Ctrl+C stops both).
dev:
    npm run dev

# Start the Postgres container and wait until it is healthy.
db-up:
    npm run db:up

# Stop the Postgres container.
db-down:
    npm run db:down
