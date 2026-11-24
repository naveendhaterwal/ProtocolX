# ProtocolX — Phase 2 Team Working Rules & Operational Guidelines

All team members must follow these 10 principles during Phase 2 development, testing, and evidence collection.

---

## 1. Network & Subnet Integrity
All four Mac laptops must connect to the same private LAN (`10.7.0.0/19`). Confirm Wi-Fi SSID and interface `en0` status before testing.

## 2. Dynamic IP Awareness
Never assume Phase 1 IP addresses remain valid. Dynamic DHCP leases expire and change across sessions. Every session begins with `ipconfig getifaddr en0`.

## 3. Centralized Coordination
Share updated IP addresses with Naveen (Mac 1) before altering shared configurations (`dnsmasq.conf`, `nginx.conf`, or client resolvers).

## 4. Configuration Safety & Backups
Never overwrite working configurations without creating a timestamped or named backup. Phase 1 baselines are archived under `backups/phase1/`.

## 5. End-to-End Verification Standard
Every task requires three completed phases:
1. **Implementation** (Code or configuration deployed)
2. **Testing** (Direct probe and cross-machine verification)
3. **Evidence** (Raw terminal transcript saved under `evidence/`)

## 6. Simple-English Logging
Write monitoring and diagnostic logs in simple, understandable English following the standard 4-line format:
```text
[TIME] [MACHINE] [SERVICE] [STATUS]

[WHAT HAPPENED]

[WHY IT MAY HAVE HAPPENED]

[WHAT SHOULD BE DONE]
```

## 7. Dual-Layer Diagnostics
Keep technical error codes (e.g. `ECONNREFUSED`, `ETIMEDOUT`, `ENOTFOUND`, exit code 35) alongside clear human explanations so both developers and evaluators understand the failure.

## 8. Safe Firewall Operations
Never apply packet filtering (`pfctl`) or Application Firewall rules without pre-written rollback scripts (`sudo pfctl -d`). Always verify normal connectivity before and after firewall experiments.

## 9. Secure Dashboard Operations
Never expose unrestricted remote terminal or shell access through the web dashboard. All remote operations must be selected from the approved actions whitelist, require admin authentication, and be recorded in the security audit trail.

## 10. Honest Reporting
Report completed work honestly. An untested task is never marked as passed. If a test fails or is partially complete, document the real status and resolution plan.

---

## Team Roles & Ownership Matrix (Phase 2)

| Node | Owner | Role | Key Responsibilities | Port Bindings |
|---|---|---|---|---|
| **Mac 1** | **Naveen** | Integration Lead & Primary DNS | Primary `dnsmasq`, TTL experiment, central monitoring server, dashboard, project integration | `UDP/53`, `TCP/4000` |
| **Mac 2** | **Shagun** | Edge Gateway & Resilience Lead | Nginx reverse proxy, HTTPS/TLS termination, round-robin load balancing, passive upstream failover | `TCP/80`, `TCP/443` |
| **Mac 3** | **Archit** | Backend A Application Lead | Node.js Backend A microservice, health endpoints (`/`, `/api/status`), `X-Backend: A` header, failure testing | `TCP/3001` |
| **Mac 4** | **Aditya** | Backend B & Security Lead | Node.js Backend B microservice, `X-Backend: B` header, Backup DNS server, firewall rules & rollback | `TCP/3002`, `UDP/53` |
