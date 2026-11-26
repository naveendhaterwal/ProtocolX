# ProtocolX Phase 2 — Complete Viva, Reconnect & Troubleshooting Playbook

Use this guide to **reconnect all 4 Macs**, **verify everything works**, and **run any live test a professor/examiner asks for**.

---

## 0. Check IPs First (If Laptops Reconnected to Wi-Fi)

Run on each Mac:
```bash
echo "$(hostname) | $(whoami)@$(ipconfig getifaddr en0)"
```
- **Current known IPs:** Mac 1 `10.7.11.221` · Mac 2 `10.7.10.188` · Mac 3 `10.7.6.165` · Mac 4 `10.7.18.164`
- If any IP changed, update `dns/dnsmasq.conf`, `dns/dnsmasq_backup.conf`, and `nginx/nginx.conf`, then restart DNS/Nginx.

---

## 1. Reconnect & Start Everything on All 4 Macs (One-Liners)

### Mac 1 (Naveen — Primary DNS + Dashboard Server + Agent)
```bash
cd /Users/n2/Desktop/CN/CN-Phase1-ProtocolX && sudo ./scripts/start_dns.sh && nohup node server/server.js >/tmp/px-server.log 2>&1 & nohup node agent/agent.js --machine=mac1 --server=http://127.0.0.1:4000 >/tmp/px-agent.log 2>&1 &
```

