# ProtocolX Phase 2 — Final Team Verification & Engineering Report

**Execution Date:** November 25, 2026  
**Network Subnet:** `10.7.0.0/19` (Campus Private LAN)  
**Evidence Directory:** [`evidence/phase2-remote-test-20261125-1627/`](evidence/phase2-remote-test-20261125-1627/)  

---

## 1. Executive Summary

All four team members configured, verified, and demonstrated the **ProtocolX Phase 2** distributed architecture across four physical macOS machines:

- **Naveen (Mac 1 — `10.7.11.221`)**: Primary DNS (`dnsmasq`), DNS TTL experiment, Central Monitoring Server & Dashboard (`:4000`), and client-side end-to-end verification.
- **Shagun (Mac 2 — `10.7.10.188`)**: Nginx Edge Gateway (`:80`, `:443`), TLS 1.3 termination, round-robin load balancing, and passive backend failover.
- **Archit (Mac 3 — `10.7.6.165`)**: Backend Worker A (`:3001`), failure/recovery testing, and Packet Filter (`pfctl`) service isolation + rollback.
- **Aditya (Mac 4 — `10.7.18.164`)**: Backend Worker B (`:3002`), Backup DNS (`dnsmasq :53`), Standby Edge Gateway (`:8443`), and `pfctl` isolation + rollback.

All **6 Phase 2 requirements (`A`–`F`)** passed live verification and all four machines + six services reported `ONLINE` and `HEALTHY` on the Central Control Center (`http://localhost:4000`).

---

## 2. Verified Machine Inventory

| Machine | Team Member | Hostname | Verified IP | macOS | Assigned Services | Final State |
|---|---|---|---|---|---|---|
| **Mac 1** | Naveen | `naveen-3.local` | `10.7.11.221` | `26.4` | Primary DNS `:53`, Monitor `:4000` | `ONLINE` / `HEALTHY` |
| **Mac 2** | Shagun | `rahul.local` | `10.7.10.188` | `27.2` | Nginx Edge `:80`, `:443` | `ONLINE` / `HEALTHY` |
| **Mac 3** | Archit | `Archits-MacBook-Pro-4.local` | `10.7.6.165` | `15.6.1` | Backend A `:3001` | `ONLINE` / `HEALTHY` |
| **Mac 4** | Aditya | `vk.local` | `10.7.18.164` | `26.6.2` | Backend B `:3002`, Backup DNS `:53`, Standby `:8443` | `ONLINE` / `HEALTHY` |

---

## 3. Test Results (A–F)

### Test A — Backup DNS Resilience (**`PASS`**)
- **Lead:** Naveen (Mac 1) & Aditya (Mac 4)
- **Verification:**
  - Naveen stopped Primary DNS on Mac 1 (`sudo killall dnsmasq`); `dig @127.0.0.1 app.protocolx.test` timed out as expected.
  - Querying Aditya's Backup DNS (`dig @10.7.18.164 app.protocolx.test`) returned `app.protocolx.test. 30 IN A 10.7.10.188`.
  - Naveen restored Primary DNS (`sudo ./scripts/start_dns.sh`) and confirmed `dig @127.0.0.1 app.protocolx.test` returned `10.7.10.188`.
- **Evidence:** `01_test_a_dns_live.txt`, `08_mac1_sudo_tests.txt`, `07_dashboard_4macs_healthy.json`.

### Test B — DNS TTL and Controlled Record Change (**`PASS`**)
- **Lead:** Naveen (Mac 1)
- **Verification (`02_test_b_ttl_live.txt`):**
  - Baseline: `dig @127.0.0.1 migration.protocolx.test` returned `migration.protocolx.test. 30 IN A 10.7.10.188`; `dscacheutil -q host -a name migration.protocolx.test` returned `10.7.10.188`.
  - Authoritative update (`-> 10.7.18.164`): `dig @127.0.0.1` immediately returned `10.7.18.164`.
  - Within 30s TTL window: `dscacheutil` still returned the cached `10.7.10.188`.
  - After `sudo dscacheutil -flushcache`: `dscacheutil` immediately returned `10.7.18.164`.
  - Cleanup restored `migration.protocolx.test -> 10.7.10.188`.

### Test C — Backend Service Isolation & Rollback (**`PASS`**)
- **Lead:** Archit (Mac 3) & Aditya (Mac 4)
- **Verification (`03_test_c_live.txt`, `03_test_c_rollback_live.txt`):**
  - Archit applied `sudo ./scripts/apply_firewall.sh mac3` and Aditya applied `sudo ./scripts/apply_firewall.sh mac4`.
  - From Shagun's Edge (`10.7.10.188`): `curl http://10.7.6.165:3001/api/status` (`X-Backend: A`) and `curl http://10.7.18.164:3002/api/status` (`X-Backend: B`) both returned `HTTP/1.1 200 OK` (**ALLOWED**).
  - From Mac 1 (`10.7.11.221`): direct `curl` to `:3001` and `:3002` timed out (`exit 28`, **BLOCKED**), while `https://app.protocolx.test/api/status` through Mac 2 Edge returned `HTTP/1.1 200 OK`.
  - Both Archit and Aditya ran `sudo ./scripts/rollback_firewall.sh`, restoring their saved rulesets and returning PF to `disabled`. Direct reachability to `:3001` and `:3002` returned `HTTP/1.1 200 OK`.

