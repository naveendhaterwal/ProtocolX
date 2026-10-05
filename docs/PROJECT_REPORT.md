# ProtocolX — Phase 1 Project Analysis Report

**Course:** Computer Networks
**Repository:** https://github.com/naveendhaterwal/ProtocolX
**Report date:** 2026-10-05
**Scope:** Static review of the repository at `main` (commit `3f40986`) — configuration, source, certificates, and archived evidence. The live four-machine deployment was not re-run for this report; runtime claims are assessed against the evidence files committed to the repo.

---

## 1. Executive Summary

ProtocolX is a four-host private service platform on a shared Wi-Fi LAN (`10.7.0.0/19`). It chains together private DNS (`dnsmasq`), a TLS-terminating reverse proxy and round-robin load balancer (`nginx`), two independent Node.js backends, client-side cache headers, packet-level verification (Wireshark), and a live failover test.

**Overall assessment: the project meets its stated objectives.** Each of the eight functional phases has matching configuration in the repo and corresponding evidence (terminal transcripts, a packet capture, and screenshots). The design is small, readable, and uses no third-party runtime dependencies.

| Area | Status | Notes |
|---|---|---|
| Private DNS | Complete | `app.protocolx.test` → `10.7.12.189`, verified with `dig` and `dscacheutil` |
| HTTPS / TLS | Complete | TLS 1.3 negotiated, SAN matched, verified **without** `curl -k` |
| Load balancing | Complete | Strict A/B alternation observed over 4–6 request runs |
| Caching | Complete (client-side only) | `Cache-Control: public, max-age=10`; no `proxy_cache` |
| Packet analysis | Complete | 3.8 MB `.pcapng` + 5 screenshots (DNS, TCP, TLS) |
| Failover | Complete | 3-stage demo; 0 failed requests during backend outage |
| Documentation | Strong, with defects | Detailed README; several portability/accuracy issues (§7) |
| Final submission | Open | Demo video and form submission unchecked in README |

**Key findings (detail in §7):** a hard-coded certificate path from another user's machine in `nginx.conf`; `file:///Users/n2/...` links in the README that are broken on GitHub; `start_dns.sh` not actually deploying the repo's `dnsmasq.conf`; and no explicit passive-health-check tuning for the failover behaviour that the project relies on.

---

## 2. Repository Overview

| Metric | Value |
|---|---|
| Branch / remote | `main` → `origin/main` (in sync), 2 feature branches on origin |
| Commits | 17 across all branches (incl. 3 merged PRs) |
| Contributors | 4 team members (6 git identities — see §8) |
| Application code | 68 lines of JavaScript across 2 files |
| Config / scripts | `nginx.conf` (47 lines), `dnsmasq.conf`, `openssl.cnf`, `start_dns.sh` |
| Evidence | 4 transcript files, 1 pcapng (3.8 MB), 5 PNG screenshots |
| Dependencies | None (Node `http`/`os` stdlib only) |

### Layout

```
backend/backend-a, backend-b   Node.js services (ports 3001, 3002)
dns/dnsmasq.conf               Private DNS config
nginx/nginx.conf               Edge proxy, TLS, LB, caching header
tls/                           openssl.cnf + public certificate (key is gitignored)
scripts/start_dns.sh           dnsmasq launcher + macOS resolver setup
evidence/A…D                   Verification artefacts per area
docs/                          (empty until this report)
```

---

## 3. Architecture

```
Mac 1 (10.7.7.218)         Mac 2 (10.7.12.189)               Mac 3 / Mac 4
client + dnsmasq  ──DNS──▶ nginx :80 → 301 → :443 (TLS) ──▶  Backend A 10.7.16.69:3001
                  ──HTTPS─▶ upstream protocolx_backends  ──▶  Backend B 10.7.13.247:3002
```

1. Client resolves `app.protocolx.test` via local `dnsmasq` (scoped through `/etc/resolver/test`).
2. Client opens TCP/443 to the edge; TLS 1.3 terminates at nginx.
3. nginx proxies plaintext HTTP to the next upstream in round-robin order and returns the backend's `X-Backend` header to the client.
4. `/api/status` additionally gets `Cache-Control: public, max-age=10`.

**Design strengths:** clean separation of concerns across hosts; clients never see backend addresses; a single DNS name decouples users from topology.

---

## 4. Component Analysis

### 4.1 Private DNS (`dns/dnsmasq.conf`)
- Authoritative-style `address=/app.protocolx.test/10.7.12.189`; binds only to loopback and the LAN IP (`bind-interfaces`); `no-resolv` + explicit upstreams avoids resolver loops. Choosing `.test` (RFC 2606/6761) is correct.
- Evidence (`A-lan-dns/dns_verification.txt`) shows `NOERROR`, `aa` flag set, answer `10.7.12.189`, via both the system resolver and the LAN address.
- **Observation:** Sections 1 and 3 of that file (config syntax test, listening sockets) contain no real output — the first is empty and the second is a placeholder line.

