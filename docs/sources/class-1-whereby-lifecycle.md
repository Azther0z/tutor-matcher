---
type: raw
source: https://docs.whereby.com/whereby-product-features/using-the-rest-api/using-create-a-room.md
collected: 2026-10-24
published: null
capture: Selected source sections
---

# Using “Create a room”

The Room Overview page that follows gives you a view at a glance of what you have configured, features handy [host and participant links](https://docs.whereby.com/user-roles-and-privileges), and generates a code snippet you can include in your website.

### Deleting rooms and endDate

Creating rooms via the API, produces a room with a unique URL and a limited lifespan. There's no need to worry about meetings conflicting or rooms being used for other purposes after the intended session.

The `endDate` property is used to indicate the time at which the room will be marked for deactivation. It **does not** indicate when a meeting will end and remove participants.

One hour after the `endDate` things like [Webhook](https://docs.whereby.com/whereby-product-features/insights-suite-and-api/webhooks.md) events, [host](https://docs.whereby.com/whereby-product-features/user-roles-and-privileges.md) privileges, new cloud recordings, and minutes consumption will no longer function. The room will then automatically be deleted within 24 hours of the `endDate` provided.

If you'd like to limit the length of a meeting and verify a room is no longer being used, you can delete a room [via API request](https://docs.whereby.com/reference/whereby-rest-api-reference/meetings.md#delete-meetings-meetingid). A deletion request will remove all participants and prevent any further use. You can also keep track of when a session start via [webhooks](https://docs.whereby.com/whereby-product-features/insights-suite-and-api/webhooks.md) to limit a meeting by length.
