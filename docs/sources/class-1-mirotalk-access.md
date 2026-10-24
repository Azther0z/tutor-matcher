---
type: raw
source: https://docs.mirotalk.com/mirotalk-p2p/host-protection/
collected: 2026-10-24
published: null
capture: Selected source sections
---

# Host Protection

## How It Works

When `HOST_PROTECTED` is `true`:

1. The host must log in with a username and password.
2. On success, the host's IP is saved as an authenticated IP.
3. The host can now create rooms, join rooms, and share links.
4. Guests can join freely while the host is active.
5. When the host leaves the room or closes the browser, their IP is removed — preventing further unauthorized access.
6. The host must log in again to regain access.

When `HOST_USER_AUTH` is also `true`, **participants** are additionally required to authenticate before joining.

## Token

After authentication, a JWT token is stored in `window.sessionStorage.peer_token`. The default expiration is **1 hour**, configurable in the `.env` file. Tokens can also be generated through the [REST API](https://docs.mirotalk.com/mirotalk-p2p/api/).

## Presenters

By default, the **first participant** to join a room becomes its presenter. Use `PRESENTERS` in your `.env` file to add more presenters:

`PRESENTERS` only matches identities the server can verify. It **never** matches the name someone types in the join form. Otherwise, anyone could type a listed name and become presenter.

MiroTalk P2P has no `PRESENTER_JOIN_FIRST` option. The first participant to join a room always becomes presenter, so the moderator should open the room before guests join.

Keep the token link private, because anyone who has it becomes presenter until the token expires. If the moderator is already in the room as a guest, they must leave and rejoin with the token link.
