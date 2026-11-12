# Verification: PROF-5

Verified on 2026-11-12 as a stacked change on REV-2 commit 60f3326.

## Assessment

No outstanding implementation findings after independent review. PROF-5 adds the
teaching overview and public teaching-experience totals; REV-2 supplies the shared
public reply component and storage. Merge REV-2 #227 first, then retarget this PR to main
and rerun checks before merging PROF-5.

## Acceptance evidence

- Tutor dashboard: lesson/status, distinct Students, engagement, review count, all-review
  average and recent review information appear together. Every database query is scoped
  to the authenticated Tutor; Student/applicant requests are rejected before data reads.
- Rating uses all extant published reviews independently of the five recent cards.
  A test uses 12 aggregate reviews with only one recent result.
- New Tutors see zero counts, Unrated and an unavailable returning rate without errors.
  Request failures show an error and retry action instead of fabricated zero statistics.
- Classes this week uses the Monday boundary in Bangkok. A Booking is one lesson,
  regardless of its half-hour slots. Confirmed lessons never imply completion.
- Students and visitors can evaluate published/approved Tutors through ratings/reviews
  and aggregate COMPLETED lessons/distinct Students taught. Public output contains no
  learner identities, private status breakdown, pending bookings or earnings. Activity
  totals are explicitly not a teaching-quality score.

## Verification

- Backend Jest: 384 passed; 132 existing opt-in PostgreSQL tests skipped.
- Frontend Jest: 337 passed across 36 suites.
- Both default production builds and lint passed on this stacked branch.
- Backend BDD: 1 scenario / 3 steps passed. Prisma generation/validation and whole-tree formatting passed; normal pre-commit hooks run on commit.
- Earlier combined browser preview covered zero/error/retry, Student isolation and public
  experience totals, as well as reply edit/reload/public visibility through REV-2.
- Light/dark review scrollbar checks passed. Preview browser tests use memory fixtures;
  they are not PostgreSQL persistence/concurrency evidence.

Final standalone command results are recorded in the PR verification section.

## Scope and limitations

No Prisma schema, deployment, environment, CI, navbar or Availability/calendar changes
are introduced by this PR. The theme changes are limited to native light/dark controls
and the reusable contained scrollbar used by the new review list. Local preview-only
Availability/navbar experiments are preserved in the demo worktree, outside both PRs.

Existing opt-in PostgreSQL integration tests remain skipped; no database was synchronized
or modified. REV-1 #225 still owns review creation and is not merged by this work.
Dashboard shows five recent reviews and public profiles show ten; historical review
pagination is outside these stories. Wiki Memory inherits REV-2's confirmed editable-reply
preference without adding inferred public-metric policy as a user statement.
