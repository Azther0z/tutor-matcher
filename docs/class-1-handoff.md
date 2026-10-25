# CLASS-1 implementation handoff

Updated: 2026-10-25. Continue on **`feat/CLASS-1-lesson-delivery`**.

**Status:** Requirements grilling is complete and
[ADR 0004](adr/0004-google-meet-lesson-links.md) is accepted. The first Tutor custom-link
slice is implemented locally under [its change plan](change/class-1-custom-meeting-url/proposal.md).
Google Meet room creation and live meeting tests remain pending. The database has not been
synchronized with the new Prisma fields. These changes are local to this worktree and have
not been committed or pushed. The application baseline is `6054b29` (BOOK-4 merged).

## Read first

1. [ADR 0004: Google Meet lesson links with a Tutor override](adr/0004-google-meet-lesson-links.md)
   is the confirmed CLASS-1 contract. Its decisions supersede provisional recommendations in
   the earlier research and issue comment.
2. This handoff describes current repository gaps, validation gates, and next actions.
3. [Issue #146](https://github.com/Azther0z/tutor-matcher/issues/146) and its
   [earlier research comment](https://github.com/Azther0z/tutor-matcher/issues/146#issuecomment-6383592519)
   provide the original story and provider investigation.
4. [Canonical journeys](user-journeys.md#5--lesson-delivery),
   [database schema and gaps](database-schema.md), [domain vocabulary](../CONTEXT.md),
   and root `AGENTS.md` govern implementation and documentation.
5. [Lesson delivery options](lesson-delivery-options.md) preserves managed/self-hosted
   alternatives and source evidence. It is earlier research, not approval to replace Google
   or expand this work into an embedded classroom.

## Confirmed decisions

The full contract lives in ADR 0004; do not reopen settled requirements unless validation
reveals a material problem that needs a user decision.

- **Google Meet with one platform-owned organizer initially, authenticated through OAuth.**
  The organizer is the Google account that owns generated rooms, separate from the Tutor
  Matcher Admin capability. The operator authorizes it; the backend refreshes access.
  The actual Google account and subscription have not been selected.
- Keep separate generated and Tutor-provided HTTPS URLs. The custom URL wins; removing it
  restores the generated URL when available. The booked Tutor can add, replace, or remove
  the custom URL for a confirmed Booking until its scheduled end. Apply basic HTTPS URL
  validation without a provider allowlist or room-availability check. Retain latest
  editor/time, without a full history.
- **Implementation sequence:** deliver Tutor-provided URLs first so confirmed lessons can
  proceed without waiting for provider setup. Integrate Google Meet room creation later;
  retain the same generated/custom precedence and other accepted requirements.
- Provision after payment commits. Each required new room gets **one initial attempt plus
  up to three retries: four attempts total**. Recovery continues even after a custom URL
  is saved. A later generated URL is fallback only and must not replace the custom choice.
  Retrying an uncertain creation result may leave unused rooms; that is accepted.
- Join is available to the Student and Tutor once payment is confirmed and an effective
  URL exists, until the scheduled end. Cancelled/completed Bookings have no Join action.
  Entry must work without host approval or organizer attendance. Anonymous joining is
  preferred; Google sign-in inside Meet is acceptable.
- **Rescheduling commits the new schedule, immediately retires the old generated URL from
  Tutor Matcher, and provisions a new Google room with a new attempt budget.** Preserve
  the custom URL and its priority; use pending/manual fallback when no URL is available.
  Move Join/edit windows to the new schedule. This does not change rescheduling eligibility
  or cancellation/refund policy.
- Show status on the Booking page only; CLASS-1 adds no failure or link-change emails.
  Tutor Matcher owns scheduling; Google Calendar events, invitations, and synchronization
  are excluded. Co-host automation and Tutor Google-account linking are deferred.
- Impose no application-level cap on simultaneous lessons. Obey provider quotas and report
  only tested capacity. Desktop joining must work in a browser without installation;
  mobile may use the provider app. Copied URLs may remain usable independently of app
  timing, cancellation, or replacement.

Attendance/completion (CLASS-2), recording/transcription, settlement, and payouts remain
separate work. The earlier Business Standard recommendation was for the now-deferred
Tutor co-host model; it is not an approved subscription requirement for this scope.

## Current documentation mismatch

Issue #146 remains open with Zoom in its title, story, and acceptance criteria. Its original
fallback criterion says the Tutor is notified; the accepted contract instead uses
Booking-page status without new emails. The canonical booking journey now describes the
Tutor override and avoids implying that Google Meet room creation is already implemented.
The issue itself has not been edited.

The Prisma schema and schema documentation now include `customMeetingUrl`,
`meetingLinkUpdatedAt`, and `meetingLinkUpdatedById`. Apply the schema to a local or shared
database only under the applicable data-change approval; no database push was performed here.

## Repository starting points

| File/area                                                                                | Current state / next integration concern                                                                                                                                                                                              |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Booking service](../apps/backend/src/modules/booking/booking.service.ts)                | Tutor override endpoint, effective-link mapping, and server-computed actions are implemented. `confirmBookingPayment()` commits before notifications; add future provisioning after commit and protect reschedule/cancellation races. |
| [Classroom module](../apps/backend/src/modules/classroom/)                               | Placeholder routes/service; inspect before choosing the provider/provisioning service boundary.                                                                                                                                       |
| [Prisma schema](../apps/backend/prisma/schema.prisma)                                    | Booking now stores `customMeetingUrl` and latest editor/time beside nullable `zoomMeetingUrl`. Provider identity, recovery state, and generation/version protection remain for Meet provisioning.                                     |
| [Booking detail page](../apps/frontend/app/bookings/[id]/page.tsx)                       | Uses the effective URL, scheduled-end Join eligibility, and the Tutor override/restore editor.                                                                                                                                        |
| [Frontend Booking types](../apps/frontend/src/types/booking.ts)                          | Exposes generated/custom/effective URLs, latest editor/time, and server-computed Join/edit actions.                                                                                                                                   |
| [Authentication service](../apps/backend/src/modules/auth/auth.service.ts)               | Existing local login stays in place. Organizer OAuth is backend integration configuration; no Tutor/Student Google-linking feature is required.                                                                                       |
| [Notification service](../apps/backend/src/modules/notification/notification.service.ts) | Existing emails are best-effort and preference-controlled. CLASS-1 uses page status; do not add fallback/change emails or treat notification waiting as a durable work queue.                                                         |

There is no existing durable provisioning queue. Choose the recovery mechanism and data
model in the change proposal; avoid silently introducing unrelated infrastructure.

## Implementation invariants

- Keep provider calls outside the wallet transaction. Neither provisioning failure nor a
  retry may repeat payment or undo a committed Booking/reschedule.
- Store recoverable work and enforce the per-generation attempt budget across restarts
  and concurrent workers. Use quota-aware scheduling/backoff; a custom URL does not cancel
  the approved recovery attempts.
- Persist canonical `spaces/{space}` identity alongside the generated URL. The earlier API
  review found no creation idempotency key; accepted retries may leave unused remote rooms.
  Only a successfully recorded result for the current schedule can become the generated link.
- Recheck cancellation, schedule generation, and current custom URL before publishing results.
  An obsolete job must not restore a retired generated URL or overwrite a Tutor edit.
- Enforce Booking ownership and role on link reads/edits/Join, and enforce time/status rules
  server-side as well as in the UI. Keep OAuth credentials and private URLs out of logs/Git.
- A custom HTTPS URL is a Tutor-selected external destination. Do not add provider-specific
  validation, room probes, Calendar synchronization, or co-host/account-linking flows.
- Replacing or hiding a link is an application action, not a promise of Google room deletion
  or permanent revocation of a previously copied URL.

## Pending account setup and live validation

These are verification/setup prerequisites, not unresolved product requirements:

1. With explicit authorization, select the actual platform-controlled organizer account
   and suitable plan, configure organizer OAuth/scopes and secure credential storage, and
   check refresh/reconnection behavior. No account setup, credentials, or purchase has
   been handled by this work.
2. Prove at least **two independent simultaneous lessons** without organizer attendance.
   Confirm both Tutor-first and Student-first entry without host approval. Test anonymous
   entry first, then the accepted Google-sign-in fallback under the actual account/policies.
   Creation quotas and call duration are not evidence of active-call capacity.
3. Verify desktop browser joining and the intended Android/iOS flows against the accepted
   installation promise. Do not claim every mobile browser works without an app.
4. Check copied-link behavior outside lesson time and after cancellation/rescheduling.
   Record the behavior and accepted limitation; do not promise provider-side revocation.

No Tutor co-host test or Google-account-linking implementation is required for CLASS-1.
If the selected setup cannot provide a required joining behavior, report the evidence and
ask before changing the confirmed contract.

## Next actions

1. Review the local custom-link implementation and run the planned behavioral checks when
   requested. The current status is validated by Prisma, TypeScript builds, and lint; the
   database is not synchronized in this worktree.
2. For the later Google Meet slice, add its focused change proposal/spec/tasks for OAuth,
   after-payment room creation, bounded recovery, schedule-generation protection, and
   booking-page status. Request approval for any additional Prisma changes before editing.
3. With explicit authorization, select the actual organizer account and plan, configure
   OAuth securely, and prove the accepted concurrent and organizer-absent joining behavior.
4. Implement the provider slice without changing payment, reschedule eligibility, or
   cancellation/refund policy. Keep copied-link behavior and provider capacity limits as
   stated in ADR 0004.
5. Verify creation, throttling, retry exhaustion, uncertain creation, restart/concurrent
   recovery, manual override priority, repeated rescheduling, cancellation races, and
   Join/edit time boundaries. Record tested capacity and account-specific access results.

## Branch validation and approval boundaries

This worktree contains the accepted ADR, implementation change artifacts, custom-link code,
and aligned canonical documentation. Prisma validation, application builds, lint, and
formatting passed; no behavioral tests, database synchronization, or live Google behavior
were checked. No commit, push, issue edit, or deployment was performed for this slice.

Schema/data changes, credentials, subscriptions, live tests, server operations, and deployment
require their applicable authorization. Protected deployment/environment/CI work remains under
the repository's DevOps ownership rules. This push publishes the CLASS-1 documentation to its
feature branch; it does not merge to `main`, close #146, or authorize those separate actions.
