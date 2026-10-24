---
status: accepted
date: 2026-10-24
---

# Google Meet Lesson Links with a Tutor Override

For [CLASS-1](https://github.com/Azther0z/tutor-matcher/issues/146), use Google Meet
through one dedicated platform-owned Google account authorized with OAuth, and retain
a separate Tutor-provided URL that overrides the generated link. Google Meet replaces
the ordinary shared-host Zoom direction after its concurrency restrictions were reviewed;
preserving both URLs provides automatic creation, manual recovery, and restoration of
the generated default without losing the Tutor's choice. The user confirmed this contract
after requirements grilling on 2026-10-24; implementation and live validation remain pending.

## Consequences

### Ownership and joining

- The organizer is the platform-controlled Google account that creates and owns generated
  rooms. It is separate from the Tutor Matcher Admin capability. The platform operator
  authorizes that account, and the backend refreshes access as needed.
- Generate a room after the Booking's payment transaction commits. Provisioning failure
  leaves the paid Booking confirmed and provides immediate manual-link fallback.
- Generated rooms must permit entry by link without host approval or organizer attendance.
  Anonymous entry is preferred; Google sign-in inside Meet is acceptable. Tutor Matcher
  keeps its existing login and does not add Google-account linking for Students or Tutors.
- The Student and Tutor see one **Join lesson** action using the effective URL. Enable it
  once payment is confirmed and a URL is ready, until the scheduled lesson end. Cancelled
  and completed Bookings have no Join action.
- Desktop joining must work in a browser without installing an app. Mobile joining may
  require the meeting provider's app.

### Generated and custom URLs

- Store the current generated Google Meet URL and the optional Tutor URL separately.
  Use the custom URL when present; otherwise use the generated URL. Removing the custom
  URL restores Google Meet when available; without either URL, show the missing-link state.
- The booked Tutor may add, replace, or remove the custom URL for a confirmed Booking
  until its scheduled lesson end, including when Google creation succeeded or the lesson
  has already started. The Tutor does not edit the generated URL.
- Accept syntactically valid HTTPS custom URLs. Do not maintain a provider allowlist or
  attempt to verify that the destination room works.
- Retain the latest link editor and change time, without a full change-history timeline.
- Show provisioning, missing-link, and active-link status on the Booking page. CLASS-1
  adds no failure or link-change email notifications.

### Recovery and rescheduling

- Each required new room gets one initial creation attempt and up to three retries
  (four attempts total), in the background and within provider quotas. Continue recovery
  even after a custom URL is saved; later Google success becomes the retained fallback
  and never overrides the active custom URL.
- A lost creation response may leave an unused Google room when creation is retried.
  This is accepted within the retry budget. Expose only the successfully recorded room
  for the current Booking schedule; stale or cancelled work must not activate a link.
  Provisioning retries never repeat payment.
- Rescheduling commits the new schedule and immediately retires the previous generated
  URL from Tutor Matcher. Create a new Google Meet room with a new attempt budget,
  preserve the custom URL and its priority, and move Join/edit windows to the new schedule.
  Without a custom URL, show pending/manual fallback while replacement is unavailable.
- This defines meeting-link behavior for the existing reschedule path. Rescheduling
  eligibility and cancellation/refund policy remain outside this decision.
- Hiding or replacing a URL in Tutor Matcher does not promise to revoke a copied URL.
  Previously copied generated or custom links may work outside the Booking window or
  after cancellation or rescheduling.

### Capacity, scope, and validation

- Impose no application-level cap on simultaneous lessons. Queue creation within provider
  quotas and report only the capacity actually tested; this is not an unlimited provider
  capacity guarantee.
- Tutor Matcher owns the schedule. Google Calendar events, invitations, and synchronization
  are outside CLASS-1. Co-host automation and Tutor Google-account linking are deferred.
  Attendance/completion automation, recording/transcription, settlement, and payouts remain
  separate work.
- The organizer account and subscription are not selected by this ADR. The earlier
  Business Standard recommendation concerned Tutor co-hosting, which is now deferred.
  Account setup, credential handling, purchases, and deployment require separate work.
- Before claiming the integration works, validate at least two independent simultaneous
  lessons without the organizer attending, entry without host approval, preferred anonymous
  entry or the accepted Google-sign-in fallback, and the desktop/mobile joining flows under
  the actual account and policies. No live meeting test has established these behaviors yet.
- The current schema still has only `zoomMeetingUrl`. Align the original issue, canonical
  journeys, and a change proposal before implementation; request approval for Prisma changes.
  This ADR records the accepted design and does not change application behavior or schema.

## Considered Options

Ordinary shared-host Zoom was excluded because of concurrent-host restrictions. Manual
links alone would reduce integration work but omit the requested automation; overwriting
one URL would lose the generated restore option. Platform-organizer OAuth was chosen over
Workspace service-account delegation, while Tutor-owned OAuth and automated co-host
assignment would introduce account-linking scope that is deferred from CLASS-1.

Background evidence remains in the [earlier handoff](../class-1-handoff.md),
[provider comparison](../lesson-delivery-options.md), and captured
[Google API authentication guide](../sources/class-1-google-api-auth.md).
The accepted decisions here supersede the handoff's provisional architecture and open
CLASS-1 requirements; its provider risks remain relevant to validation.
