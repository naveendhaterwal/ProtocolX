# PROTOCOLX PHASE 2 — MACHINE INVENTORY & HARDWARE ALLOCATION

**Document Version:** 2.0.0  
**Network Subnet:** `10.7.0.0/19` (Private Campus Wi-Fi/LAN)  
**Integration Lead:** Naveen (Mac 1)  
**Verification Date:** November 24, 2026  

---

## 1. Executive Summary

Phase 2 scales ProtocolX from a local multi-service simulation into a production-grade, four-physical-Mac distributed architecture communicating over an active campus LAN (`10.7.0.0/19`). 

To ensure complete reproducibility, stability, and zero configuration drift, every participating node has undergone live automated hardware enumeration and identity verification. All inter-machine orchestration is managed from Mac 1 using non-interactive Ed25519 cryptographic authentication.

---

## 2. Machine Hardware & Network Matrix

| Attribute | Mac 1 (Control / Primary DNS) | Mac 2 (Edge Proxy / Gateway) | Mac 3 (Backend A Worker) | Mac 4 (Backend B / Backup DNS) |
| :--- | :--- | :--- | :--- | :--- |
| **Owner / Lead** | **Naveen** | **Shagun** | **Archit** | **Aditya** |
| **Assigned Role** | Central Dashboard, API, Primary DNS | Nginx Edge Proxy, TLS, Load Balancer | Primary Backend Service A | Secondary Backend B, Backup DNS |
| **Hostname** | `naveen-3.local` | `rahul.local` (`MacBook-Pro-133`) | `Archits-MacBook-Pro-4.local` | `vk.local` |
| **Verified LAN IP** | `10.7.11.221` | `10.7.10.188` | `10.7.6.165` | `10.7.18.164` |
| **Network Interface** | `en0` (Wi-Fi) | `en0` (Wi-Fi) | `en0` (Wi-Fi) | `en0` (Wi-Fi) |
| **MAC Address** | `12:f3:d6:58:21:ee` | `4e:75:48:29:07:cf` | `8c:85:90:39:ec:9d` | `6c:3e:6d:15:3e:7b` |
| **macOS Version** | macOS 26.4 (Darwin 24.3.0) | macOS 14.x / 15.x | macOS 14.x / 15.x | macOS 14.x / 15.x |
| **System User** | `n2` | `Apple` | `architmomdiya` | `flexer` |
| **Repo Directory** | `/Users/n2/Desktop/CN/CN-Phase1-ProtocolX` | `/Users/Apple/Downloads/cn` | `/Users/architmomdiya/ProtocolX` | `/Users/flexer/Documents/Projects/CN/ProtocolX` |
| **Node.js Path** | `/opt/homebrew/bin/node` | `/usr/local/bin/node` | `/usr/local/bin/node` | `/usr/local/bin/node` |
| **Allocated Ports** | `4000` (Dashboard/API), `53` (DNS) | `80` (HTTP), `443` (HTTPS) | `3001` (Backend A) | `3002` (Backend B), `53` (Backup DNS) |
| **SSH Method** | Local Controller | Ed25519 Authorized Key | Ed25519 Authorized Key | Ed25519 Authorized Key |
| **Active Status** | Online (Primary Orchestrator) | Gateway Host | Online (Service A Listening) | Online (Service B Listening) |

---

## 3. Node-by-Node Detailed Breakdown

### Mac 1: Control Center & Primary DNS
- **Assignee:** Naveen
- **Responsibilities:**
  1. Centralized Real-time Dashboard (`React + Vite + Tailwind CSS`) running on `http://10.7.11.221:4000`.
  2. Central Monitoring REST & Socket.IO API backed by embedded SQLite WAL persistence.
  3. Primary `dnsmasq` service resolving `app.protocolx.test -> 10.7.10.188` (Mac 2 Edge) on UDP/TCP port 53.
  4. TTL Experiment Controller managing migration DNS tests.
  5. Git integration and remote command execution audit logger.
- **Verification Command:**
  ```bash
  curl -i http://10.7.11.221:4000/api/nodes
  dig @127.0.0.1 app.protocolx.test
  ```

### Mac 2: Nginx Reverse Proxy & Load Balancer
- **Assignee:** Shagun
- **Responsibilities:**
  1. Upstream Reverse Proxy and Load Balancer listening on ports 80 (HTTP redirect) and 443 (HTTPS).
  2. TLS 1.3 Termination using custom ProtocolX PKI certificates (`tls/app.protocolx.test.crt`).
  3. Passive health check monitoring with `max_fails=2 fail_timeout=10s`.
  4. Automatic upstream failover via `proxy_next_upstream error timeout http_502 http_503`.
  5. Standby Edge migration target.
- **Verification Command:**
  ```bash
  curl -k -i https://10.7.10.188/api/status
  ```

### Mac 3: Backend Worker A
- **Assignee:** Archit
- **Responsibilities:**
  1. Primary Backend Worker Node running on Node.js port 3001.
  2. Health check endpoint `/api/health` and workload endpoint `/api/status`.
  3. Emits custom header `X-Backend: A` and JSON payload identifying node origin.
  4. Subject of fault injection and recovery validation.
  5. Target of PF firewall service isolation policy.
- **Verification Command:**
  ```bash
  curl -i http://10.7.6.165:3001/api/status
  # Expected: HTTP 200 OK, X-Backend: A, JSON payload with backend: "A"
  ```

### Mac 4: Backend Worker B & Backup DNS
- **Assignee:** Aditya
- **Responsibilities:**
  1. Secondary Backend Worker Node running on Node.js port 3002.
  2. Emits custom header `X-Backend: B` and JSON payload identifying node origin.
  3. Secondary `dnsmasq` server on port 53 providing redundant DNS resolution.
  4. PF firewall rule verification and safe rollback management.
- **Verification Command:**
  ```bash
  curl -i http://10.7.18.164:3002/api/status
  dig @10.7.18.164 app.protocolx.test
  # Expected: HTTP 200 OK, X-Backend: B; DNS returns 10.7.10.188
  ```

---

## 4. Connectivity & Trust Baseline

All inter-machine remote control operations are secured through standard public-key cryptography:
- **Public Key Injected:** `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHoyxphLpOZMF9opy6M/Ie4MFZ2oUzdNZKRJ5h6Ui/Ls nn03092005@gmail.com`
- **Authorized Keys File:** `~/.ssh/authorized_keys` with permissions `600` on each remote host.
- **Remote Execution Boundary:** Strict whitelisting enforced at the Central API. Arbitrary bash/zsh execution is blocked. All executions require authenticated tokens and are recorded in the audit trail.
