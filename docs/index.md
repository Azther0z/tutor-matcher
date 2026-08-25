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

## Project Documentation

| Document                                                                       | Purpose                                                                | Status                                          |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------- | ----------------------------------------------- |
| [`project-charter.md`](project-charter.md)                                     | Product purpose, goals, roles, and scope                               | Current baseline                                |
| [`project-architecture.md`](project-architecture.md)                           | Technology stack, repository layout, data flow, and deferred decisions | Needs reconciliation with implementation        |
| [`project-schema.md`](project-schema.md)                                       | Relational schema, operations, constraints, and indexes                | Design reference; verify against Prisma         |
| [`project-review.md`](project-review.md)                                       | Repository review findings and proposed fixes                          | Historical review; refresh before relying on it |
| [`document-inventory.md`](document-inventory.md)                               | Documentation ownership, freshness, and coverage gaps                  | Current inventory                               |
| [`database-operations-and-integrity.md`](database-operations-and-integrity.md) | Database procedures, functions, triggers, and integrity rules          | Evidence-backed reference                       |
| [`query-performance-and-reporting.md`](query-performance-and-reporting.md)     | Indexes, execution paths, and reporting queries                        | Evidence-backed reference                       |
| [`document-database-model.md`](document-database-model.md)                     | MongoDB class document and embedded reviews                            | Evidence-backed reference                       |

## Architecture Decisions

| ADR                                             | Decision                                     | Status                                            |
| ----------------------------------------------- | -------------------------------------------- | ------------------------------------------------- |
| [`0001`](adr/0001-separate-express-backend.md)  | Use a separate Express backend               | Accepted direction                                |
| [`0002`](adr/0002-monorepo-layout.md)           | Use a frontend/backend monorepo              | Accepted direction; path wording needs correction |
| [`0003`](adr/0003-docker-compose-deployment.md) | Target single-host Docker Compose deployment | Target direction                                  |

## Evidence Sources

The current evidence base is [`sources/tutor-matcher-final-report.md`](sources/tutor-matcher-final-report.md).
The knowledge derived from it is represented by the canonical database pages:

- Relational database model and normalization
- Database operations, procedures, functions, and triggers
- Query performance and reporting
- Document database model

## Known Documentation Gaps

- Application API routes and request/response contracts
- Authentication and authorization behavior
- End-to-end domain flows and state transitions
- Environment-variable reference and troubleshooting
- Testing strategy and coverage expectations
- Deployment and CI/CD operations
- Source-of-truth relationship between Prisma schema, migrations, and design schema

The source-of-truth rules are defined above and in `AGENTS.md`; keep this page
as the single documentation entry point.
