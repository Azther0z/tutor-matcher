# CLASS-1 implementation handoff

Updated: 2026-10-24. Continue on **`feat/CLASS-1-lesson-delivery`**.
Starting application baseline: `6054b29` (BOOK-4 merged). This branch adds documentation
and evidence only; **CLASS-1 implementation has not started**.

## Read first

1. This handoff for the current direction and next steps.
2. [Lesson delivery options](lesson-delivery-options.md) for managed/self-hosted alternatives,
   pricing, admission/cancellation risks, and captured official sources.
3. [Issue #146](https://github.com/Azther0z/tutor-matcher/issues/146) and the
   [earlier Google Meet handoff](https://github.com/Azther0z/tutor-matcher/issues/146#issuecomment-6383592519).
4. [Canonical journeys](user-journeys.md#5--lesson-delivery),
   [schema gaps](database-schema.md), [domain vocabulary](../CONTEXT.md), and root `AGENTS.md`.

## Confirmed direction versus recommendations

- **Google Meet is the last explicitly selected provider.** The user later requested
  alternatives to Google Meet and Microsoft Teams, accepting both cloud hosting and Docker
  self-hosting. No alternative was selected. Do not interpret the alternatives ranking as
  approval to replace Google or expand CLASS-1 into an embedded classroom.
- The user requested a repository handoff and push so implementation can continue on another
  device, and explicitly requested a **feature branch**, not a documentation branch.
- Ordinary shared-host Zoom was excluded after discussing concurrent-host limits. Other Zoom
  architectures, including Video SDK, were explored, not selected.
- **Business Standard is the recommended plan to validate for the proposed platform-owned
  organizer + Tutor co-host architecture.** No purchase, account provisioning, or live test
  has occurred. Organizer ownership and license count are not approved architecture decisions.

### Important duration clarification

Business Standard already supports group meetings, including **3 or more participants**, for
up to **24 hours**. No separate duration extension/add-on is needed for that plan.

The reason for recommending Standard over Starter was **co-host support**, not API access
or duration: Starter also supports longer group calls, but Google's feature matrix does not
list multiple co-hosts for Starter. API authorization acts with the user's permissions and
does not unlock unlicensed meeting features. “Standard is not a universal API minimum”
means creating a meeting link and assigning Tutor co-host rights are different requirements;
it does **not** mean downgrading the proposed architecture to Starter.

Free personal accounts already support two-person calls for up to 24 hours on a computer;
their 60-minute limit applies to meetings with 3 or more participants. That is separate from
the proposed paid-organizer setup. Participants do not each need a Standard subscription
merely to join. External Tutor co-host eligibility/control still requires a real-account test.

Sources: [duration](sources/class-1-google-duration.md),
[plan features](sources/class-1-google-premium-features.md),
[API authentication](sources/class-1-google-api-auth.md), and
[space members/co-hosts](sources/class-1-google-space-members.md).

## Scope and current mismatch

Issue #146 still explicitly says Zoom in its title, story, and unchecked acceptance criteria.
Its intended flow is automatic meeting creation after payment confirmation, Join lesson,
and Tutor notification/manual-link fallback when provisioning fails, without blocking the
Booking. The issue was re-read for this handoff; only the earlier research comment exists
from this work. No new issue edit/comment or PR was created for this handoff.

Before implementation, align the issue/change requirements with the Google selection and
the authoritative journeys. This handoff is **not** a `docs/change` proposal or permission
to edit the issue automatically. Attendance/completion (CLASS-2), recording/transcription,
settlement, and payouts are separate work.

## Repository starting points

| File/area                                                       | Current state / integration concern                                                                                                                                       |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/backend/src/modules/booking/booking.service.ts`           | `confirmBookingPayment()` commits the wallet debit and confirmation before best-effort notifications. Also inspect Student/Tutor cancellation and `rescheduleBooking()`.  |
| `apps/backend/src/modules/classroom/`                           | Placeholder integration area; inspect before choosing the service boundary.                                                                                               |
| `apps/backend/prisma/schema.prisma`                             | Booking has nullable `zoomMeetingUrl`; no provider resource ID/provisioning lifecycle or verified Google identity linkage. Ask before schema edits or direct data writes. |
| `apps/frontend/app/bookings/[id]/page.tsx`                      | Join opens a stored URL for a CONFIRMED Booking. No provisioning/fallback UI or Tutor manual-link editor.                                                                 |
| `apps/backend/src/modules/auth/auth.service.ts`                 | Local authentication; registration email alone is not proof of Google-account ownership.                                                                                  |
| `apps/backend/src/modules/notification/notification.service.ts` | Best-effort, preference-controlled generic email; not a durable job queue or persistent inbox. Fallback must remain actionable if email is disabled/fails.                |

Do not assume existing reschedule code settles product scope: rescheduling remains an open
question in Wiki Memory. Do not change cancellation/refund rules as a side effect of video work.

## Candidate architecture and non-negotiable safety boundaries

Candidate only; validate and get outstanding decisions before implementing:

```text
Payment transaction commits
  -> independently recoverable provisioning for this Booking
  -> unique Meet space + admission configuration + verified Tutor co-host
  -> persist canonical space identity and join URI
  -> booked Student/Tutor can see Join lesson

Provisioning fails or is partially successful
  -> Booking remains confirmed and paid
  -> actionable fallback state and Tutor notification/manual-link entry
```

- Never call the provider inside a retried wallet transaction or retry payment to recover
  provisioning. Failure must not turn successful payment into a failed/unpaid Booking.
- Handle creation success with a lost response, co-host assignment failure, worker restart,
  and concurrent retries. The earlier research found no documented `spaces.create`
  idempotency key; recheck the current contract before designing reconciliation.
- Recheck cancellation/rescheduling and link version before publishing results. A late
  automatic result must not overwrite a Tutor's manual replacement.
- Keep provider tokens/secrets backend-only and out of logs/Git. Persist canonical
  `spaces/{space}` identity, not only a meeting code/join URL.
- Protect all link-edit/retry/Join operations by Booking ownership and role; validate manual
  URLs. Decide allowed providers rather than accepting arbitrary schemes.
- User OAuth for a dedicated organizer or Workspace domain-wide delegation are candidates.
  Delegation impersonates managed Workspace users, not arbitrary external Tutor accounts.

## Google risks that duration does not resolve

Carry these forward from the earlier issue handoff and verify against current API behavior:

- **Concurrent lessons:** no formal per-organizer capacity guarantee or live test exists in
  this work. API quotas and a 24-hour call limit do not prove simultaneous organizer-absent
  lessons work at the target capacity.
- **Tutor permissions:** stable `spaces.members` supports `COHOST`, but real external Tutor
  accounts, organizer absence, and tenant policies still need testing. Co-hosts cannot
  configure auto artifacts or alter moderation settings according to the current member guide.
- **Identity:** decide how Tutor Google identity is verified and whether Students need a
  Google account. Do not silently require Google sign-in for all application authentication.
- **Admission:** `RESTRICTED` is about bypassing knocking; it is not a hard pair-only
  allowlist. A host can admit other people. Decide whether that is acceptable.
- **Timing/revocation:** the earlier API review found no stable space-delete operation.
  Ending an active conference is not documented permanent link revocation. Hiding Join or
  reaching a Calendar event end time does not revoke a copied meeting URL.
- **Scheduling:** a Meet space is not a scheduled Calendar event. Decide whether Tutor
  Matcher alone owns scheduling or Calendar invitations/synchronization are required.
- **Mobile:** browser-first desktop support is not proof that every target Android/iOS
  flow meets the “no extra installation” acceptance wording.

## Next actions on the other device

1. Fetch and switch to `feat/CLASS-1-lesson-delivery`; read this handoff and the issue comment.
2. Reconfirm whether to proceed with the last-selected Google Meet direction after the
   alternatives research. Do not purchase/setup accounts or change credentials without approval.
3. Resolve the immediate decision set: organizer/auth model, verified Tutor Google identity,
   join/admission policy, target concurrency, recovery/manual fallback, and cancellation /
   rescheduling promises. Business Standard duration itself is **not** an unresolved blocker.
4. With explicit test-account authorization, prove two independent simultaneous lessons
   without organizer attendance, external Tutor-first co-host control, Student-first/wrong
   account admission, mobile joining, and copied-link behavior after cancellation/outside time.
5. Once behavior is agreed, create the normal `docs/change` proposal/spec/tasks and request
   approval for necessary Prisma changes before applying the implementation.
6. Test provider failures/timeouts, partial creation, throttling, duplicate jobs, cancellation
   races, notification failure/preferences, manual-link ownership, and stale result protection.

Managed alternatives are not discarded: Daily Prebuilt is recommended for fastest embedded
delivery, LiveKit Cloud for product control/self-hosting flexibility, Whereby for ready UI;
Jitsi/MiroTalk remain self-hosted candidates. Details and security caveats stay in the single
[comparison page](lesson-delivery-options.md), not duplicated here.

## Validation and approval boundaries

- Documentation formatting, local links, evidence metadata/references, and Git diff are the
  applicable checks for this documentation-only branch. No application tests or live calls
  establish CLASS-1 correctness yet.
- No application/schema/deployment configuration has changed. `docs/user-journeys.md` and
  `CONTEXT.md` have not been rewritten to turn candidate architecture into approved behavior.
- Protected deployment/environment/CI work requires `@azther0z` delegation. Schema/data,
  subscriptions, credential handling, server operations, and live tests require authorization.
- The push publishes only this task's documentation/evidence. It does not merge to `main`,
  close #146, purchase anything, or authorize implementation beyond the agreed workflow.