### 4.2 Edge proxy and load balancer (`nginx/nginx.conf`)
- Port 80 returns `301` to HTTPS; port 443 enables TLS 1.2/1.3; `proxy_connect_timeout 2s` bounds failover delay; standard `X-Real-IP` / `X-Forwarded-*` headers are set.
- Load balancing is nginx's default round-robin with no weights, `max_fails`, `fail_timeout`, or `keepalive` — acceptable for the demo, but see §7.
- `/api/status` uses `proxy_method GET` so that `HEAD` requests (`curl -I`) return real data; `/` does not, and backends only handle `GET`, so `curl -I https://app.protocolx.test/` returns **404** (visible in `https_lb_verification.txt` §2). This is a backend limitation, not an nginx fault.

### 4.3 TLS (`tls/`)
Independently verified from the committed certificate:

| Property | Value |
|---|---|
| Subject / Issuer | `CN=app.protocolx.test` (self-signed) |
| Key / signature | RSA 2048 / SHA-256 |
| SAN | `DNS:app.protocolx.test` |
| `basicConstraints` | `CA:FALSE` |
| Validity | 2026-10-01 → **2027-10-01** |

The private key is excluded by `.gitignore` (`*.key`) and is not in the repo — correct practice. The leaf certificate is installed directly as a trust root on the client, which works on macOS and avoids `-k`, but a small private CA issuing a leaf would be the more conventional design.

### 4.4 Backends (`backend/`)
- Both are minimal, syntax-valid (`node --check` passes), bind `0.0.0.0`, set `X-Backend`, serve `/` and `/api/status`, and return 404 otherwise.
- **Inconsistencies:** Backend A returns JSON at `/` and has no request logging, no `package.json` sibling in B, and a `PORT` env override; Backend B hard-codes its port, logs each request, and returns plain text at `/`. Their `/api/status` JSON schemas also differ (`status: "OK"` vs `"ok"`, `uptime` vs `host`/`port`).

### 4.5 Caching
Headers-only caching, correctly documented in the README as client-side (no `proxy_cache`). Evidence confirms the header on 200 responses. Note that nginx `add_header` applies only to 2xx/3xx unless `always` is given, so error responses carry no cache directive — appropriate here.

### 4.6 Packet capture
`protocolX.pcapng` (3.8 MB) and screenshots document DNS query/response, the TCP three-way handshake to port 443, and TLS 1.3 Client/Server Hello with SNI. The README's note that the certificate is encrypted under TLS 1.3 (RFC 8446) is accurate. The capture could not be programmatically inspected in this review (`tshark` not installed), so its contents were assessed from the screenshots and README only.

### 4.7 Failure demonstration
`failure-demo.txt` shows: baseline A/B alternation → Backend B stopped (`Connection refused`) → six consecutive requests all served by A with `200 OK` → Backend B restarted → alternation resumes. This validates nginx's default passive failover (`proxy_next_upstream error timeout` on a refused connection). It demonstrates a *clean process stop*; a host crash or network partition (silent drop) was not tested and would incur the 2 s `proxy_connect_timeout` per affected request.

---

## 5. Objective Traceability

| # | Objective | Implementation | Evidence | Met |
|---|---|---|---|---|
| 1 | LAN discovery / connectivity | Static IP inventory in README | README, `nc` checks in failure demo | Yes |
| 2 | Private DNS for `.test` | `dnsmasq.conf`, `/etc/resolver/test` | `dns_verification.txt`, DNS screenshots | Yes |
| 3 | Reverse proxy decoupling | nginx + DNS abstraction | `https_lb_verification.txt` | Yes |
| 4 | HTTPS without `-k` | Self-signed SAN cert in System Keychain | "SSL certificate verify ok", TLSv1.3 | Yes |
| 5 | Round-robin LB across hosts | `upstream protocolx_backends` | A/B/A/B outputs (3 files) | Yes |
| 6 | Caching semantics | `Cache-Control` header | `caching_verification.txt` | Yes (headers only) |
| 7 | L3/L4/L7 packet inspection | Wireshark on Mac 4 | `.pcapng`, 5 screenshots | Yes |
| 8 | Failover resilience | Default nginx passive checks | `failure-demo.txt` | Yes |

---

## 6. Strengths

- Every objective is backed by committed, reproducible evidence rather than assertion.
- Zero-dependency, easily auditable code; secrets handled correctly (key ignored).
- Strict TLS verification demonstrated honestly, without insecure flags.
- README includes an architecture diagram, request flow, setup steps per machine, an end-to-end verification sequence, and a repeatable failure procedure.
- Healthy collaboration workflow: feature branches and merged pull requests for the nginx work.

