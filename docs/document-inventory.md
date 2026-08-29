# Documentation Inventory

This inventory records the ownership and current purpose of the tracked
human-facing documentation. Immutable source material remains under
[`sources/`](sources/) and is not edited by documentation maintenance.

| Path                                                                           | Purpose                                                          | Status            |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------- | ----------------- |
| [`README.md`](../README.md)                                                    | Setup, development commands, testing, and repository orientation | Current           |
| [`project-charter.md`](project-charter.md)                                     | Product purpose, goals, roles, and scope                         | Current           |
| [`project-architecture.md`](project-architecture.md)                           | Technology stack, repository layout, data flow, and deployment   | Current           |
| [`testing.md`](testing.md)                                                     | Test suites, commands, conventions, and CI enforcement           | Current           |
| [`project-schema.md`](project-schema.md)                                       | Authored relational schema reference                             | Design reference  |
| [`database-operations-and-integrity.md`](database-operations-and-integrity.md) | Database procedures, functions, triggers, and integrity rules    | Evidence-backed   |
| [`query-performance-and-reporting.md`](query-performance-and-reporting.md)     | Indexes, execution paths, and reporting queries                  | Evidence-backed   |
| [`document-database-model.md`](document-database-model.md)                     | MongoDB class document and embedded reviews                      | Evidence-backed   |
| [`docs/backlog/README.md`](backlog/README.md)                                  | Git-managed backlog contract and validation commands             | Current           |
| [`docs/adr/`](adr/)                                                            | Architecture decision records                                    | Current decisions |
| [`project-review.md`](project-review.md)                                       | Earlier repository review findings                               | Historical        |

Known coverage gaps are tracked in [`docs/index.md`](index.md). Application API
contracts, authentication behavior, and end-to-end domain flows remain to be
documented as those capabilities are implemented.
