---
type: raw
source: https://docs.daily.co/docs/guides/privacy-and-security/controlling-who-joins-a-meeting.md
collected: 2026-10-24
published: null
capture: Selected source sections
---

# Controlling who joins a meeting

## The room privacy setting

When a room is created, its `privacy` [setting](https://docs.daily.co/reference/rest-api/rooms/create-room.md#body-privacy) defaults to `"public"`. **Anyone who knows the room's URL can join a public room.**

For many workflows, public rooms are the right approach. If you create rooms on the fly for one-time use, let the [room creation](https://docs.daily.co/reference/rest-api/rooms/create-room.md) API generate a random name automatically — the URL will be impossible to guess, so only the people you share it with can join. You can also set an `exp` time on the room so it is automatically deleted after use.

For other workflows, you will want to restrict access. For example, if you use human-readable room names, someone could guess a room name and join uninvited. Or, if you reuse meeting rooms, you may want to control access so that even people who have the URL can't always join.

To restrict access, set the room's `privacy` to `"private"`.

A private room can be joined with a [meeting token](https://docs.daily.co/docs/guides/privacy-and-security/meeting-tokens.md) or by knocking (if the room property `enable_knocking` is set to `true`).

> [!NOTE]
>
> If you change a room from public to private while participants are in it, those participants will remain. Anyone else who tries to join after the change will need a token or to knock.

## Meeting tokens

A [meeting token](https://docs.daily.co/docs/guides/privacy-and-security/meeting-tokens.md) is the most flexible way to grant access to a private room. Tokens can be unique per participant, time-limited, and carry additional user properties.

Any valid meeting token grants access to a private room. The preferred way to pass a token is via the `token` parameter in [`join()`](https://docs.daily.co/reference/daily-js/instance-methods/join) or [`preAuth()`](https://docs.daily.co/reference/daily-js/instance-methods/pre-auth):

```javascript
call.join({ url: DAILY_ROOM_URL, token: DAILY_MEETING_TOKEN });
```

> [!WARNING]
>
> Always set the `room_name` property when creating meeting tokens to control room access. A token without a `room_name` grants access to **any** room in your domain.

## Meeting owner privileges

Participants who join with the `is_owner` meeting token property set to `true` have access to elevated privileges during a call, including:

* Starting or stopping a live stream
* Allowing participants in (private rooms only)
* Triggering [`updateParticipant()`](https://docs.daily.co/reference/daily-js/instance-methods/update-participant)
* Muting camera and microphone for others in [Daily Prebuilt](https://docs.daily.co/docs/prebuilt.md)
