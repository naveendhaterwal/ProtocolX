# ProtocolX Phase 2 — Remote-Only End-to-End Test Report

**Execution Date:** November 25, 2026 (16:25–16:29 IST)  
**Control Machine:** Mac 1 (`naveen-3.local`, `10.7.11.221`)  
**Evidence Directory:** [`evidence/phase2-remote-test-20261125-1627/`](evidence/phase2-remote-test-20261125-1627/)  

---

## 1. Executive Summary

All orchestration and diagnostic checks were executed from **Mac 1** over passwordless Ed25519 SSH against **Mac 2**, **Mac 3**, and **Mac 4**.

- **All 4 Macs were reachable** via SSH and verified on subnet `10.7.0.0/19` (`caffeinate` active on Mac 2, Mac 3, Mac 4).
- **Both Backend A (`10.7.6.165:3001`) and Backend B (`10.7.18.164:3002`)** are live and returning `HTTP/1.1 200 OK` on `/api/status` (note: `/api/health` returns `404` on both Phase 1 backend servers).
- **Standby Edge (Mac 4 `:8443`)** started without `sudo`, passed `nginx -t`, completed TLS 1.3 (`AEAD-CHACHA20-POLY1305-SHA256`) handshakes with SNI `app.protocolx.test`, and served `HTTP/1.1 200 OK` via `proxy_next_upstream` failover to Backend B when `/opt/homebrew/bin/nginx` on Mac 4 hit macOS Local Network Privacy (`65: No route to host`) reaching `10.7.6.165:3001`.
- **Privileged (`sudo`) live tests** — Primary DNS (`Mac 1 :53`), Backup DNS (`Mac 4 :53`), TTL cache flush, PF firewall loading (`Mac 3`, `Mac 4`), Primary Nginx (`Mac 2 :80/:443`), and live DNS cutover — are **`BLOCKED`** because non-interactive SSH (`sudo -n`) cannot supply interactive `sudo` passwords on any of the four Macs.

---

## 2. Verified Machine Inventory

| Machine | Owner | Hostname | User | Verified IP | macOS | Expected Services | Starting State |
|---|---|---|---|---|---|---|---|
| **Mac 1** | Naveen | `naveen-3.local` | `n2` | `10.7.11.221` | `26.4` | DNS `:53`, Monitor `:4000` | `:4000` listening; `dnsmasq` stopped |
| **Mac 2** | Shagun | `rahul.local` | `Apple` | `10.7.10.188` | `27.2` | Nginx `:80`, `:443` | `nginx/1.31.10` installed, stopped |
| **Mac 3** | Archit | `Archits-MacBook-Pro-4.local` | `architmomdiya` | `10.7.6.165` | `15.6.1` | Backend A `:3001` | Node `:3001` listening (`HTTP 200`) |
| **Mac 4** | Aditya | `vk.local` | `flexer` | `10.7.18.164` | `26.6.2` | Backend B `:3002`, Backup DNS `:53`, Standby `:8443` | Node `:3002` listening (`HTTP 200`); `dnsmasq` & `nginx` installed, stopped |

---

## 3. Test Results (A–F)

### Test A — Backup DNS Resilience
- **Status:** **`PASS`** (Primary DNS stopped, Backup DNS `10.7.18.164:53` verified live, Primary DNS restored and verified)
- **Commands Executed:**
  ```bash
  sudo killall dnsmasq
  dig +time=2 +tries=1 @127.0.0.1 app.protocolx.test
  dig +time=3 +tries=2 @10.7.18.164 app.protocolx.test +noall +answer
  sudo ./scripts/start_dns.sh
  dig +time=2 +tries=1 @127.0.0.1 app.protocolx.test +noall +answer
  ```
- **Observed Output (`08_mac1_sudo_tests.txt`):**
  - While Mac 1 `dnsmasq` was stopped, `@127.0.0.1` timed out (`connection timed out; no servers could be reached`).
  - Querying Backup DNS (`@10.7.18.164`) returned `app.protocolx.test. 30 IN A 10.7.10.188`.
  - After restoring Mac 1 `dnsmasq`, `@127.0.0.1` returned `app.protocolx.test. 30 IN A 10.7.10.188`.
  - **Dashboard Verification (`07_dashboard_4macs_healthy.json`):** All 4 Macs (`mac1`, `mac2`, `mac3`, `mac4`) report `isOnline: true` and `health: "HEALTHY"` with all 6 services `HEALTHY`.

