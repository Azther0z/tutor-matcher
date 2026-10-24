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

## [2026-10-18] ingest | BOOK-4 tutor cancellation decisions

- Disposition: Update
- Raw: docs/sources/book-4-policy-confirmation.md
- Updated: docs/user-journeys.md, docs/database-schema.md, docs/testing.md, docs/index.md, AGENTS.md Wiki Memory
- Scope: Full refund on tutor cancellation, Upcoming classes entry point, closed freed slots, required reason with notification, nullable `cancelledBy`

## [2026-10-24] research | CLASS-1 lesson delivery alternatives

- Disposition: New
- Raw: docs/sources/class-1-research-scope.md
- Raw: docs/sources/class-1-daily-prebuilt.md, docs/sources/class-1-daily-access.md, docs/sources/class-1-daily-token-properties.md
- Raw: docs/sources/class-1-daily-pricing.md, docs/sources/class-1-daily-concurrency.md, docs/sources/class-1-daily-eject.md
- Raw: docs/sources/class-1-livekit-access.md, docs/sources/class-1-livekit-pricing.md, docs/sources/class-1-livekit-deployment.md, docs/sources/class-1-livekit-ports.md
- Raw: docs/sources/class-1-livekit-rooms.md, docs/sources/class-1-livekit-meet.md
- Raw: docs/sources/class-1-jitsi-docker.md, docs/sources/class-1-jitsi-iframe.md
- Raw: docs/sources/class-1-mirotalk-readme.md, docs/sources/class-1-mirotalk-access.md
- Raw: docs/sources/class-1-whereby-lifecycle.md, docs/sources/class-1-whereby-pricing.md
- Created: docs/lesson-delivery-options.md
- Updated: docs/index.md, AGENTS.md Wiki Memory
- Method: Official documentation/source and dated pricing; selected faithful source sections preserved with capture metadata. Daily concurrency FAQ extracted from HTML because Markdown omitted its answer.
- Scope: Managed cloud and self-hosted alternatives to Google Meet/Microsoft Teams; recommendations, estimates, risks, and implementation questions only. No provider selection, live accounts/calls, application/schema/deployment edits, or additional GitHub changes.

## [2026-10-24] handoff | CLASS-1 feature-branch continuation

- Disposition: New; Update
- Raw: docs/sources/class-1-google-duration.md
- Raw: docs/sources/class-1-google-premium-features.md
- Raw: docs/sources/class-1-google-api-auth.md
- Raw: docs/sources/class-1-google-space-members.md
- Created: docs/class-1-handoff.md
- Updated: docs/lesson-delivery-options.md, docs/index.md
- Scope: User requested handoff and push on a feature branch for continued implementation on another device. Preserve last-selected Google Meet direction, distinguish Business Standard co-host requirements from API access, and confirm its group-call duration needs no extra extension. No application/schema/deployment or issue edits.
