---
type: raw
source: https://docs.livekit.io/frontends/reference/tokens-grants.md
collected: 2026-10-24
published: null
capture: Selected source sections
---

# Access tokens & grants

## Overview

For a LiveKit SDK to successfully connect to the server, it must pass an access token with the request. This token encodes the identity of a participant, name of the room, capabilities (for example, publishing audio, video, or data), and permissions (for example, permission to moderate a room). Access tokens are JWT-based and signed with your API secret to prevent forgery.

> 🔥 **Don't put PII in identity or room name**
>
> Participant identity and room name are recorded in logs and traces throughout LiveKit and its infrastructure, and aren't removed by [PII redaction](https://docs.livekit.io/testing/observability/pii-redaction.md). Don't put personally identifiable information (such as real names, phone numbers, or email addresses) in these fields. Use an opaque identifier such as a UUID, and map it to user data in your own backend.

Access tokens also carry an expiration time, after which the server rejects connections with that token. Expiration time only impacts the initial connection, and not subsequent reconnects. To learn more, see [Token refresh](#token-refresh).

## Token lifecycle

Tokens have a lifecycle that includes refresh and permission updates during a session.

### Token refresh

LiveKit server proactively issues refreshed tokens to connected clients, ensuring they can reconnect if disconnected. Refreshed tokens expire after 10 minutes or the remaining lifetime of the original token, whichever is longer. This lets clients with long-lived tokens reconnect successfully after extended network drops.

Tokens are also automatically refreshed when there are changes to a participant's name, permissions, or metadata.

### Token revocation

When a participant's permissions are updated or they are removed from a room, their existing token is automatically revoked. This prevents the participant from using an old, cached token to reconnect with outdated permissions.

> ℹ️ **Cloud-only feature**
>
> Token revocation is only available on LiveKit Cloud. For [self-hosted deployments](#self-hosted), see the following section.

Token revocation works by tracking the token's not-before (`nbf`) timestamp. When permissions change or a participant is removed, the server sets a revocation cutoff and rejects reconnections from tokens whose `nbf` is earlier than it. By default, the cutoff is the server's current time, with a one-minute buffer to allow for clock differences.

This security feature ensures:

- Removed participants can't rejoin with their existing token while the revocation is in effect.
- Permission revocations take effect immediately, even for reconnections.
- Participants must request a new token to reconnect.

Because revocation is evaluated per token against its `nbf` value, and LiveKit [refreshes tokens](#token-refresh) automatically during a session, a participant can hold a refreshed token whose `nbf` is more recent than the one you revoked. With the default one-minute buffer, a token issued within about a minute of the removal still passes the check, so the participant can rejoin until that token expires. To reject a rejoin strictly, pass an explicit `revoke_token_ts` when you call `RemoveParticipant`.

You can also revoke the token of a participant who has already left the room by calling `RemoveParticipant` with their identity. By default, the API returns a `participant does not exist` error, but the token is still revoked. Pass `revoke_token_ts` to set the revocation cutoff to a specific moment (for example, an event in your own app's timeline) and receive a successful response instead.

On LiveKit Cloud, a revocation stays in effect for 10 minutes after the `RemoveParticipant` or `UpdateParticipant` call. After that, LiveKit accepts the revoked token again if it hasn't expired. Tokens issued without an explicit time-to-live (TTL) default to 6 hours in most server SDKs (10 minutes in Ruby), so to make sure a removed participant can't rejoin, issue tokens with a TTL of 10 minutes or less, for example `ttl: '10m'` in Node.js or `SetValidFor(10 * time.Minute)` in Go. A short TTL doesn't disconnect participants who are already connected. LiveKit refreshes their tokens every 5 minutes.

To learn more, see [Remove participant](https://docs.livekit.io/intro/basics/rooms-participants-tracks/participants.md#removeparticipant) and [Setting an explicit revocation cutoff](https://docs.livekit.io/intro/basics/rooms-participants-tracks/participants.md#removeparticipant-revoke-token-ts).

#### Self-hosted deployments

For self-hosted deployments, removing a participant or updating their permissions doesn't invalidate the participant's existing token. To prevent a participant from rejoining the same room or using a token with outdated permissions, generate access tokens with a short Time-To-Live (TTL).

When you remove a participant, do not generate a new token for the same participant via your application's backend.
