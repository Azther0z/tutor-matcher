---
type: log
---

# Knowledge Log

This is the preserved operation history from the former LLM wiki workflow.
Current source-backed documentation is maintained directly under `docs/`.

## [2026-09-05] ingest | TutorMatcher product prototype

- Disposition: New
- Raw: docs/sources/tutormatcher-prototype-readme.md
- Raw: docs/sources/tutormatcher-prototype-user-stories.md
- Raw: docs/sources/tutormatcher-prototype.dbml
- Method: walked every journey in the running prototype, then compiled the behaviour
- Created: docs/user-journeys.md
- Created: docs/backlog-reconciliation.md
- Updated: CONTEXT.md (domain vocabulary rewritten to the product; retired terms listed)
- Updated: docs/project-schema.md (rewritten to the product model, reconciled with schema.prisma)
- Updated: docs/project-charter.md, docs/project-architecture.md, docs/testing.md, docs/index.md
- Reclassified: the Final Report and its three summary pages are historical course evidence, not the product schema
- Issue: #29 repo context for agent is not sync with human understanding

## [2026-08-25] consolidate | docs as canonical documentation tree

- Disposition: Consolidated
- Source: docs/sources/tutor-matcher-final-report.md
- Retired: Former top-level `wiki/` articles that duplicated project charter and schema content
- Updated: Canonical database reference pages under `docs/`

## [2026-08-23] ingest | Tutor Matcher System and Database Design

- Disposition: New
- Raw: docs/sources/tutor-matcher-final-report.md

## [2026-08-23] ingest | Tutor Matcher Database Design

- Disposition: Update
- Raw: docs/sources/tutor-matcher-final-report.md
- Updated: Tutor Matcher Platform Overview
- Updated: Tutor Matcher Relational Database Model
- Updated: Tutor Matcher Database Operations And Integrity
- Updated: Tutor Matcher Query Performance And Reporting
- Updated: Tutor Matcher Document Database Model

## [2026-10-16] ingest | Wallet ledger decision

- Disposition: Update; supersedes the former Payment/status design by explicit user approval
- Raw: docs/sources/tutormatcher-wallet-ledger-decision.md
- Raw: docs/sources/tutormatcher-wallet-ledger-implementation.md
- Updated: docs/database-schema.md, docs/user-journeys.md, CONTEXT.md, docs/index.md
- Scope: PAY-1 simulation and necessary booking compatibility; settlement/payout workflows deferred

## [2026-10-17] ingest | BOOK-3 cancellation policy confirmation

- Disposition: Update; supersedes the prototype's 12-hour cancellation window for BOOK-3
- Raw: docs/sources/book-3-policy-confirmation.md
- Updated: docs/user-journeys.md, docs/index.md, AGENTS.md Wiki Memory
- Scope: Confirmed existing 24-hour / 70% defaults and permission for new local BOOK-3 test data only
