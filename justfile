# Tutor Matcher — local development workflow.
#
# Uses `just` (https://just.systems) as a cross-platform command runner so the
# same recipes work on macOS, Linux, and Windows. Every recipe just delegates to
# an `npm run` script in package.json, so there is no shell-specific logic — you
# can also run the `npm run` form directly if you don't have `just`.
#
#   just            list recipes
#   just install    install all dependencies
#   just up         start Postgres + backend + frontend (detached)

# Default recipe: show the list.
default:
    @just --list

# Install root + backend + frontend dependencies.
install:
    npm run install:all

# Start Postgres + backend (3001) + frontend (3000) detached (PM2) — terminal-free; stop with `just down`.
up:
    npm run up

# Stop the backend + frontend background servers.
down:
    npm run down

# Restart the background servers.
restart:
    npm run restart

# Stream logs from the background servers (Ctrl+C to stop watching).
logs:
    npm run logs

# Show status of the background servers.
status:
    npm run status

# Run backend + frontend in the foreground instead (Ctrl+C stops both).
dev:
    npm run dev

# Start the Postgres container.
db-up:
    npm run db:up

# Stop the Postgres container.
db-down:
    npm run db:down
