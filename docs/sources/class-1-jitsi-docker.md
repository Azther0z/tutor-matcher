---
type: raw
source: https://jitsi.github.io/handbook/docs/devops-guide/devops-guide-docker/
collected: 2026-10-24
published: null
capture: Selected source sections
---

# Self-Hosting Guide - Docker

### External Ports

The following external ports must be opened on a firewall:

- `80/tcp` for Web UI HTTP (really just to redirect, after uncommenting `ENABLE_HTTP_REDIRECT=1` in `.env`)
- `443/tcp` for Web UI HTTPS
- `10000/udp` for RTP media over UDP

Also `20000-20050/udp` for jigasi, in case you choose to deploy that to facilitate SIP access.

### Images

- **base**: Debian stable base image with the [S6 Overlay](https://github.com/just-containers/s6-overlay) for process control and the [Jitsi repositories](https://jitsi.org/downloads/) enabled. All other images are based on this one.
- **base-java**: Same as the above, plus Java (OpenJDK).
- **web**: Jitsi Meet web UI, served with nginx.
- **prosody**: [Prosody](https://prosody.im/), the XMPP server.
- **jicofo**: [Jicofo](https://github.com/jitsi/jicofo), the XMPP focus component.
- **jvb**: [Jitsi Videobridge](https://github.com/jitsi/jitsi-videobridge), the video router.
- **jigasi**: [Jigasi](https://github.com/jitsi/jigasi), the SIP (audio only) gateway.
- **jibri**: [Jibri](https://github.com/jitsi/jibri), the broadcasting infrastructure.

### Authentication

Authentication can be controlled with the environment variables below. If guest access is enabled, unauthenticated users will need to wait until a user authenticates before they can join a room. If guest access is not enabled, every user will need to authenticate before they can join.

If authentication is enabled, once an authenticated user logged in, it is always logged in before the session timeout. You can set `ENABLE_AUTO_LOGIN=0` to disable this default auto login feature or you can set `JICOFO_AUTH_LIFETIME` to limit the session lifetime.

#### Authentication using JWT tokens

You can use JWT tokens to authenticate users. To enable it you have to enable authentication with `ENABLE_AUTH` and set `AUTH_TYPE` to `jwt`, then configure the settings you can see below.

| Variable | Description | Example |
| --- | --- | --- |
| `JWT_APP_ID` | Application identifier | my_jitsi_app_id |
| `JWT_APP_SECRET` | Application secret known only to your token | my_jitsi_app_secret |
| `JWT_ACCEPTED_ISSUERS` | (Optional) Set asap_accepted_issuers as a comma separated list | my_web_client,my_app_client |
| `JWT_ACCEPTED_AUDIENCES` | (Optional) Set asap_accepted_audiences as a comma separated list | my_server1,my_server2 |
| `JWT_ASAP_KEYSERVER` | (Optional) Set asap_keyserver to a url where public keys can be found | https://example.com/asap> |
| `JWT_ALLOW_EMPTY` | (Optional) Allow anonymous users with no JWT while validating JWTs when provided | 0 |
| `JWT_AUTH_TYPE` | (Optional) Controls which module is used for processing incoming JWTs | token |
| `JWT_TOKEN_AUTH_MODULE` | (Optional) Controls which module is used for validating JWTs | token_verification |

### Running behind NAT or on a LAN environment

When running running in a LAN environment, or on the public Internet via NAT, the `JVB_ADVERTISE_IPS` env variable should be set. This variable allows to control which IP addresses and ports the JVB will advertise for WebRTC media traffic. It is necessary to set it regardless of the use of a reverse proxy, since it's the IP address that will receive the media (audio / video) and not HTTP traffic, hence it's oblivious to the reverse proxy.