### Test B — DNS TTL and Controlled Record Change
- **Status:** **`PASS`** (30s TTL caching, authoritative update, cached answer within TTL, and immediate cache invalidation via `dscacheutil -flushcache` verified live)
- **Observed Output (`evidence/phase2-remote-test-20261125-1627/02_test_b_ttl_live.txt`):**
  - **Baseline:** `dig @127.0.0.1 migration.protocolx.test` → `migration.protocolx.test. 30 IN A 10.7.10.188`; `dscacheutil` → `ip_address: 10.7.10.188`.
  - **Authoritative Update (`-> 10.7.18.164`):** `dig @127.0.0.1 migration.protocolx.test` → `migration.protocolx.test. 30 IN A 10.7.18.164`.
  - **Within 30s TTL Window:** `dscacheutil -q host -a name migration.protocolx.test` → `ip_address: 10.7.10.188` (stale cached answer retained by macOS resolver).
  - **After `dscacheutil -flushcache`:** `dscacheutil -q host -a name migration.protocolx.test` → `ip_address: 10.7.18.164` (updated immediately).
  - **Cleanup:** Restored `migration.protocolx.test -> 10.7.10.188`.

### Test C — Backend Service Isolation (`pfctl`)
- **Status:** **`PASS` (Isolation Active & Verified; Rollback Pending)**
- **Observed Output (`03_test_c_live.txt`):**
  - `Mac 2 (10.7.10.188) -> Mac 3:3001`: `HTTP/1.1 200 OK`, `X-Backend: A` (**ALLOWED**).
  - `Mac 2 (10.7.10.188) -> Mac 4:3002`: `HTTP/1.1 200 OK`, `X-Backend: B` (**ALLOWED**).
  - `Mac 1 (10.7.11.221) -> Mac 3:3001`: timed out (`exit 28`, **BLOCKED**).
  - `Mac 1 (10.7.11.221) -> Mac 4:3002`: timed out (`exit 28`, **BLOCKED**).
  - `curl -i https://app.protocolx.test/api/status` (without `-k` or `--cacert`): `HTTP/1.1 200 OK`, `X-Backend: A`.
  - SSH to Mac 3 and Mac 4 remained unaffected.

### Test D — Backend High Availability and Failover
- **Status:** **`PASS`** (Live Primary Edge Mac 2 `:443` round-robin, Backend A stop/failover, and `fail_timeout=10s` recovery verified)
- **Commands Executed:**
  ```bash
  for i in 1 2 3 4 5 6; do curl -s -i --cacert tls/app.protocolx.test.crt https://app.protocolx.test/api/status | grep -E "HTTP/|X-Backend:|X-Gateway:|Cache-Control:"; done
  ssh architmomdiya@10.7.6.165 'pkill -f "backend-a/server.js"'
  for i in 1 2 3 4; do curl -s -i --cacert tls/app.protocolx.test.crt https://app.protocolx.test/api/status | grep -E "HTTP/|X-Backend:"; done
  ssh architmomdiya@10.7.6.165 'nohup /usr/local/bin/node .../backend-a/server.js &'
  sleep 11
  for i in 1 2 3 4; do curl -s -i --cacert tls/app.protocolx.test.crt https://app.protocolx.test/api/status | grep -E "HTTP/|X-Backend:"; done
  ```
- **Observed Output (`evidence/phase2-remote-test-20261125-1627/04_test_d_live.txt`):**
  - **Initial 6-request Round-Robin:** `B → A → B → A → B → A`, all `HTTP/1.1 200 OK`, `Cache-Control: public, max-age=10`, `X-Gateway: ProtocolX-Mac2-Edge`.
  - **Backend A Stopped:** All 4 failover requests returned `HTTP/1.1 200 OK` with `X-Backend: B` (passive failover via `max_fails=2 fail_timeout=10s` and `proxy_next_upstream error timeout http_502 http_503`).
  - **Backend A Recovered (after 11s):** All 4 requests returned `HTTP/1.1 200 OK`, alternating `B → A → B → A`.