---

## 7. Findings and Recommendations

Ranked by impact on a reader or grader reproducing the project.

| # | Severity | Finding | Recommendation |
|---|---|---|---|
| 1 | High | `nginx.conf` points `ssl_certificate(_key)` to `/Users/flexer/Documents/Projects/CN/ProtocolX/tls/…` — a different user's absolute path. The README shows a `/path/to/…` placeholder instead, so the two disagree and the committed config will not start on any other machine. | Use a placeholder/relative path (nginx resolves relative to its prefix) or document the required edit; keep README and config identical. |
| 2 | High | README contains 12 `file:///Users/n2/Desktop/CN/…` links. They are dead on GitHub. | Replace with relative links (`tls/app.protocolx.test.crt`, `evidence/…`). |
| 3 | Medium | `scripts/start_dns.sh` starts dnsmasq with `/opt/homebrew/etc/dnsmasq.conf` but never copies `dns/dnsmasq.conf` there, while the README says the script "deploys configuration". Fresh setups would run with the wrong config. | Add `cp "$(dirname "$0")/../dns/dnsmasq.conf" /opt/homebrew/etc/dnsmasq.conf` before launching. Also add a check that it is run as root. |
| 4 | Medium | Failover relies on nginx defaults; there is no `max_fails` / `fail_timeout` / `proxy_next_upstream` and no `proxy_read_timeout`. A hung (not refused) backend would stall requests. | Set explicit values (e.g. `max_fails=2 fail_timeout=10s`, `proxy_next_upstream error timeout http_502 http_503`) and extend the demo with a network-partition case. |
| 5 | Medium | Backends accept `GET` only; `HEAD /` yields 404 through the proxy. | Handle `HEAD` in both backends (or document). |
| 6 | Low | Backend A and B differ in response shape, logging, port configuration, and packaging. | Align to one template; add `package.json` to B; make A log requests. |
| 7 | Low | Evidence gaps: empty `dnsmasq` syntax-test output and placeholder socket listing in `dns_verification.txt`; evidence dated as UTC in headers but IST in `dig`. | Re-capture `dnsmasq --test` and `sudo lsof -iUDP:53`; note timezones. |
| 8 | Low | Security hardening absent: backends listen on all interfaces and receive plaintext from nginx; no HSTS; TLS cipher policy left at defaults; cert expires 2027-10-01. | Document as accepted scope for a lab; optionally bind backends to LAN IP, add `Strict-Transport-Security`, calendar certificate renewal. |
| 9 | Low | Housekeeping: heading typo "Conclusion-"; empty `docs/`, `wireshark/`, `.gitkeep` files; six git identities for four people; a stale copy of `evidence/` and four empty `mac*` folders exist one level above the repo (not tracked). | Fix typo; merge identities via `.mailmap`; delete or ignore the stray parent-folder copies. |
| 10 | Info | Final-submission items (demo video, Google Form) are still unchecked. | Complete before deadline. |

### Suggested hardening snippet (for finding 4)

```nginx
upstream protocolx_backends {
    server 10.7.16.69:3001  max_fails=2 fail_timeout=10s;
    server 10.7.13.247:3002 max_fails=2 fail_timeout=10s;
}
...
proxy_next_upstream error timeout http_502 http_503;
proxy_read_timeout 5s;
```

---

## 8. Team and Contribution Summary

| Member | Machine | Role | Repo evidence |
|---|---|---|---|
| Naveen | Mac 1 | Coordination, DNS, trust setup, failure demo | DNS commit, keychain/HTTPS verification, README, evidence |
| Aditya | Mac 2 | nginx, TLS, LB, caching | PRs #1–#3 (Phase 4, 5, 6) |
| Shagun | Mac 3 | Backend A | "Add Backend A" |
| Archit | Mac 4 | Backend B, Wireshark | "Add Backend B", Phase 7 capture |

Commit counts by git identity: naveendhaterwal 8, Naveen Kumar 3, RajAditya7777 3, Archit Mamodiya 1, Shagun Vishnoi 1, shagunvishnoi 1. Code contributions from Mac 3 and Mac 4 are small in line count but each owns a distinct, required component.

---

## 9. Conclusion

ProtocolX delivers a coherent, observable demonstration of DNS, TCP, TLS, reverse proxying, load balancing, caching headers, and fault tolerance on real hardware, and its evidence supports every claim made. The remaining work is polish rather than substance: fix the two portability defects (nginx certificate path, README links), make the DNS script deploy the repo config, harden and extend the failover test, and finish the submission artefacts. With those changes the repository would be reproducible by a third party in one pass.
