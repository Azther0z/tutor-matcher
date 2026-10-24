---
type: article
sources:
  - name: User research scope confirmation
    date: 2026-10-24
  - name: Daily official documentation and pricing
    date: null
  - name: LiveKit official documentation, example application, and pricing
    date: null
  - name: Jitsi Meet Handbook
    date: null
  - name: MiroTalk official documentation and repository
    date: null
  - name: Whereby official documentation and pricing
    date: null
  - name: Google Meet official duration, plan features, and API authentication
    date: null
raw:
  - docs/sources/class-1-research-scope.md
  - docs/sources/class-1-daily-prebuilt.md
  - docs/sources/class-1-daily-access.md
  - docs/sources/class-1-daily-token-properties.md
  - docs/sources/class-1-daily-pricing.md
  - docs/sources/class-1-daily-concurrency.md
  - docs/sources/class-1-daily-eject.md
  - docs/sources/class-1-livekit-access.md
  - docs/sources/class-1-livekit-pricing.md
  - docs/sources/class-1-livekit-deployment.md
  - docs/sources/class-1-livekit-ports.md
  - docs/sources/class-1-livekit-rooms.md
  - docs/sources/class-1-livekit-meet.md
  - docs/sources/class-1-jitsi-docker.md
  - docs/sources/class-1-jitsi-iframe.md
  - docs/sources/class-1-mirotalk-readme.md
  - docs/sources/class-1-mirotalk-access.md
  - docs/sources/class-1-whereby-lifecycle.md
  - docs/sources/class-1-whereby-pricing.md
  - docs/sources/class-1-google-duration.md
  - docs/sources/class-1-google-premium-features.md
  - docs/sources/class-1-google-api-auth.md
updated: 2026-10-24
statuses: []
---

# Lesson delivery options — CLASS-1

