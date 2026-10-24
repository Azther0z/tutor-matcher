---
type: raw
source: https://docs.daily.co/reference/rest-api/meeting-tokens/create-meeting-token.md
collected: 2026-10-24
published: null
capture: Selected OpenAPI properties, copied verbatim
---

```yaml
        eject_at_token_exp:
          type: boolean
          default: false
          description: >-
            Kick this user out of the meeting at the time this meeting token
            expires. If either this property or `eject_after_elapsed` are set
            for the token, the room's `eject` properties are overridden.


            _See an example in our [advanced security
            tutorial](https://www.daily.co/blog/add-advanced-security-features-to-video-chats-with-the-daily-api/)_.
        eject_after_elapsed:
          type: integer
          format: int32
          description: >-
            Kick this user out of the meeting this many seconds after they join
            the meeting. If either this property or `eject_at_token_exp` are set
            for the token, the room's `eject` properties are overridden.


            _See an example in our [advanced security
            tutorial](https://www.daily.co/blog/add-advanced-security-features-to-video-chats-with-the-daily-api/)_.
        nbf:
          type: integer
          format: int32
          description: >-
            "Not before". This is a [unix
            timestamp](https://stackoverflow.com/questions/20822821/what-is-a-unix-timestamp-and-why-use-it)
            (seconds since the epoch.) Users cannot join a meeting in with this
            token before this time.
        exp:
          type: integer
          format: int32
          description: >-
            "Expires". This is a unix timestamp (seconds since the epoch.) Users
            cannot join a meeting with this token after this time.


            Daily strongly recommends adding an `exp` value to all meeting
            tokens. Learn more in our Daily blog post: [Add advanced security to
            video chats with the Daily
            API](https://www.daily.co/blog/add-advanced-security-features-to-video-chats-with-the-daily-api/)
        is_owner:
          type: boolean
          default: false
          description: >-
            The user has [meeting owner
            privileges](/docs/guides/privacy-and-security/controlling-who-joins-a-meeting#meeting-owner-privileges).
            For example, this user can send video, audio, and screenshare, and
            can perform administrative actions like muting other participants.
        user_name:
          type: string
          description: >-
            The user's name in this meeting. The name displays in the user
            interface when the user is muted or has turned off the camera, and
            in the chat window. This username is also saved in the meeting
            events log (meeting events are retrievable using the
            [analytics](/products/rest-api/meetings) API methods.)
        user_id:
          type: string
          description: >-
            The user's ID for this meeting session. During a session, this ID is
            retrievable in the
            [`participants()`](/products/daily-js/instance-methods/participants)
            method and [related participant
            events](/products/daily-js/events/participant-events). Either during
            or after a session concludes, this ID is retrievable using the
            [/meetings](/products/rest-api/meetings) REST API endpoint. You can
            use `user_id` to map between your user database and meeting
            events/attendance.


            For domains configured for [HIPAA
            compliance](/guides/privacy-and-security/hipaa), if the `user_id`
            value is a [UUID](https://www.ietf.org/rfc/rfc4122.txt) (for
            example, `f81d4fae-7dec-11d0-a765-00a0c91e6bf6`), then the UUID will
            be returned for the participant in the
            [`/meetings`](/products/rest-api/meetings) REST API endpoint.
            Otherwise, the string `hipaa` will be returned in order to remove
            potential PHI. During a session, the provided `user_id` will always
            be returned through the `participants()` method and related events,
            regardless of the `user_id` value.


            The `user_id` has a limit of 36 characters.
```
