---
type: raw
source: https://developers.google.com/workspace/meet/api/guides/meeting-space-members
collected: 2026-10-24
published: null
capture: Selected source passages
---

# Manage meeting space members

A meeting space member is a user who's configured to have a role in the meeting space. These users can join the meeting space without requesting permission to connect (also known as "knocking").

While meeting organizers can automatically enter the meeting space, you can also configure additional meeting space members to join the meeting without knocking. Additionally, members can be configured to have a [`Role`](https://developers.google.com/workspace/meet/api/reference/rest/v2/spaces.members#role) in the meeting, such as `COHOST` which allows them to co-manage the meeting during a conference, though they cannot configure auto artifacts or alter moderation settings. For more information about accessing a meeting space without knocking, see [`AccessType`](https://developers.google.com/workspace/meet/api/reference/rest/v2/spaces#accesstype).

The [`spaces.members`](https://developers.google.com/workspace/meet/api/reference/rest/v2/spaces.members) resource includes the `name`, `email`, and `role` fields.

## Create a member

To add a member to a meeting space, use the [`create`](https://developers.google.com/workspace/meet/api/reference/rest/v2/spaces.members/create) method on the [`spaces.members`](https://developers.google.com/workspace/meet/api/reference/rest/v2/spaces.members) resource.
