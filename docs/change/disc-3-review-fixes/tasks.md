# Tasks

## 1. Backend Review Fixes

- [x] 1.1 Remove profile cleanup and bound availability queries.
  - Acceptance: No booking write on profile GET; 14-day details and grouped 92-day next openings preserve response behavior.
  - Verify: Discovery route regressions, parameterized query assertions, read-only PostgreSQL smoke check.
  - Files: Discovery service and tests
- [x] 1.2 Preserve Unicode initials and omit empty-name punctuation.
  - Acceptance: Emoji/non-BMP initials remain intact; empty surname adds no dot.
  - Verify: Discovery response tests.
  - Files: Discovery service and tests

## 2. Frontend Review Fixes

- [x] 2.1 Share two-decimal rate formatting.
  - Acceptance: Header and cards show identical fractional and grouped prices.
  - Verify: Profile page tests.
  - Files: Profile page and tests
- [x] 2.2 Defer and restrict introduction media.
  - Acceptance: Lazy restricted iframe, no video preload/autoplay, insecure file URL stays a link, unsafe protocols stay hidden.
  - Verify: Profile page/media regressions.
  - Files: Profile page, media helper, tests

## 3. Verification and Publication

- [x] 3.2 Address the second review's message submission and display findings.
  - Acceptance: Pending sends cannot be repeated by Enter/click; IME Enter does not send; failure permits retry; review stars are bounded and slot subjects are visible. Remove the redundant slot filter.
  - Verify: Profile page regressions, discovery suite, lint and builds.
  - Files: Profile page and tests, discovery service, this change's artifacts, docs/testing.md
  - Deferred: Retire the legacy summary endpoint with its existing profile integration coverage in a separate change, as the reviewer permits. Subject navigation remains dependent on REV-1 and is disclosed in the PR. Self-messaging is a separate optional follow-up.

- [x] 3.1 Verify the review fixes and prepare publication to PR #202.
  - Acceptance: All scoped local checks pass; the planned PR description reflects the fixes and evidence. Verify remote CI after publication before claiming remote success.
  - Verify: `my-verify-change`, diff scope, local test/build evidence; remote CI tracked on PR #202.
  - Files: This change's verification report, docs/testing.md, docs/index.md, intended code/tests
