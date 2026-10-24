---
type: raw
source: https://docs.livekit.io/transport/self-hosting/deployment/
collected: 2026-10-24
published: null
capture: Selected source sections
---

# Deploying LiveKit

> WebRTC servers can be tricky to deploy because of their use of UDP ports and having to know their own public IP address. This guide will help you get a secure LiveKit deployment up and running.

## Domain, SSL certificates, and load balancer

In order to have a secure LiveKit deployment, you will need a domain as well as a SSL certificate for that domain. This domain will be used as the primary endpoint for LiveKit SDKs, for example: `wss://livekit.yourhost.com`. The SSL certificate must be signed by a trusted certificate authority; self-signed certs do not work here.

You will also need to set up HTTPS/SSL termination with a load balancer or reverse proxy.

If you are using TURN, then a separate TURN domain and SSL cert will be needed, as well.

## Improving connectivity with TURN

Certain corporate firewalls block not only UDP traffic, but non-secure TCP traffic, as well. In those cases, it's helpful to use a TURN server. [Here's](https://bloggeek.me/webrtc-turn/) a good resource if you're interested in reading more about how TURN is used.

The good news is LiveKit includes an embedded TURN server. It's a secure TURN implementation that has integrated authentication with the rest of LiveKit. The authentication layer ensures that only clients that have already established a signal connection could connect to our TURN server.

## Resources

The scalability of LiveKit is bound by CPU and bandwidth. We recommend running production setups on 10Gbps ethernet or faster.

When deploying to cloud providers, compute-optimized instance types are the most suitable for LiveKit.

If running in a Dockerized environment, host networking should be used for optimal performance.
