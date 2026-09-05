# Documentation Index

This index is the entry point for project documentation and evidence-backed
knowledge. It uses a repository-specific layout rather than the default
root-level `raw/` and `wiki/` layout assumed by the wiki skill.

## Where Information Belongs

| Location                      | Purpose                                                                                       | Authority                   |
| ----------------------------- | --------------------------------------------------------------------------------------------- | --------------------------- |
| [`README.md`](../README.md)   | Setup, common commands, and repository orientation                                            | Maintained onboarding guide |
| `docs/`                       | Project requirements, architecture, decisions, contracts, operations, and canonical knowledge | Documentation authority     |
| [`CONTEXT.md`](../CONTEXT.md) | Canonical domain vocabulary and terms to avoid                                                | Vocabulary authority        |
| [`sources/`](sources/)        | Immutable source material and knowledge operation log                                         | Evidence authority          |

`docs/` is the single human-facing documentation tree. `docs/sources/` remains
immutable evidence; canonical pages may summarize it but must not rewrite it.

## Start Here

Read these three, in order, before working on a product change. Together they answer
what the product does, what it stores, and what it calls things.

| Document                                 | Answers                                                    |
| ---------------------------------------- | ---------------------------------------------------------- |
| [`user-journeys.md`](user-journeys.md)   | What the product does — routes, flows, states, invariants  |
| [`project-schema.md`](project-schema.md) | What it stores, and where the schema does not cover a flow |
| [`CONTEXT.md`](../CONTEXT.md)            | What each concept is called, and what not to call it       |

## Project Documentation

The Git-managed backlog contract is [`backlog/README.md`](backlog/README.md).

| Document                                                             | Purpose                                                                                 | Status                                       |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------- |
| [`project-charter.md`](project-charter.md)                           | Product purpose, goals, roles, and scope                                                | Current baseline                             |
| [`user-journeys.md`](user-journeys.md)                               | Route model, access rules, end-to-end flows, and product invariants                     | Current baseline                             |
| [`project-schema.md`](project-schema.md)                             | Product data model, implemented tables, integrity rules, and the requirement gap list   | Current baseline                             |
| [`backlog/reconciliation.md`](backlog/reconciliation.md)             | Delta between the product backlog and the current product definition                    | Open actions for the team                    |
| [`project-architecture.md`](project-architecture.md)                 | Technology stack, repository layout, data flow, deployment flow, and deferred decisions | Current baseline                             |
| [`testing.md`](testing.md)                                           | Test suites, Gherkin layout, commands, conventions, and CI enforcement                  | Current baseline                             |
| [`final-report-database-design.md`](final-report-database-design.md) | Final Report operations, triggers, indexes, and document model                          | Historical course evidence — not the product |

## Architecture Decisions

| ADR                                             | Decision                                                       | Status             |
| ----------------------------------------------- | -------------------------------------------------------------- | ------------------ |
| [`0001`](adr/0001-separate-express-backend.md)  | Use a separate Express backend                                 | Accepted direction |
| [`0002`](adr/0002-monorepo-layout.md)           | Use a frontend/backend monorepo                                | Accepted direction |
| [`0003`](adr/0003-docker-compose-deployment.md) | Separate local and production Docker Compose deployment shapes | Current direction  |

## Evidence Sources

Two evidence sets live in [`sources/`](sources/), and they describe different things.
Keeping them apart is the point.

**Product evidence — authoritative for what we build.** The clickable prototype that
settled the product's behaviour:

- [`tutormatcher-prototype-readme.md`](sources/tutormatcher-prototype-readme.md) — page map, flows, and what is real versus faked
- [`tutormatcher-prototype-user-stories.md`](sources/tutormatcher-prototype-user-stories.md) — epics US1-1 … US11-3 with acceptance criteria
- [`tutormatcher-prototype.dbml`](sources/tutormatcher-prototype.dbml) — the data model that scope implies

Compiled into [`user-journeys.md`](user-journeys.md),
[`project-schema.md`](project-schema.md), and [`CONTEXT.md`](../CONTEXT.md).

**Planning evidence.** The exports the backlog was built from:
[`Product Backlog v1.2.html`](<sources/Product Backlog v1.2.html>),
[`Sprint 1 v1.1.html`](<sources/Sprint 1 v1.1.html>), and the user-journey SVG
[`Untitled-2026-08-28-2348.svg`](sources/Untitled-2026-08-28-2348.svg). Compiled into
[`backlog/`](backlog/); its drift from the product is tracked in
[`backlog/reconciliation.md`](backlog/reconciliation.md).

**Historical course evidence — not a product requirement.**
[`tutor-matcher-final-report.md`](sources/tutor-matcher-final-report.md) is the database
course's Final Report. Its schema (`Person`, `Class`, `AvailableTime`, transfer-proof
`Payment`, `Post`) describes an earlier, different design and is superseded by
[`project-schema.md`](project-schema.md). The page that summarises it,
[`final-report-database-design.md`](final-report-database-design.md), is labelled
historical above; read it as a record of that report, never as the product's data
model.

## Known Documentation Gaps

- Application API routes and request/response contracts
- Authentication and authorization mechanism (see the deferred decision in [`project-architecture.md`](project-architecture.md))
- Cancellation, refund, and settlement policy in numbers — the penalty window, the clearing period, and the platform fee are described in [`user-journeys.md`](user-journeys.md) from prototype copy and still need product sign-off
- Whether rescheduling a booking is in scope at all (see [`backlog/reconciliation.md`](backlog/reconciliation.md), BOOK-3 and BOOK-4)
- Environment-variable reference and troubleshooting
- Gherkin coverage for the domain flows in [`user-journeys.md`](user-journeys.md)
- File storage for tutor verification documents

The source-of-truth rules are defined above and in `AGENTS.md`; keep this page
as the single documentation entry point.