Research for [issue #146](https://github.com/Azther0z/tutor-matcher/issues/146), checked
2026-10-24. **No replacement provider is selected and no integration is implemented.**
This page compares alternatives to Google Meet and Microsoft Teams; it does not change
the product contract in [user-journeys.md](user-journeys.md#5--lesson-delivery).

## Scope and decision context

The user explicitly accepts both managed cloud services and self-hosting, including a
Docker sidecar, and authorized saving research context in the repository
([scope evidence](sources/class-1-research-scope.md)). Self-hosting is an option, not a
requirement or a preference over cloud hosting.

Earlier conversation selected Google Meet after excluding ordinary shared-host Zoom.
That is decision history, not approval of any alternative below. The earlier handoff is
[on the issue](https://github.com/Azther0z/tutor-matcher/issues/146#issuecomment-6383592519).
Zoom Video SDK was subsequently explored as a separate embedded-classroom product, not
as a way to bypass Zoom Meetings licensing. Reopening research did not authorize a
provider switch. No additional GitHub comment, account signup, purchase, credentials,
deployment, or database changes are part of this research.

### Google Meet clarification after the alternatives research

The proposed platform-organizer + Tutor co-host model uses **Business Standard as the plan
to validate**, not because all API integration requires that edition, but because co-host
support is needed. Business Starter also supports longer group calls; it does not list
multiple co-hosts. The API acts with the authorized user's permissions, not extra privileges.

**Business Standard already allows group meetings with 3 or more participants for up to
24 hours.** No separate duration extension is needed. Free personal accounts support
two-person calls up to 24 hours on a computer, but group calls have a 60-minute limit.
Duration alone therefore neither proves a paid plan is needed for strict two-person calls
nor proves that platform-owned simultaneous lessons/external co-hosts work as intended.

Sources: [duration](sources/class-1-google-duration.md),
[plan features](sources/class-1-google-premium-features.md), and
[API authorization](sources/class-1-google-api-auth.md). Continue from
[the implementation handoff](class-1-handoff.md); no alternative provider selection is implied.

## Recommendation, not a decision

- **Daily Prebuilt:** first candidate for the fastest managed integration with a ready UI
  and booking-scoped participant tokens.
- **LiveKit Cloud:** first candidate for a more integrated lesson experience and a future
  self-hosting path. Its frontend components reduce work, but do not eliminate integration.
- **Whereby Embedded:** credible managed alternative when separate host/participant links
  and a ready meeting UI are sufficient. Validate identity enforcement before choosing it
  for strictly booking-only admission.
- **Jitsi Meet:** first self-hosted candidate when a complete meeting UI matters more than
  having a small deployment.
- **MiroTalk P2P:** lightweight experiment for two-person lessons, not the default until
  booking-scoped admission, Tutor privileges, cancellation, and licensing are validated.

These are engineering judgments from the evidence below, not measured implementation
times or results from live calls. No service is universally cheapest without usage data.

## Comparison

All candidates offer browser calling. Browser/mobile compatibility, screen sharing,
camera permissions, and restrictive-network connectivity still need project-specific tests.

| Option           | Hosting                        | What we integrate                                            | Booking access and Tutor control                                                              | Main tradeoff                                                                     |
| ---------------- | ------------------------------ | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Daily Prebuilt   | Managed cloud                  | Ready call UI plus room/token APIs                           | Private room; room-scoped tokens; Tutor owner privilege                                       | Usage billing and vendor dependency; must override public-room defaults           |
| Whereby Embedded | Managed cloud                  | Ready call UI; transient-room API; host/participant links    | Separate privileged host link; strict Student identity still needs validation                 | Simpler links are bearer access, not proof of the booking participant             |
| LiveKit          | Cloud or self-hosted           | React components/example plus backend token and room APIs    | JWT identity, room, media permissions and moderation                                          | More classroom integration; self-hosted revocation differs from Cloud             |
| Jitsi Meet       | Self-hosted in this comparison | Ready web UI via iframe/React SDK; authenticated room naming | JWT authentication available; room scoping and Tutor-only moderation need configuration/tests | Core stack has web, Prosody, Jicofo, Videobridge; media networking and operations |
| MiroTalk P2P     | Self-hosted in this comparison | Ready UI, Docker image, JWT/REST integration                 | Participant authentication exists; first arrival becomes presenter by default                 | Admission/presenter behavior and AGPLv3 or alternative license need review        |

Evidence: [Daily UI](sources/class-1-daily-prebuilt.md),
[Daily access](sources/class-1-daily-access.md),
[Whereby lifecycle](sources/class-1-whereby-lifecycle.md),
[LiveKit access](sources/class-1-livekit-access.md),
[LiveKit example](sources/class-1-livekit-meet.md),
[Jitsi Docker](sources/class-1-jitsi-docker.md),
[Jitsi iframe](sources/class-1-jitsi-iframe.md),
[MiroTalk README](sources/class-1-mirotalk-readme.md), and
[MiroTalk access](sources/class-1-mirotalk-access.md).

Jitsi and MiroTalk are evaluated here as self-hosted candidates, not claims that no hosted
offerings exist. Public demos are not assumed to provide a production service contract.

## Managed pricing and simultaneous lessons

Snapshot in USD, checked 2026-10-24; recheck before purchase. Recording, transcription,
other optional services, taxes, and exchange rates are not included below.

**Participant-minutes are not lesson-minutes.** Two people connected for a 60-minute
lesson consume `2 × 60 = 120` participant-minutes. Waiting, overtime, extra devices, and
reconnections may affect actual billed usage.

| Service          | Published starting allowance/rate                                                                                                                                                | Simultaneous-call evidence                                                                                                                                     |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Daily            | First 10,000 participant-minutes/month free; next tier $0.0040 per participant-minute, with graduated discounts                                                                  | Pricing FAQ says up to 100,000 simultaneous calls/sessions **with a card on file**, determined by programmatic rooms; no-card capacity is not established here |
| Whereby Embedded | Explore: 2,000 participant-minutes/month, but 30-minute meetings and no extra minutes. Build: $10.99/month with 2,000 minutes, then $0.0042 per participant-minute; excludes VAT | Exact account-level concurrent-room limit not established by captured sources; confirm before commitment                                                       |
| LiveKit Cloud    | Build: $0/month, 5,000 WebRTC participant-minutes, 50GB downstream. Ship starts at $50/month, 150,000 minutes, then $0.0005/minute; 250GB downstream, then $0.12/GB              | Build: 100 concurrent connections; Ship: 1,000. These are connections, not lesson counts                                                                       |

Sources: [Daily pricing](sources/class-1-daily-pricing.md),
[Daily concurrency FAQ](sources/class-1-daily-concurrency.md),
[Whereby pricing](sources/class-1-whereby-pricing.md), and
[LiveKit pricing](sources/class-1-livekit-pricing.md).

For two connections per lesson and no extra connections, LiveKit's connection ceilings
arithmetically correspond to `100 / 2 = 50` and `1,000 / 2 = 500` simultaneous lessons.
These are theoretical plan ceilings, not tested capacity guarantees. Minute and bandwidth
allowances are separate constraints. Do not use LiveKit's AI-agent concurrency or inference
pricing to estimate human-to-human lessons.

### Illustrative monthly costs

Assumption: exactly two participants throughout each 60-minute lesson, no recording or
extras, and no other account usage. These are estimates, not quotes.

| Workload                                                      | Daily                                        | Whereby Build                                    | LiveKit Ship                                                                    |
| ------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------- |
| 100 lessons: `100 × 2 × 60 = 12,000` participant-minutes      | `(12,000 − 10,000) × $0.0040 = $8`           | `$10.99 + (12,000 − 2,000) × $0.0042 = $52.99`   | Starts at $50; minute usage fits included allowance, but bandwidth may add cost |
| 1,000 lessons: `1,000 × 2 × 60 = 120,000` participant-minutes | `90,000 × $0.0040 + 20,000 × $0.0037 = $434` | `$10.99 + (120,000 − 2,000) × $0.0042 = $506.59` | Starts at $50; minute usage fits included allowance, but bandwidth may add cost |

LiveKit video bandwidth is material: comparing its minute rate alone with Daily/Whereby
would be misleading. Measure downstream traffic at the intended camera/screen-sharing
settings. Whereby Explore is not suitable for the assumed 60-minute lessons because of
its meeting-duration limit. A VPS is still self-managed hosting, not a managed video service.

## Admission, cancellation, and attendance

### Daily

- Use **private** rooms and explicitly disable knocking if only booking participants may
  enter. Default public rooms allow anyone with the URL.
- Always set `room_name`; an unscoped token can access any room in the domain. Derive
  `user_id` and Tutor `is_owner` privileges on the backend, not from browser input.
- `nbf` and `exp` restrict joining. `eject_at_token_exp` is separate and defaults to false:
  token expiry alone is not a promise to end a connected lesson.
- The [eject API](sources/class-1-daily-eject.md) supports `user_ids` and `ban: true` to
  prevent rejoining with those identities. Cancellation design must deny new tokens and
  test already-issued tokens, active participants, and room cleanup rather than only hide Join.
- `user_id` is available in meeting events and analytics, a useful basis for later
  attendance reconciliation. It is not itself proof that teaching occurred.

Sources: [access rules](sources/class-1-daily-access.md) and
[token properties](sources/class-1-daily-token-properties.md).

### Whereby Embedded

- Keep the privileged host link private to the booked Tutor. A separate host link is not
  the same as a verified application identity; validate copied-link and waiting-room behavior.
- `endDate` is **not** a hard lesson stop. The captured guide says deactivation behavior
  begins one hour later and automatic deletion occurs within 24 hours of `endDate`.
- Explicit API deletion removes participants and prevents further room use. Use that
  distinction when designing cancellation or a hard end time.
- Webhooks are documented, but durable Student/Tutor identity correlation for attendance
  is not validated in this research.

Source: [room lifecycle](sources/class-1-whereby-lifecycle.md).

### LiveKit Cloud and self-hosted

- Backend-generated JWTs bind an opaque participant identity to a room and permissions.
  Keep emails/names out of room names and identity identifiers, as the vendor recommends.
- Rooms can auto-create on joining or be explicitly managed. Deleting a room disconnects
  participants, but old tokens and automatic room recreation must still be considered.
- **Cloud-only revocation is not unlimited or automatic cancellation safety.** The captured
  docs describe an `nbf` cutoff, a default clock buffer, and revocation that lasts 10 minutes.
  They recommend token TTL at most 10 minutes, and an explicit `revoke_token_ts` for strict
  rejoin rejection. Implement against the selected SDK/version and test refreshed tokens.
- **Self-hosted removal does not invalidate an existing token.** Short TTL plus refusing
  new tokens limits exposure, but does not guarantee immediate denial while a cached token
  remains valid. If immediate revocation is required, validate an additional enforcement
  design before accepting self-hosting. Token expiry also does not disconnect active users.
- Participant identity is a useful integration hook; attendance persistence, verified
  event handling, and completion policy are separate implementation work.

Sources: [tokens and revocation](sources/class-1-livekit-access.md),
[room lifecycle](sources/class-1-livekit-rooms.md), and
[React/Next.js example](sources/class-1-livekit-meet.md).

### Jitsi and MiroTalk

Jitsi Docker supports JWT authentication and disabling guest access. Require both parties
to authenticate; enforce the particular booking room rather than copying a wildcard-room
example. Tutor-only moderation and rejection of the Student's attempts to gain host rights
need deliberate configuration and tests. Removing everyone is not a verified persistent
room revocation strategy. Browser iframe events alone are not trusted attendance evidence.
See [Docker authentication](sources/class-1-jitsi-docker.md) and
[iframe integration](sources/class-1-jitsi-iframe.md).

MiroTalk's host-protection guide describes authenticated IP state and guests joining freely
while a host is active. Additional participant authentication is available, but that does
not establish booking-bound authorization without checking the selected configuration and
token validation. The first arrival becomes presenter even when a fixed presenter token
is used; test Student-first arrival. Cancellation and reliable attendance remain unvalidated.
Review AGPLv3 obligations or an alternative license; do not infer that merely embedding it
requires relicensing Tutor Matcher. See [access behavior](sources/class-1-mirotalk-access.md)
and [license statement](sources/class-1-mirotalk-readme.md).

## Self-hosting: Docker is packaging, not the whole deployment

The current [deployment](../deploy/compose.yaml) exposes application TCP services, not a
configured media/TURN stack. A working HTTPS reverse proxy alone is not sufficient proof
that browser audio/video will connect. Co-location also shares CPU/network capacity and a
failure domain with the application; a separate media VM is an alternative, not a requirement.

- **LiveKit:** trusted TLS, public-IP awareness, media/firewall routing, and preferably host
  networking for Docker. It includes TURN. Default media uses `50000-60000/UDP`, or optional
  UDP mux `7882`; TCP fallback uses `7881`. TURN/TLS needs its own routing/certificate plan,
  particularly around port `443`. Its published high-scale resource advice is not a minimum
  hardware requirement for this project's two-person lessons.
- **Jitsi:** core services are web, Prosody, Jicofo, and Videobridge. The guide lists
  `10000/UDP` for media, with the advertised public address needed independently of the web
  reverse proxy. Plan restrictive-network/TURN tests rather than assuming direct UDP works.
- **MiroTalk P2P:** direct peer media can reduce media-server work for two-person calls,
  but failed direct connectivity can require TURN relay. The server/TURN cost and tested
  concurrency are unknown; the README's unlimited-room wording is not unlimited capacity.

Sources: [LiveKit deployment](sources/class-1-livekit-deployment.md),
[ports](sources/class-1-livekit-ports.md), [Jitsi Docker](sources/class-1-jitsi-docker.md),
and [MiroTalk architecture](sources/class-1-mirotalk-readme.md). The TURN requirement for a
specific MiroTalk deployment is a validation item, not a measured result.

No hardware inventory, firewall check, bandwidth measurement, container launch, or live-call
test was performed. Deployment files are owned by `@azther0z`; a later self-hosting trial
needs explicit delegation before editing protected configuration.

## Repository fit and proposed integration boundary

Confirmed from current source, not vendor evidence:

- [Booking schema](../apps/backend/prisma/schema.prisma) has nullable `zoomMeetingUrl`, not
  provider identity, a provisioning lifecycle, or separate host/participant access material.
- [Payment confirmation](../apps/backend/src/modules/booking/booking.service.ts) commits
  the wallet movement and confirmation before notifications. **Recommendation:** provision
  after commit, independently retryable, never re-debit or undo a paid booking because the
  video service failed. Handle a provider timeout after successful creation without making
  duplicate rooms, and recheck cancellation before publishing a late result.
- [Join UI](../apps/frontend/app/bookings/[id]/page.tsx) currently opens the stored URL for
  a confirmed booking. Embedded calling adds a lesson page and backend-issued authorization;
  it is broader than replacing a URL. Tutor manual-link fallback from CLASS-1 still needs
  its own authorized edit flow and must not expose provider credentials or host access.
- Current booking service includes `rescheduleBooking()`, but the documented product-scope
  question remains unresolved. If retained, room times/access must follow the new booking
  schedule and old access must not survive inadvertently.
- Current [authentication](../apps/backend/src/modules/auth/auth.service.ts) is local
  application authentication. Do not add mandatory Google/Microsoft/Tutor provider OAuth
  merely because an embedded video service is selected; authorize video access from the Booking.

Any proposed Prisma changes require user approval. This research makes none. CLASS-2
attendance/completion, recording/storage/consent, settlement, and payouts are not silently
included in CLASS-1. Keep canonical journeys and vocabulary unchanged until a decision is made.

## Decisions still needed before implementation

1. **Experience:** external browser meeting link or an embedded Tutor Matcher lesson page?
   Recommendation: prototype Daily Prebuilt first if embedded calling is acceptable; compare
   LiveKit Cloud if product control and future self-hosting matter more than smallest scope.
2. **Capacity and budget:** monthly lesson-hours, peak simultaneous lessons, maximum duration,
   expected regions, and acceptable recurring spend? Free tiers are not a capacity plan.
3. **Admission and timing:** must copied links/tokens be rejected for everyone except the
   booked pair? When may each join, is Tutor presence required, and is there a hard end time?
4. **Cancellation/rescheduling:** is immediate denial of already-issued access required, or
   is a bounded token-expiry window acceptable? Resolve rescheduling scope before wiring it.
5. **Hosting responsibility:** who operates/upgrades media and TURN if self-hosted, and can the
   available public networking and hardware support it? No infrastructure capacity is assumed.

These are implementation questions identified by research, not new user-approved policies.
No recording or attendance requirement should be inferred from a vendor feature list.

## Proposed validation gate

After provider and trial authorization, test separate simultaneous lessons with real browser
media; Student-first and Tutor-first arrival; correct Tutor permissions; wrong booking/user;
copied URL and token replay; early/late joining; cancellation before and during a call;
cached/refreshed tokens after cancellation; reschedule if retained; mobile Safari/Chrome;
screen sharing; UDP-blocked/TURN-only networking; provider outage and retry; and measured
minute/bandwidth charges. Do not equate two tabs joining one room with concurrent lessons.

For future attendance, separately verify server-authenticated events, stable participant
mapping, webhook authenticity, deduplication, reconnect intervals, and retention. Presence
is not lesson completion and must not automatically move wallet funds.

## See also

- [Implementation handoff and latest Google clarification](class-1-handoff.md)
- [Product journeys](user-journeys.md#5--lesson-delivery)
- [Database gaps](database-schema.md)
- [Domain vocabulary](../CONTEXT.md)
- [Research operation log](sources/knowledge-log.md)
