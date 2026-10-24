---
type: raw
source: https://docs.livekit.io/transport/self-hosting/ports-firewall/
collected: 2026-10-24
published: null
capture: Selected source section
---

# Ports and firewall

> Reference for ports and suggested firewall rules for LiveKit.

## Ports

LiveKit uses several ports to communicate with clients. Exposed ports below need to be open on the firewall.

| Port | Default | Config | Exposed | Description |
| API, WebSocket | 7880 | `port` | no | This port should be placed behind a load balancer that can terminate SSL. LiveKit APIs are homogenous: any client could connect to any backend instance, regardless of the room they are in. |
| ICE/UDP | 50000-60000 | `rtc.port_range_start`, `rtc.port_range_end` | yes | LiveKit advertises these ports as WebRTC host candidates (each participant in the room will use two ports) |
| ICE/TCP | 7881 | `rtc.tcp_port` | yes | Used when the client could not connect via UDP (e.g. VPN, corporate firewalls) |
| ICE/UDP Mux | 7882 | `rtc.udp_port` | yes | (optional) It's possible to handle all UDP traffic on a single port. When this is set, rtc.port_range_start/end are not used |
| TURN/TLS | 5349 | `turn.tls_port` | when not using LB | (optional) For a distributed setup, use a network load balancer in front of the port. If not using LB, this port needs to be set to 443. |
| TURN/UDP | 3478 | `turn.udp_port` | yes | (optional) To use the embedded TURN/UDP server. When enabled, it also serves as a STUN server. |
