# CLASS-1 implementation handoff

Updated: 2026-10-24. Continue on **`feat/CLASS-1-lesson-delivery`**.

**Status:** Requirements grilling is complete and
[ADR 0004](adr/0004-google-meet-lesson-links.md) is accepted. **Implementation has not
started, and no live meeting test has been run.** The application baseline is `6054b29`
(BOOK-4 merged); this branch adds research, the accepted decision, and continuation guidance.

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

Issue #146 was re-read for this handoff and remains open with Zoom in its title, story,
and acceptance criteria. Its original fallback criterion says the Tutor is notified;
the accepted contract instead uses Booking-page status without new emails.
The [booking journey](user-journeys.md#3--booking-a-lesson) also still labels online delivery
as Zoom. These artifacts need alignment with the confirmed decision before implementation;
this documentation push does not edit the issue or rewrite the journeys.

The schema documentation correctly describes the database as it exists today, including
`zoomMeetingUrl`. Update it alongside an approved schema change, without presenting
planned fields as already implemented.

## Repository starting points

| File/area                                                                                | Current state / next integration concern                                                                                                                                                                           |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Booking service](../apps/backend/src/modules/booking/booking.service.ts)                | `confirmBookingPayment()` commits before best-effort notifications. Add provisioning after commit; integrate existing `rescheduleBooking()` and cancellation paths with generation invalidation.                   |
| [Classroom module](../apps/backend/src/modules/classroom/)                               | Placeholder routes/service; inspect before choosing the provider/provisioning service boundary.                                                                                                                    |
| [Prisma schema](../apps/backend/prisma/schema.prisma)                                    | Booking has nullable `zoomMeetingUrl`; generated/custom URLs, provider identity, recovery state, generation/version protection, and latest editor/time need design. Ask before schema edits or direct data writes. |
| [Booking detail page](../apps/frontend/app/bookings/[id]/page.tsx)                       | Existing Join reads `zoomMeetingUrl` for a confirmed Booking. Add effective-link/status rendering, scheduled-end eligibility, and the Tutor override/restore editor.                                               |
| [Frontend Booking types](../apps/frontend/src/types/booking.ts)                          | The API/client contract still exposes `zoomMeetingUrl`; update it with the approved schema and effective-link design.                                                                                              |
| [Authentication service](../apps/backend/src/modules/auth/auth.service.ts)               | Existing local login stays in place. Organizer OAuth is backend integration configuration; no Tutor/Student Google-linking feature is required.                                                                    |
| [Notification service](../apps/backend/src/modules/notification/notification.service.ts) | Existing emails are best-effort and preference-controlled. CLASS-1 uses page status; do not add fallback/change emails or treat notification waiting as a durable work queue.                                      |

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

## Next actions on the other device

1. Fetch and switch to `feat/CLASS-1-lesson-delivery`; start with ADR 0004 and this handoff.
2. Resolve authorized account setup and run the live feasibility checks above. Record what
   was actually tested and the capacity observed.
3. Create the normal `docs/change` proposal/spec/tasks from the accepted ADR, including
   provisioning recovery, schedule-generation protection, API/UI behavior, and required
   schema/configuration changes. Coordinate issue and canonical-journey alignment without
   rewriting immutable evidence. Request approval for the concrete Prisma changes.
4. Implement within the approved scope and ownership boundaries. Existing reschedule
   eligibility and cancellation/refund rules stay outside the meeting integration.
5. Verify successful creation, throttling, four-attempt exhaustion, uncertain creation,
   restart/concurrent-worker recovery, manual-link ownership and HTTPS validation,
   override/restore, late success while custom is active, repeated rescheduling,
   cancellation races, Join/edit end-time boundaries, and missing-link/status UI.
   Existing payment remains committed throughout failure scenarios.

## Branch validation and approval boundaries

The branch currently contains documentation and immutable research evidence only. The
accepted ADR, this handoff, docs index, and confirmed Wiki Memory pointer are the current
continuation package. Formatting, local links, and Git diff checks validate the documentation;
they do not establish application correctness or live Google behavior.

Schema/data changes, credentials, subscriptions, live tests, server operations, and deployment
require their applicable authorization. Protected deployment/environment/CI work remains under
the repository's DevOps ownership rules. This push publishes the CLASS-1 documentation to its
feature branch; it does not merge to `main`, close #146, or authorize those separate actions.
