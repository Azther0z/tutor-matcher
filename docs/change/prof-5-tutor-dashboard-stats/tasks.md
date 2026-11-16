# Tasks

- [x] Show public teaching-experience totals on the Tutor profile.
  - Acceptance: Students/visitors see completed-lesson and distinct-learner totals with ratings/reviews; unpublished profiles and private operational data remain unavailable.
  - Verify: Public discovery/profile tests and browser Student/visitor walkthrough.
  - Files: Discovery service/tests and public Tutor profile type/page/tests.

- [x] Add authenticated, owner-scoped Tutor summary API.
  - Acceptance: Lesson/student/status/engagement counts and all-review aggregates are correct; Student access is rejected.
  - Verify: Backend dashboard tests, backend build and lint.
  - Files: `apps/backend/src/modules/dashboard/`
- [x] Integrate the summary and reviews into the Tutor tab.
  - Acceptance: Established and new Tutors see appropriate states; Student content remains role-appropriate; failure supports retry.
  - Verify: Frontend component/dashboard tests and interactive preview.
  - Files: `apps/frontend/app/dashboard/`, `apps/frontend/src/components/`, `apps/frontend/src/lib/`
- [x] Verify the combined PROF-5/REV-2 preview and record limits.
  - Acceptance: Build/lint/tests pass and a runnable local preview is available for user review before PR approval.
  - Verify: Both app suites, browser inspection and verification report.
  - Files: `docs/change/prof-5-tutor-dashboard-stats/verification.md`
