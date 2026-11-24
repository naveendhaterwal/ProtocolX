# PROTOCOLX PHASE 2 — FIREWALL EVALUATION & SERVICE ISOLATION

**Mechanism:** macOS Packet Filter (`pfctl`)  
**Target Nodes:** Mac 3 (`10.7.6.165`) & Mac 4 (`10.7.18.164`)  
**Security Lead:** Aditya (Mac 4) & Naveen (Mac 1)  
**Date:** November 24, 2026  

---

## 1. Firewall Technology Selection on macOS

macOS provides two distinct firewall subsystems:
1. **Application Firewall (`socketfilterfw`):** An application-level filter that prompts for binary execution permissions (e.g., "Do you want node to accept incoming connections?"). It operates at Layer 7 and cannot enforce fine-grained IP-to-port ingress access control policies across LAN subnets.
2. **Packet Filter (`pfctl` / OpenBSD PF):** The standard Layer 3/4 stateful packet inspection engine built into macOS Darwin kernel. It allows deterministic rules evaluated top-to-bottom or with `quick` termination based on source IP, destination IP, protocol, and port numbers.

**Verdict:** Packet Filter (`pfctl`) is the only native macOS tool capable of enforcing strict service isolation (restricting backend ports 3001/3002 to the Nginx Edge gateway IP).

---

## 2. Security Architecture & Threat Model

In a distributed microservice topology, backend application servers (`Backend A: 3001`, `Backend B: 3002`) should never be accessible directly by arbitrary clients on the local network. Direct access bypasses TLS termination, rate limiting, request validation, and caching.

### Access Control Matrix
| Source | Port 22 (SSH) | Port 3001 (Backend A) | Port 3002 (Backend B) | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Mac 1 (10.7.11.221)** | ALLOW | **DROP / BLOCK** | **DROP / BLOCK** | Management (SSH only) |
| **Mac 2 (10.7.10.188)** | ALLOW | ALLOW (Nginx Upstream) | ALLOW (Nginx Upstream) | Reverse Proxy |
| **Loopback (`lo0`)** | N/A | ALLOW (Local Agent Probe) | ALLOW (Local Agent Probe) | Localhost |
| **Arbitrary LAN Hosts** | ALLOW | **DROP / BLOCK** | **DROP / BLOCK** | Unauthorized |

---

## 3. Ruleset Specification & Safety Precautions

To avoid accidental administrator lockout, every rule strictly observes the following non-negotiable principles:
1. **Loopback Protection (`set skip on lo0`):** Internal machine communication (including the local monitoring agent probing `127.0.0.1`) is never filtered.
2. **SSH Protection (`pass in proto tcp to any port 22`):** Administrative SSH connections remain open unconditionally.
3. **Rule Ordering (`quick`):** Specific `pass in quick` for Mac 2 (`10.7.10.188`) is placed *before* the catch-all `block in quick` rule.
4. **Syntax Dry-Run (`pfctl -vnf`):** Every configuration is checked for syntax errors prior to loading.
5. **Backup-and-Restore Rollback (`scripts/rollback_firewall.sh`):** Before applying rules, `apply_firewall.sh` saves the pre-existing PF enabled/disabled status and active ruleset to `/var/tmp/protocolx_pf_backup`. Rollback restores the exact saved ruleset and prior PF state (refusing to blindly flush/disable if no backup exists).

### Mac 3 Rule (`firewall/pf_backend_a.conf`)
```pf
set skip on lo0
pass in proto tcp to any port 22
pass in quick inet proto tcp from 10.7.10.188 to any port 3001
block in quick proto tcp to any port 3001
```

### Mac 4 Rule (`firewall/pf_backend_b.conf`)
```pf
set skip on lo0
pass in proto tcp to any port 22
pass in quick inet proto tcp from 10.7.10.188 to any port 3002
block in quick proto tcp to any port 3002
```

---

## 4. Verification & Rollback Procedures

### Application Procedure
```bash
sudo ./scripts/apply_firewall.sh mac3   # On Mac 3
sudo ./scripts/apply_firewall.sh mac4   # On Mac 4
```

### Verification Tests
1. **Authorized Proxy Access (Pass):**
   ```bash
   # From Mac 2 (10.7.10.188):
   curl -i http://10.7.6.165:3001/api/status   # Returns HTTP 200 OK
   ```
2. **Unauthorized Client Access (Blocked):**
   ```bash
   # From unauthorized LAN client:
   curl -m 3 http://10.7.6.165:3001/api/status # Times out / Connection Refused
   ```

### Rollback Procedure
```bash
sudo ./scripts/rollback_firewall.sh
```
This reads `/var/tmp/protocolx_pf_backup/pf_status.bak` and `/var/tmp/protocolx_pf_backup/pf_rules.bak`, restores the exact previously saved PF ruleset via `pfctl -f`, and restores the prior `enabled` or `disabled` PF state.
