# ProtocolX Phase 2 — Quick Command Reference (Start / Stop / Bypass)

Use these one-line commands on each Mac to reconnect after a disconnect, demonstrate service failures/failover, or bypass/rollback the firewall.

---

## 1. Reconnect / Start Everything After Disconnecting

*(If Naveen's Mac 1 IP changes from `10.7.11.221`, replace `10.7.11.221` in the `--server=` flag on Mac 2, Mac 3, and Mac 4.)*

### Mac 1 (Naveen — Primary DNS + Dashboard Server + Agent)
```bash
cd /Users/n2/Desktop/CN/CN-Phase1-ProtocolX && sudo ./scripts/start_dns.sh && nohup node server/server.js >/tmp/px-server.log 2>&1 & nohup node agent/agent.js --machine=mac1 --server=http://127.0.0.1:4000 >/tmp/px-agent.log 2>&1 &
```

### Mac 2 (Shagun — Keep Awake + Nginx Edge + Agent)
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

## 2. Stop Individual Services (For Fault & Failover Demos)

| Service | Machine | One-Line Stop Command |
|---|---|---|
| **Primary DNS** | Mac 1 | `sudo killall dnsmasq` |
| **Backup DNS** | Mac 4 | `sudo killall dnsmasq` |
| **Nginx Edge** | Mac 2 | `sudo /opt/homebrew/bin/nginx -s stop \|\| sudo killall nginx` |
| **Standby Edge** | Mac 4 | `/opt/homebrew/bin/nginx -s stop -c /tmp/px_standby_nginx/nginx_standby.conf -p /tmp/px_standby_nginx -g "pid /tmp/px_standby_nginx/nginx.pid; error_log /tmp/px_standby_nginx/error.log;"` |
| **Backend A (`:3001`)** | Mac 3 | `pkill -f "backend-a/server.js"` |
| **Backend B (`:3002`)** | Mac 4 | `pkill -f "backend-b/server.js"` |
| **Dashboard Server (`:4000`)** | Mac 1 | `pkill -f "server/server.js"` |
| **Monitoring Agent** | Any Mac | `pkill -f "agent/agent.js"` |
| **Stop Everything on a Mac** | Any Mac | `pkill -f "server/server.js"; pkill -f "agent/agent.js"; pkill -f "backend-"; sudo killall dnsmasq 2>/dev/null; sudo killall nginx 2>/dev/null; true` |

---

## 3. Firewall, Rollback & Bypass Commands

### Enable Backend Service Isolation (PF)
- **Mac 3 (Archit):**
  ```bash
  cd ~/ProtocolX && sudo ./scripts/apply_firewall.sh mac3
  ```
- **Mac 4 (Aditya):**
  ```bash
  cd ~/Documents/Projects/CN/ProtocolX && sudo ./scripts/apply_firewall.sh mac4
  ```

### Restore / Rollback Firewall to Original State
```bash
sudo ./scripts/rollback_firewall.sh
```

### Emergency Bypass / Disable PF Completely (if backup file is missing)
```bash
sudo pfctl -d && sudo pfctl -F all
```

### Flush macOS Client DNS Cache
```bash
sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder
```

### Bypass DNS and Test Edge Directly
```bash
curl -i --resolve app.protocolx.test:443:10.7.10.188 https://app.protocolx.test/api/status
```