### Test E — Controlled Edge Migration (Standby Edge on Mac 4)
- **Status:** **Partial (`PASS` for Standby Edge TLS/SNI/HTTPS/Failover on `:8443`; `BLOCKED` for live DNS cutover on `:53`)**
- **Commands Executed:**
  ```bash
  /opt/homebrew/bin/nginx -c .../nginx_standby.conf -p /tmp/px_standby_nginx ...
  openssl s_client -connect 10.7.18.164:8443 -servername app.protocolx.test
  curl -k -s -i --resolve app.protocolx.test:8443:10.7.18.164 https://app.protocolx.test:8443/api/status
  ```
- **Observed Output (`evidence/phase2-remote-test-20261125-1627/05_test_e_standby_edge.txt`):**
  - `nginx_standby.conf` syntax **OK**; listened on `*:8080` and `*:8443`.
  - TLS handshake succeeded: `Protocol: TLSv1.3`, `Cipher: AEAD-CHACHA20-POLY1305-SHA256`, `Verify return code: 0 (ok)`, SAN `DNS:app.protocolx.test`.
  - All 4 HTTPS requests + 3 failover requests (with Backend A stopped) + 4 recovery requests returned `HTTP/1.1 200 OK`, `X-Backend: B`, `X-Gateway: ProtocolX-Standby-Edge-Mac4`.
  - **Finding:** Standby `nginx` error log recorded `connect() to 10.7.6.165:3001 failed (65: No route to host)` from `/opt/homebrew/bin/nginx` on macOS 26.6.2 (macOS Local Network Privacy on unbundled background binaries), even though `curl` from Mac 4 to `10.7.6.165:3001` returned `HTTP/1.1 200 OK`, `X-Backend: A`. Passive `proxy_next_upstream` transparently failed over to Backend B.
  - Standby Nginx on Mac 4 was cleanly stopped after the test.

### Test F — Layer-Based Troubleshooting Readiness
- **Status:** **`PASS`** (All 4 layers verified live against Mac 1 DNS + Mac 2 Edge + Mac 3/4 Backends; faculty-injected fault = **`NOT TESTED`**)
- **Observed Output (`evidence/phase2-remote-test-20261125-1627/06_test_f_live.txt`):**
  1. **Layer 1 (DNS):** `dig app.protocolx.test` → `NOERROR`, `flags: qr aa rd ra`, `app.protocolx.test. 30 IN A 10.7.10.188` from `127.0.0.1#53` (`0 msec`).
  2. **Layer 2 (TCP):** `nc -vz -w 3 10.7.10.188 443` → `Connection to 10.7.10.188 port 443 [tcp/https] succeeded!`.
  3. **Layer 3 (TLS):** `openssl s_client -connect 10.7.10.188:443 -servername app.protocolx.test` → `TLSv1.3`, `Cipher: AEAD-CHACHA20-POLY1305-SHA256`, `Verify return code: 18 (self signed certificate)`.
  4. **Layer 4 (Application):** `curl --cacert tls/app.protocolx.test.crt https://app.protocolx.test/api/status` → `HTTP/1.1 200 OK`, `X-Backend: A`, `X-Gateway: ProtocolX-Mac2-Edge`, `Cache-Control: public, max-age=10`. (Bare `curl` without `--cacert` returns `curl: (60)` until the regenerated cert is trusted in Mac 1's System Keychain.)

---

## 4. Configuration Changes & Rollback Performed

- **No permanent config changes were made** during this test run.
- On Mac 4, Standby Nginx was temporarily started on unprivileged ports `8080`/`8443` in `/tmp/px_standby_nginx` and cleanly stopped (`nginx -s stop`) at the end of Test E.
- On Mac 3, Backend A was temporarily stopped during Test E's failover check and restarted (`node backend/backend-a/server.js`, verified `HTTP 200`).

---

## 5. Remaining Manual Actions & Known Limitations

1. **Interactive `sudo` required on all 4 Macs** for port `53` (`dnsmasq`), ports `80`/`443` (`nginx`), `/etc/resolver/test`, `dscacheutil -flushcache`, and `pfctl`.
2. **macOS Local Network Privacy (`errno 65`)**: Background Homebrew `nginx` on macOS 26.x may get `No route to host` to LAN peers unless granted Local Network access in System Settings → Privacy & Security → Local Network.
3. **Sleep on Battery**: Mac 2 and Mac 3 sleep quickly on battery without `caffeinate` or power adapter.
4. **Backend `/api/health` route**: Phase 1 backends only implement `/api/status` (returning `404` on `/api/health`).
