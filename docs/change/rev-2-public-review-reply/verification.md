# Verification: REV-2

Verified on 2026-11-12 against main c41631460c41c53ee54e4f2a40c2b6de1d6e6643.

## Assessment

No outstanding implementation findings. This branch contains reply creation/editing,
public review projection and the reusable reply component; PROF-5 dashboard integration
and teaching statistics are a separate PR.

## Acceptance evidence

- Issue #169: a reviewed Tutor publishes a reply beneath the review. HTTP, public-list
  and shared-component tests verify owner-only submission and public rendering.
- A deleted review returns REVIEW_NOT_FOUND. Tests cover deletion before the request
  and between the ownership read and conditional write; the UI keeps the draft.
- User-approved extension: the Tutor edits the same reply, preserving its publication
  date and exposing an Edited timestamp. Tests cover subsequent/no-op edits,
  authentication, other Tutors, Students, invalid text, stale versions and write races.
- The draft editor hides when owner capability is lost while the published reply remains
  public. Public and dashboard combined preview edit/reload/Student checks passed before
  splitting the branches; those browser checks used memory fixtures.

## Checks

- Backend Jest: 376 passed; 132 existing opt-in PostgreSQL tests skipped.
- Frontend Jest: 330 passed across 35 suites, including the owner-access-loss regression.
- Backend BDD: 1 scenario / 3 steps passed (existing root-route coverage).
- Both app builds, lint, schema generation/validation and whole-tree formatting checked.
- Final independent review found a stale G12 schema-gap note; it now lists only
  moderation as missing, since Tutor replies are implemented.

## Storage and scope

Review adds nullable replyText, repliedAt and replyEditedAt. No migration history,
database synchronization or data writes were performed. PostgreSQL persistence and
concurrent-write execution remain unverified; mocked tests assert the conditional-query
contract, not database behavior. An authorized schema synchronization is needed before
using this code against an existing database.

REV-1 PR #225 remains open and owns review creation/its unique booking relation. The
reply routes are separate POST/PATCH /api/reviews/:id/reply endpoints; recheck integration
when either PR merges. Hidden/deleted moderation behavior beyond missing rows is not
invented because the current schema has no review visibility state.

The original two-field approval and later editable-reply request are preserved in
[storage evidence](../../sources/rev-2-schema-confirmation.md) and
[editing evidence](../../sources/rev-2-editable-reply-confirmation.md). Wiki Memory records
only the confirmed owner-editable single-reply preference. No unrelated Availability,
navbar, deployment, environment or CI changes are included.
