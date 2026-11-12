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

## [2026-10-24] ingest | PROF-7 payout account decisions

- Disposition: Update; resolves schema gap G10
- Raw: docs/sources/prof-7-policy-confirmation.md
- Updated: docs/user-journeys.md, docs/database-schema.md, docs/testing.md, docs/index.md, AGENTS.md Wiki Memory
- Scope: Several Thai bank payout accounts per user with one default, masked numbers, `/settings/wallet` for any logged-in user; payout requests stay with PAY-7

## [2026-10-24] ingest | PAY-7 payout request decisions

- Disposition: Update
- Raw: docs/sources/pay-7-policy-confirmation.md
- Updated: docs/user-journeys.md, docs/database-schema.md, docs/testing.md, docs/index.md, AGENTS.md Wiki Memory
- Scope: Tutor-only payout (issue #161 changed 2026-10-25), simulated and off in production, `/wallet/payout` page with a saved payout account (default picked first), one PAYOUT row with `payoutAccountId` per payout, no status or request table

## [2026-10-30] ingest | PAY-5 wallet page decisions

- Disposition: Update
- Raw: docs/sources/pay-5-policy-confirmation.md
- Updated: docs/user-journeys.md, docs/testing.md, docs/index.md, AGENTS.md Wiki Memory
- Scope: Direction derived from type and status always Completed, a Payment due box on `/wallet` linking to `/bookings/:id` with no pending ledger row, and four summary figures with Tutor-only pending earnings at the provisional 15% fee

## [2026-11-03] ingest | PROF-7 payout accounts become tutor-only

- Disposition: Update; supersedes the PROF-7 answer that any logged-in user manages payout accounts
- Raw: docs/sources/prof-7-tutor-only-confirmation.md
- Updated: docs/user-journeys.md, docs/database-schema.md, docs/testing.md, docs/index.md, CONTEXT.md, AGENTS.md Wiki Memory
- Scope: Only Tutors list, add, set default or remove payout accounts; Wallet settings keeps the balance and Top up for everyone

## [2026-11-03] ingest | PAY-1 top-up by slip and admin approval

- Disposition: Update; supersedes the simulated top-up confirmation
- Raw: docs/sources/pay-1-slip-topup-confirmation.md
- Updated: docs/user-journeys.md, docs/database-schema.md, docs/testing.md, docs/index.md, CONTEXT.md, AGENTS.md Wiki Memory
- Scope: Slip URL top-up requests, one pending per user, admin approve or reject with a reason, new `topup_requests` table; no simulation, placeholder QR, no PromptPay API

## [2026-11-03] ingest | PAY-5 review comments

- Disposition: Update
- Raw: docs/sources/pay-5-review-comments.md
- Updated: docs/user-journeys.md, docs/testing.md, AGENTS.md Wiki Memory
- Scope: Students no longer see Earnings this month, All-time paid out, or the Lesson earnings and Payouts filters; Tutors keep All-time paid out, labelled Total paid out

## [2026-11-06] ingest | CLASS-3 pending earnings and review eligibility

- Disposition: Update; the user's correction supersedes immediate wallet release in issue #212
- Raw: docs/sources/class-3-policy-confirmation.md
- Updated: docs/user-journeys.md, docs/database-schema.md, docs/testing.md, docs/index.md, CONTEXT.md, AGENTS.md Wiki Memory
- Scope: Completion preserves calculated pending earnings at the existing 15% fee; no available-balance credit, pending ledger row or historical reconciliation. PAY-6 owns clearing; REV-1 owns review submission, with eligibility exposed by CLASS-3.
## [2026-11-06] ingest | PAY-1 demo feedback

- Disposition: Update; supersedes the placeholder QR and the cancel button in the PAY-1 slip confirmation
- Raw: docs/sources/pay-1-demo-feedback.md
- Updated: docs/user-journeys.md, docs/testing.md, deploy/README.md, AGENTS.md Wiki Memory
- Scope: Scannable PromptPay QR with the amount locked, using `PROMPTPAY_ID` or the placeholder `0000000000`; no cancel or back button on a pending top-up; CANCELLED status and the cancel route removed; the admin page lists every request by default

## [2026-11-12] ingest | Public Tutor replies and owner editing

- Disposition: Update; one reply per review does not prohibit editing its text
- Raw: docs/sources/rev-2-schema-confirmation.md, docs/sources/rev-2-editable-reply-confirmation.md
- Updated: CONTEXT.md, docs/user-journeys.md, docs/database-schema.md, docs/index.md, AGENTS.md Wiki Memory
- Scope: One public reply per review, editable by the reviewed Tutor with a persisted Edited marker. Original publication time is preserved; stale edits and deleted reviews are rejected. No database synchronization was performed.

## [2026-11-10] ingest | REV-1 review a completed lesson

- Disposition: Update
- Raw: docs/sources/rev-1-policy-confirmation.md
- Updated: docs/user-journeys.md, docs/database-schema.md, docs/testing.md, docs/index.md, AGENTS.md Wiki Memory
- Scope: Students publish a 1-5 star review with an optional comment from their own completed booking, scoped to its tutor and subject; one review per booking via a UNIQUE `reviews.booking_id`; the stale rating CHECK note corrected

## [2026-11-12] compile | Tutor overview and public evaluation

- Evidence: GitHub issue #165 and docs/sources/rev-2-editable-reply-confirmation.md
- Updated: docs/user-journeys.md, docs/testing.md, docs/index.md
- Scope: Owner-only teaching overview with status/engagement and published reviews. Public Tutor profiles expose only aggregate completed lessons and distinct Students taught, alongside existing ratings/reviews; these metric definitions are the implementation choices previewed for the user. Private bookings, identities and earnings remain owner-only.
