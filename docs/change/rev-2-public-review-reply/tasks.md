# Tasks

- [x] Support owner editing with a persisted Edited marker.
  - Acceptance: One reply is updated in place; original publication time survives; public viewers see Edited; stale/deleted/unauthorized edits fail without losing the draft.
  - Verify: Reply HTTP/component tests, public projection checks and browser edit/reload walkthrough.
  - Files: Review schema/API, public projections and shared reply component.

- [x] Add approved nullable reply fields and a validated owner-only reply endpoint.
  - Acceptance: Valid reply saves once; unauthorized, duplicate, invalid and deleted-review cases are rejected; concurrent writes cannot overwrite.
  - Verify: Schema validation/client generation, backend review reply tests/build/lint.
  - Files: `apps/backend/prisma/schema.prisma`, `apps/backend/src/modules/review/`
- [x] Display public replies and owner reply controls.
  - Acceptance: Reply appears below its review; ownership controls and deleted-review error are clear; draft survives failure.
  - Verify: Frontend reply/public review tests and interactive preview.
  - Files: Discovery review projections and shared frontend review components.
- [x] Verify integration and record deployment prerequisites.
  - Acceptance: Combined preview works, checks pass and database/REV-1 limitations are explicit before PR approval.
  - Verify: Both app suites, browser walkthrough and verification report.
  - Files: `docs/change/rev-2-public-review-reply/verification.md`