### Test D — Backend High Availability and Failover (**`PASS`**)
- **Lead:** Shagun (Mac 2), Archit (Mac 3), & Aditya (Mac 4)
- **Verification (`04_test_d_live.txt`):**
  - 6-request round-robin through `https://app.protocolx.test/api/status`: `B → A → B → A → B → A` (`HTTP/1.1 200 OK`, `Cache-Control: public, max-age=10`, `X-Gateway: ProtocolX-Mac2-Edge`).
  - Archit stopped Backend A on Mac 3: all 4 requests through Mac 2 returned `HTTP/1.1 200 OK` via `X-Backend: B` (passive failover using `max_fails=2 fail_timeout=10s` and `proxy_next_upstream error timeout http_502 http_503`).
  - Archit restarted Backend A and after `fail_timeout=10s`, alternation resumed: `B → A → B → A`.

### Test E — Controlled Edge Migration (**`PASS`**)
- **Lead:** Aditya (Mac 4) & Naveen (Mac 1)
- **Verification (`05_test_e_standby_edge.txt`, `05_test_e_cutover_live.txt`):**
  - Aditya started Standby Nginx on Mac 4 (`:8443`); TLSv1.3 (`AEAD-CHACHA20-POLY1305-SHA256`) with SAN `DNS:app.protocolx.test` and HTTPS proxying (`X-Gateway: ProtocolX-Standby-Edge-Mac4`) passed.
  - Naveen cut over `app.protocolx.test -> 10.7.18.164` in Primary DNS, observed macOS cache retention (`10.7.10.188`) before flush and `10.7.18.164` after flush, then restored `10.7.10.188` (`HTTP/1.1 200 OK` via `ProtocolX-Mac2-Edge`).
  - Standby Nginx was cleanly stopped after verification.

### Test F — Layer-Based Troubleshooting Readiness (**`PASS`**, fault injection `NOT TESTED`)
- **Lead:** Naveen (Mac 1)
- **Verification (`06_test_f_live.txt`, `08_mac1_sudo_tests.txt`):**
  1. **DNS:** `dig app.protocolx.test` → `NOERROR`, `10.7.10.188` (`0 msec`).
  2. **TCP:** `nc -vz 10.7.10.188 443` → `succeeded!`.
  3. **TLS:** `openssl s_client -connect 10.7.10.188:443 -servername app.protocolx.test` → `TLSv1.3` (`CN=app.protocolx.test`); trusted in Mac 1 System Keychain.
  4. **Application:** `curl -i https://app.protocolx.test/api/status` (no `-k` or `--cacert`) → `HTTP/1.1 200 OK`.

---

## 4. Problems Faced & How the Team Resolved Them

| # | Problem Faced | Root Cause | How We Tackled It |
|---|---|---|---|
| 1 | **DHCP IP Drift & Stale Phase 1 Configs** | Campus Wi-Fi (`10.7.0.0/19`) reassigned all four Mac IPs; `/etc/resolver/test` still pointed to `10.7.7.218` and `nginx.conf` pointed to old Phase 1 backends. | Each member verified their live `en0` IP (`PHASE2_MACHINE_INVENTORY.md`), updated `dnsmasq.conf`, `dnsmasq_backup.conf`, `nginx.conf`, and made `start_dns.sh` detect `en0` dynamically. |
| 2 | **Laptop Sleep Dropping Edge & Backends** | MacBooks on battery entered sleep after ~30 seconds of inactivity, dropping Wi-Fi and breaking connections. | Team members ran `caffeinate -d -i -m -u &` on Mac 2, Mac 3, and Mac 4 during testing. |
| 3 | **TLS Key/Certificate Mismatch on Mac 2** | Mac 2's local `app.protocolx.test.key` did not match the committed `app.protocolx.test.crt` (`SSL: error:05800074::key values mismatch`). | Shagun regenerated `app.protocolx.test.crt` from Mac 2's private key using `tls/openssl.cnf` (SAN `DNS:app.protocolx.test`) and Naveen trusted it in Mac 1's System Keychain so `curl` passes without `-k`. |
| 4 | **Starter Script Binary Detection Bug** | `which ... && echo ...` in `start_nginx.sh` and `start_backup_dns.sh` duplicated the path string across two lines, failing `[ -x "$BIN" ]`. | Replaced with clean `command -v` / `if-elif` detection in both scripts. |
| 5 | **TTL Experiment Not Reloading `dnsmasq.conf`** | `killall -HUP dnsmasq` does not re-read `dnsmasq.conf`, and `dig @127.0.0.1` bypasses macOS `mDNSResponder` cache. | Updated `scripts/dns_ttl_experiment.sh` to restart `dnsmasq` cleanly and query both `dig @127.0.0.1` (authoritative) and `dscacheutil -q host` (OS cache). |
| 6 | **PF Rule Ordering & Rollback Section Error** | Catch-all `block in quick` before `pass in quick` blocked Edge traffic; saving `-sn` before `-sr` put `nat-anchor` before `scrub-anchor`, causing `pfctl` syntax error on rollback. | Placed `pass in quick` before `block in quick` in `pf_backend_a.conf`/`pf_backend_b.conf`, enforced `scrub → nat/rdr → filter` ordering in `apply_firewall.sh`/`rollback_firewall.sh`, and documented that Standby Edge (`10.7.18.164`) hits `504` if PF only whitelists `10.7.10.188`. |
| 7 | **Dashboard Auth & Agent `EHOSTUNREACH`** | Plaintext `protocolx-admin` lacked session/CSRF/replay protection, and backgrounded `fetch` hit macOS Local Network Privacy (`EHOSTUNREACH`). | Replaced with salted `scrypt` hashes in gitignored `server/.env`, `HttpOnly; SameSite=Strict` cookies, `X-CSRF-Token`, nonce replay protection, and Socket.IO `agent-report` streaming. |
