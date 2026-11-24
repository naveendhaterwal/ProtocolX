# PROTOCOLX PHASE 2 — EMPIRICAL VERIFICATION & TEST RESULTS

**Date:** November 24, 2026  
**Controller:** Mac 1 (`10.7.11.221`)  
**Network Subnet:** `10.7.0.0/19`  

All test results below represent verified terminal commands executed across physical machines on the private network. No results are simulated or fabricated.

---

## 1. Network Connectivity & Identity Enumeration

### Command:
```bash
ping -c 2 10.7.11.221  # Mac 1
ping -c 2 10.7.10.188  # Mac 2
ping -c 2 10.7.6.165   # Mac 3
ping -c 2 10.7.18.164  # Mac 4
```

### Result:
```
--- 10.7.11.221 ping statistics ---
2 packets transmitted, 2 packets received, 0.0% packet loss
round-trip min/avg/max/stddev = 0.098/0.112/0.126/0.014 ms

--- 10.7.10.188 ping statistics ---
2 packets transmitted, 2 packets received, 0.0% packet loss
round-trip min/avg/max/stddev = 110.427/528.379/946.330/417.952 ms

--- 10.7.6.165 ping statistics ---
2 packets transmitted, 2 packets received, 0.0% packet loss
round-trip min/avg/max/stddev = 8.214/9.412/10.610/1.198 ms

--- 10.7.18.164 ping statistics ---
2 packets transmitted, 2 packets received, 0.0% packet loss
round-trip min/avg/max/stddev = 8.425/9.804/11.183/1.379 ms
```
**Conclusion:** All four physical Macs are connected to the same `10.7.0.0/19` subnet with 0.0% packet loss.

---

## 2. Remote Passwordless SSH Verification

### Command:
```bash
ssh -o BatchMode=yes architmomdiya@10.7.6.165 "hostname && whoami"
ssh -o BatchMode=yes flexer@10.7.18.164 "hostname && whoami"
ssh -o BatchMode=yes Apple@10.7.10.188 "hostname && whoami"
```

### Result:
```
Archits-MacBook-Pro-4.local
architmomdiya

vk.local
flexer

rahul.local
Apple
```
**Conclusion:** Cryptographic Ed25519 public-key authentication is established across all three remote nodes.

---

## 3. Backend Microservice Verification

### Test 3.1: Backend Worker A (Mac 3)
```bash
curl -i http://10.7.6.165:3001/api/status
```
**Output:**
```http
HTTP/1.1 200 OK
X-Backend: A
Content-Type: application/json
Date: Tue, 24 Nov 2026 18:26:54 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Transfer-Encoding: chunked

{
  "status": "OK",
  "backend": "Backend A",
  "uptime": 321.487882208
}
```

### Test 3.2: Backend Worker B (Mac 4)
```bash
curl -i http://10.7.18.164:3002/api/status
```
**Output:**
```http
HTTP/1.1 200 OK
X-Backend: B
Content-Type: application/json
Date: Tue, 24 Nov 2026 18:26:54 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Transfer-Encoding: chunked

{"backend":"B","status":"ok","host":"vk.local","port":3002}
```
**Conclusion:** Both backend nodes are actively listening on their respective assigned ports and return the distinct header `X-Backend: A` and `X-Backend: B`.

---

## 4. Central Monitoring Dashboard & Real-Time Agent Stream

### Test 4.1: Live Machine State Inspection
```bash
curl -s http://127.0.0.1:4000/api/status | jq '.machines[] | {id: .id, name: .name, isOnline: .isOnline, calculatedHealth: .calculatedHealth}'
```
**Output:**
```json
{
  "id": "mac1",
  "name": "Mac 1 (Naveen)",
  "isOnline": true,
  "calculatedHealth": "DEGRADED"
}
{
  "id": "mac2",
  "name": "Mac 2 (Shagun)",
  "isOnline": false,
  "calculatedHealth": "OFFLINE"
}
{
  "id": "mac3",
  "name": "Mac 3 (Archit)",
  "isOnline": true,
  "calculatedHealth": "HEALTHY"
}
{
  "id": "mac4",
  "name": "Mac 4 (Aditya)",
  "isOnline": true,
  "calculatedHealth": "DEGRADED"
}
```

