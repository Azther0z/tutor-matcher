---
type: raw
source: https://developers.google.com/workspace/meet/api/guides/authenticate-authorize
collected: 2026-10-24
published: null
capture: Selected source passages
---

# Authenticate and authorize Meet REST API requests

This guide explains how to use OAuth 2.0 with a user's Google credentials to access the [Meet REST API](https://developers.google.com/workspace/meet/api/reference/rest/v2). Authenticating and authorizing with user credentials lets Meet apps access user data and perform operations on the authenticated user's behalf. By authenticating on a user's behalf, the app has the same permissions as that user and can perform actions as if they were performed by that user.

## Authenticate and authorize using domain-wide delegation

If you're a domain administrator, you can grant [domain-wide delegation of authority](https://support.google.com/a/answer/162106) to authorize an application's service account to access your users' data without requiring each user to give consent. After you configure domain-wide delegation, the [service account can impersonate a user account](https://developers.google.com/identity/protocols/oauth2/service-account#authorizingrequests). Although a service account is used for authentication, domain-wide delegation impersonates a user and is therefore considered *user authentication*. Any capability that requires user authentication can use domain-wide delegation.
