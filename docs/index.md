# Documentation Index

Start here. This page tells you which document to open and which one to trust when two
disagree.

## Read these first

| Document                                   | Answers                                                                              |
| ------------------------------------------ | ------------------------------------------------------------------------------------ |
| [`user-journeys.md`](user-journeys.md)     | What the product is, who it's for, and what it does — overview, routes, flows, rules |
| [`database-schema.md`](database-schema.md) | What it stores, and where storage does not match a flow yet                          |
| [`CONTEXT.md`](../CONTEXT.md)              | What each concept is called, and what not to call it                                 |

## Where to find things

| You need...                              | Go to                                                                        |
| ---------------------------------------- | ---------------------------------------------------------------------------- |
| Product behaviour (routes, rules, flows) | [`user-journeys.md`](user-journeys.md) — the source of truth                 |
| Product goals, roles, and scope          | [`user-journeys.md`](user-journeys.md#overview-and-scope)                    |
| What work is planned or in progress      | [`backlog/`](backlog/) — start with [`backlog/README.md`](backlog/README.md) |
| The database schema and its known gaps   | [`database-schema.md`](database-schema.md)                                   |
| Tech stack, repo layout, deployment      | [`../README.md`](../README.md#architecture)                                  |
| How to run and write tests               | [`testing.md`](testing.md)                                                   |
| Why a technical decision was made        | [`adr/decisions.md`](adr/decisions.md)                                       |
| Setup and common commands                | [`../README.md`](../README.md)                                               |
| Domain vocabulary                        | [`CONTEXT.md`](../CONTEXT.md)                                                |
| Raw evidence a doc above was built from  | [`sources/`](sources/) — read-only, see below                                |

## What is authoritative

- [`user-journeys.md`](user-journeys.md) is the single source of truth for **what the
  product does**. If any other document disagrees with it, `user-journeys.md` wins.
- [`../apps/backend/prisma/schema.prisma`](../apps/backend/prisma/schema.prisma) is the
  source of truth for **what the database contains today**. [`database-schema.md`](database-schema.md)
  documents it and tracks the gap between it and `user-journeys.md`.
- The Git-managed backlog under [`backlog/`](backlog/) is the source of truth for
  **committed work** — see [`backlog/README.md`](backlog/README.md) for how it is
  structured and checked.

## What is historical, not current

[`sources/`](sources/) is immutable evidence: the clickable prototype, the original
backlog export, and the database-course Final Report. Do not build features from it —
read the "authoritative" list above instead. It is never edited, only read; the Final
Report's design reasoning (not its schema) is summarized in
[`database-schema.md`](database-schema.md#historical-the-final-report).

## Documentation rules

- `docs/` is the only human-facing documentation tree. Keep new pages here, not scattered
  elsewhere in the repo.
- `docs/sources/` is immutable. Summarize it in a canonical page above; never rewrite it.
- Before writing a new page, check this index and the "Read these first" table — most
  questions already have a home. Extend an existing page before creating a new one.
- Keep this index accurate: if you add, move, or remove a document under `docs/`, update
  the table it belongs in and check that every link on this page still resolves.

## Known gaps

Things the product needs but does not yet have an answer for:

- API routes and request/response contracts are not documented separately from the code.
- The authentication mechanism (JWT vs. session vs. federated login) is not settled — see
  [`../README.md`](../README.md#architecture).
- The cancellation penalty window, the earnings clearing period, and the platform fee are
  read off prototype copy and still need product sign-off — see
  [`user-journeys.md`](user-journeys.md#4--money).
- Whether lesson rescheduling is in scope at all is still open — see
  [`backlog/reconciliation.md`](backlog/reconciliation.md).
- File storage for tutor verification documents is not chosen yet.
- Most product flows have no automated behaviour-test coverage yet — see
  [`testing.md`](testing.md#current-coverage-boundary).