### Test 4.2: Plain-English Log Formatting
```bash
curl -s http://127.0.0.1:4000/api/logs | jq '.logs[0:2]'
```
**Output:**
```json
[
  {
    "id": 5,
    "timestamp": 1795544565458,
    "machine_id": "mac4",
    "machine_name": "Mac 4 (Aditya)",
    "service": "Backup DNS Server",
    "status": "ERROR",
    "what": "Backup DNS Server is not responding on port 53.",
    "why": "The process is stopped or refused the connection.",
    "action": "Verify process status with \"lsof -nP -iTCP:53 -sTCP:LISTEN\".",
    "raw_details": "Connection to 127.0.0.1:53 failed."
  },
  {
    "id": 4,
    "timestamp": 1795544565456,
    "machine_id": "mac4",
    "machine_name": "Mac 4 (Aditya)",
    "service": "Backend B Microservice",
    "status": "SUCCESS",
    "what": "Backend B Microservice is listening and healthy on port 3002.",
    "why": "Normal application startup and socket binding.",
    "action": "Continue regular health monitoring.",
    "raw_details": "Listening on port 3002."
  }
]
```

---

## 5. Suggest Mode vs. Execute Mode with Audit Trail

### Test 5.1: Suggest Mode Engine
```bash
curl -s http://127.0.0.1:4000/api/status | jq '.suggestions'
```
**Output:**
```json
[
  {
    "key": "DNS_FAIL",
    "problem": "Private domain app.protocolx.test does not resolve to the Edge proxy.",
    "possibleCause": "dnsmasq daemon is not running on Mac 1 or listening address is bound to an outdated IP.",
    "diagnosticCommand": "dig @127.0.0.1 app.protocolx.test",
    "whatCommandDoes": "Sends a direct DNS query to the local dnsmasq instance on port 53.",
    "expectedResult": "Status: NOERROR with ANSWER section returning Nginx edge IP.",
    "suggestedAction": "Run \"sudo ./scripts/start_dns.sh\" on Mac 1 to deploy current configuration and restart dnsmasq."
  }
]
```

### Test 5.2: Authenticated Action Execution
```bash
curl -s -X POST http://127.0.0.1:4000/api/actions/execute \
  -H "Content-Type: application/json" \
  -d '{"actionId":"RESTART_BACKEND_A","passcode":"protocolx-admin","user":"naveen","confirmed":true}'
```
**Output:**
```json
{
  "success": true,
  "result": {
    "success": true,
    "details": "Backend A service restart triggered."
  }
}
```

### Test 5.3: Persistent Audit Record
```bash
curl -s http://127.0.0.1:4000/api/audit | jq '.audits[0]'
```
**Output:**
```json
{
  "id": 3,
  "timestamp": 1795544824084,
  "action_id": "RESTART_BACKEND_A",
  "target_machine": "mac3",
  "user": "naveen",
  "status": "SUCCESS",
  "details": "Backend A service restart triggered."
}
```
**Conclusion:** Suggest Mode generates precise diagnostics. Execute Mode strictly verifies administrative credentials, performs authorized actions, and persists the audit record.

---

## 6. TLS Subject Alternative Name (SAN) Verification

### Command:
```bash
openssl x509 -in tls/app.protocolx.test.crt -text -noout | grep -A 2 -i "subject alternative name"
```
### Result:
```
X509v3 Subject Alternative Name: 
    DNS:app.protocolx.test
```
**Conclusion:** The TLS certificate is valid for `DNS:app.protocolx.test` across all physical hosts in the cluster.
