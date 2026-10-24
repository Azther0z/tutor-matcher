---
type: raw
source: https://docs.daily.co/reference/rest-api/rooms/session/eject.md
collected: 2026-10-24
published: null
capture: Selected source heading and OpenAPI properties
---

# Eject

> Ejects participants from a room

```yaml
                user_ids:
                  type: array
                  items:
                    type: string
                  description: >-
                    List of user_ids (max 100) to eject from the existing
                    meeting session.
                ban:
                  type: boolean
                  default: false
                  description: >-
                    If true, participants are prevented from (re)joining with
                    the given user_ids.
```