### Mac 2 (Shagun — Keep Awake + Nginx Edge + Agent)
*(Replace `10.7.11.221` if Mac 1's IP changed)*
```bash
cd ~/Downloads/cn && nohup caffeinate -d -i -m -u >/dev/null 2>&1 & sudo ./scripts/start_nginx.sh && nohup "$HOME/.nvm/versions/node/v25.9.0/bin/node" agent/agent.js --machine=mac2 --server=http://10.7.11.221:4000 >/tmp/px-agent.log 2>&1 &
```

### Mac 3 (Archit — Keep Awake + Backend A + Agent)
```bash
cd ~/ProtocolX && nohup caffeinate -d -i -m -u >/dev/null 2>&1 & nohup /usr/local/bin/node backend/backend-a/server.js >/tmp/backend-a.log 2>&1 & nohup /usr/local/bin/node agent/agent.js --machine=mac3 --server=http://10.7.11.221:4000 >/tmp/px-agent.log 2>&1 &
```

### Mac 4 (Aditya — Keep Awake + Backend B + Backup DNS + Agent)
```bash
cd ~/Documents/Projects/CN/ProtocolX && nohup caffeinate -d -i -m -u >/dev/null 2>&1 & sudo ./scripts/start_backup_dns.sh && nohup /usr/local/bin/node backend/backend-b/server.js >/tmp/backend-b.log 2>&1 & nohup /usr/local/bin/node agent/agent.js --machine=mac4 --server=http://10.7.11.221:4000 >/tmp/px-agent.log 2>&1 &
```

---

## 2. Verify Everything Is Working (Run on Mac 1)

```bash
# 1. DNS (Primary & Backup)
dig +short @127.0.0.1 app.protocolx.test
dig +short @10.7.18.164 app.protocolx.test

# 2. TCP + TLS + HTTPS + 6x Load Balancing (A/B Alternation)
nc -vz -w 2 10.7.10.188 443
for i in 1 2 3 4 5 6; do curl -s -i https://app.protocolx.test/api/status | grep -E "HTTP/|X-Backend:|Cache-Control:"; done

# 3. Check Dashboard API (all 4 Macs HEALTHY)
curl -s http://127.0.0.1:4000/api/status | grep -o '"calculatedHealth":"[^"]*"'
```
Open Dashboard in browser: `http://localhost:4000`

---

## 3. All Teacher / Viva Demo Tests

### A. Backup DNS Failover Test
```bash
# On Mac 1: Stop Primary DNS
sudo killall dnsmasq
dig +time=2 +tries=1 @127.0.0.1 app.protocolx.test       # Expected: times out
dig +time=3 +tries=2 @10.7.18.164 app.protocolx.test     # Expected: 10.7.10.188 (Mac 4 answers!)

# Restore Primary DNS on Mac 1:
cd /Users/n2/Desktop/CN/CN-Phase1-ProtocolX && sudo ./scripts/start_dns.sh
```

### B. 30-Second DNS TTL & Cache Flush Test
```bash
# On Mac 1: Automated 30s TTL experiment
cd /Users/n2/Desktop/CN/CN-Phase1-ProtocolX && sudo ./scripts/dns_ttl_experiment.sh

# Manual OS cache flush anytime:
sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder
```

### C. Firewall (PF) — Enable, Verify, Rollback & Emergency Disable
```bash
# Enable isolation on Mac 3 (:3001) & Mac 4 (:3002):
cd ~/ProtocolX && sudo ./scripts/apply_firewall.sh mac3                   # On Mac 3
cd ~/Documents/Projects/CN/ProtocolX && sudo ./scripts/apply_firewall.sh mac4  # On Mac 4

# Inspect active PF rules:
sudo pfctl -sr

# Verify:
# - On Mac 2 (Edge 10.7.10.188): curl -i http://10.7.6.165:3001/api/status   -> 200 OK (ALLOWED)
# - On Mac 1 (Client 10.7.11.221): curl -m 3 http://10.7.6.165:3001/api/status -> Timeout (BLOCKED)
# - On Mac 1 via Nginx Edge: curl -i https://app.protocolx.test/api/status    -> 200 OK (ALLOWED)

# Safe Rollback (restores saved rules & original PF state):
sudo ./scripts/rollback_firewall.sh

# Emergency Bypass / Disable PF Completely:
sudo pfctl -d && sudo pfctl -F all
```

### D. Backend High Availability & Failover Test
```bash
# 1. Stop Backend A (on Mac 3):
pkill -f "backend-a/server.js"

# 2. On Mac 1: Verify 100% requests still succeed via Backend B
for i in 1 2 3 4; do curl -s -i https://app.protocolx.test/api/status | grep -E "HTTP/|X-Backend:"; done

# 3. Restart Backend A (on Mac 3):
nohup /usr/local/bin/node ~/ProtocolX/backend/backend-a/server.js >/tmp/backend-a.log 2>&1 &

# 4. Wait 11s (> fail_timeout=10s), verify A/B alternation resumes on Mac 1:
sleep 11 && for i in 1 2 3 4; do curl -s -i https://app.protocolx.test/api/status | grep -E "HTTP/|X-Backend:"; done

# Stop / Restart Backend B (on Mac 4):
pkill -f "backend-b/server.js"
nohup /usr/local/bin/node ~/Documents/Projects/CN/ProtocolX/backend/backend-b/server.js >/tmp/backend-b.log 2>&1 &
```

### E. Nginx Edge Stop / Standby Edge Migration
```bash
# Stop Primary Nginx (on Mac 2):
sudo /opt/homebrew/bin/nginx -s stop || sudo killall nginx

# Restart Primary Nginx (on Mac 2):
cd ~/Downloads/cn && sudo ./scripts/start_nginx.sh

# Start Standby Nginx on Mac 4 (:8443) — note: rollback PF first if PF only allows Mac 2:
mkdir -p /tmp/px_standby_nginx/logs && /opt/homebrew/bin/nginx -c ~/Documents/Projects/CN/ProtocolX/nginx/nginx_standby.conf -p /tmp/px_standby_nginx -g "pid /tmp/px_standby_nginx/nginx.pid; error_log /tmp/px_standby_nginx/error.log;"

# Stop Standby Nginx on Mac 4:
/opt/homebrew/bin/nginx -s stop -c ~/Documents/Projects/CN/ProtocolX/nginx/nginx_standby.conf -p /tmp/px_standby_nginx -g "pid /tmp/px_standby_nginx/nginx.pid; error_log /tmp/px_standby_nginx/error.log;"
```

### F. 4-Layer Troubleshooting Commands (Run on Mac 1)
```bash
# Layer 1: DNS
dig app.protocolx.test

# Layer 2: TCP
nc -vz 10.7.10.188 443

# Layer 3: TLS
echo | openssl s_client -connect 10.7.10.188:443 -servername app.protocolx.test 2>/dev/null | grep -E "subject=|Protocol|Cipher|Verify"

# Layer 4: Application (Bypass DNS directly to Edge IP)
curl -i --resolve app.protocolx.test:443:10.7.10.188 https://app.protocolx.test/api/status
```

---

## 4. Stop Everything Cleanly (End of Demo)

- **Mac 1:** `sudo killall dnsmasq; pkill -f "server/server.js"; pkill -f "agent/agent.js"`
- **Mac 2:** `sudo /opt/homebrew/bin/nginx -s stop; pkill -f "agent/agent.js"`
- **Mac 3:** `pkill -f "backend-a/server.js"; pkill -f "agent/agent.js"; sudo ./scripts/rollback_firewall.sh 2>/dev/null || true`
- **Mac 4:** `sudo killall dnsmasq; pkill -f "backend-b/server.js"; pkill -f "agent/agent.js"; sudo ./scripts/rollback_firewall.sh 2>/dev/null || true`
