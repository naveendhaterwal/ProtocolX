# ProtocolX

## Computer Networks — Phase 1

ProtocolX is a fully local, multi-machine private network service platform deployed across four macOS laptops on a shared local area network (LAN). The project demonstrates core computer networking protocols and systems engineering concepts in a physical multi-host environment without relying on cloud infrastructure, public domain registrars, or commercial certificate authorities.

Key architectural components demonstrated in this project include:
- **Private DNS Infrastructure**: Local name resolution for the custom `.test` top-level domain using `dnsmasq`.
- **Edge Reverse Proxy & TLS Termination**: Secure entry point terminating TLS 1.3 via `nginx` with automatic HTTP-to-HTTPS redirection.
- **Layer 7 Load Balancing**: Upstream HTTP request distribution across redundant application backends using round-robin scheduling.
- **Isolated Backend Microservices**: Independent Node.js HTTP services exposing distinct identity headers and status endpoints.
- **HTTP Caching Control**: Explicit client caching directives via `Cache-Control` response headers.
- **Network Traffic Analysis**: Full-stack packet capture and protocol verification across DNS, TCP, and TLS layers using Wireshark.
- **High-Availability & Fault Tolerance**: Graceful upstream failure detection and zero-downtime failover demonstration.

---

## Team

| Student | Machine | Primary Responsibility |
|---|---|---|
| **Naveen** | Mac 1 | Project Coordinator, Client-Side Integration, Private DNS Server (`dnsmasq`), Certificate Trust Setup |
| **Aditya** | Mac 2 | Edge Infrastructure, Reverse Proxy (`nginx`), TLS/HTTPS Termination, Load Balancing, Caching Headers |
| **Shagun** | Mac 3 | Backend A Application Service (`Node.js`), Health/Status Endpoints, Host Identity Header |
| **Archit** | Mac 4 | Backend B Application Service (`Node.js`), Wireshark Packet Capture & Analysis, Failure Demo Execution |

---

## Architecture

```text
                     +---------------------------------------+
                     |                 Mac 1                 |
                     |         Naveen (10.7.7.218)           |
                     |                                       |
                     |  +----------------+  +-------------+  |
                     |  | Client Browser |  | dnsmasq     |  |
                     |  | / curl         |  | Port 53     |  |
                     |  +-------+--------+  +------+------+  |
                     +----------|------------------|---------+
                                |                  |
          1. DNS Resolution     |                  |
     app.protocolx.test ->      |                  |
          10.7.12.189           |                  |
                                |                  |
                                v                  |
                     +-----------------------------v---------+
                     |                 Mac 2                 |
                     |         Aditya (10.7.12.189)          |
                     |                                       |
                     |  +---------------------------------+  |
                     |  | nginx Edge / Load Balancer      |  |
                     |  | - Port 80 (HTTP 301 Redirect)   |  |
                     |  | - Port 443 (TLS 1.2/1.3)        |  |
                     |  | - Upstream: protocolx_backends  |  |
                     |  +----------------+----------------+  |
                     +-------------------|-------------------+
                                         |
                       Round-Robin Proxy | Forwarding
                                         |
                    +--------------------+--------------------+
                    |                                         |
                    v                                         v
+---------------------------------------+ +---------------------------------------+
|                 Mac 3                 | |                 Mac 4                 |
|         Shagun (10.7.16.69)           | |         Archit (10.7.13.247)          |
|                                       | |                                       |
|  +---------------------------------+  | |  +---------------------------------+  |
|  | Backend A (Node.js)             |  | |  | Backend B (Node.js)             |  |
|  | Port 3001                       |  | |  | Port 3002                       |  |
|  | Header: X-Backend: A            |  | |  | Header: X-Backend: B            |  |
|  +---------------------------------+  | |  | Wireshark Packet Capture        |  |
|                                       | |  +---------------------------------+  |
+---------------------------------------+ +---------------------------------------+
```

### Request Flow
1. **Name Resolution**: The client on Mac 1 sends a DNS query for `app.protocolx.test`. Local `dnsmasq` on Mac 1 resolves the domain to `10.7.12.189` (Mac 2).
2. **TCP & TLS Handshake**: The client initiates a TCP connection to `10.7.12.189:443`, followed by a TLS 1.3 handshake. `nginx` presents the certificate with SAN `app.protocolx.test`.
3. **HTTP Request**: The client transmits an encrypted HTTP request (e.g., `GET /api/status`).
4. **Edge Processing**: `nginx` decrypts the request, injects standard proxy headers (`X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`), and selects an upstream server via round-robin.
5. **Backend Dispatch**: `nginx` forwards plain HTTP over the internal LAN to either Backend A (`10.7.16.69:3001`) or Backend B (`10.7.13.247:3002`).
6. **Backend Response**: The targeted backend processes the request, appends the identity header (`X-Backend: A` or `X-Backend: B`), and returns JSON data to `nginx`.
7. **Client Delivery**: `nginx` appends edge headers (including `Cache-Control: public, max-age=10` on `/api/status`), encrypts the response, and transmits it back to the client.

---

## Network Topology

All four laptops are connected to a shared local wireless network with subnet `10.7.0.0/19` and default gateway `10.7.0.1`.

| Machine | Hostname / Node | Member | Assigned IP | Listening Ports | Service / Component |
|---|---|---|---|---|---|
| **Mac 1** | `naveen-3.local` | Naveen | `10.7.7.218` | `53/UDP`, `53/TCP` | Client, `dnsmasq` DNS Server |
| **Mac 2** | `Aditya-Mac.local` | Aditya | `10.7.12.189` | `80/TCP`, `443/TCP` | `nginx` Edge, Reverse Proxy, Load Balancer |
| **Mac 3** | `Shagun-Mac.local` | Shagun | `10.7.16.69` | `3001/TCP` | Backend A (`Node.js`) |
| **Mac 4** | `Archits-MacBook-Pro-4.local` | Archit | `10.7.13.247` | `3002/TCP` | Backend B (`Node.js`), Packet Capture |

---

## Technology Stack

- **Operating System**: macOS (Darwin arm64)
- **Local Network**: IEEE 802.11 Wi-Fi (`10.7.0.0/19`, Gateway `10.7.0.1`)
- **DNS Server**: `dnsmasq` 2.93 (Homebrew)
- **Reverse Proxy / Load Balancer**: `nginx` 1.31.6
- **Application Runtimes**: Node.js v18+ (Standard library `http` module, zero external runtime dependencies)
- **Security & Cryptography**: OpenSSL / LibreSSL (TLSv1.2 & TLSv1.3, RSA 2048-bit, X.509 v3 Extensions)
- **Analysis & Diagnostics**: `dig` (BIND 9), `curl` 8.7+, `netcat`, `lsof`, `tcpdump`, `Wireshark` 4.x
- **Version Control & Collaboration**: Git, GitHub

---

## Project Objectives

1. Demonstrate end-to-end LAN host discovery, addressing, and connectivity across heterogeneous peer devices.
2. Establish a private split-horizon DNS server authoritative for a custom top-level domain (`.test`) compliant with RFC 2606 / RFC 6761.
3. Decouple frontend access from backend server infrastructure through edge reverse proxying and DNS abstraction.
4. Implement secure transport (HTTPS) using self-signed TLS certificates without relying on insecure client bypass flags (`curl -k`).
5. Distribute workload evenly across distinct physical machines using round-robin Layer 7 load balancing.
6. Verify caching header semantics and client behavior.
7. Capture and inspect protocol state transitions across Layer 3, Layer 4, and Layer 7 using Wireshark.
8. Validate system resilience and automatic proxy failover when an application backend experiences an abrupt outage.

---

## Private DNS

### Specification
- **Domain Name**: `app.protocolx.test`
- **Resolved IP**: `10.7.12.189` (Mac 2 Edge)
- **Authoritative Daemon**: `dnsmasq` bound to `127.0.0.1:53` and `10.7.7.218:53`

### Why `.test` Namespace?
RFC 2606 reserves `.test` specifically for testing and local development, guaranteeing that queries will not collide with global ICANN top-level domains. Public DNS servers (e.g., `1.1.1.1` or `8.8.8.8`) return `NXDOMAIN` for `.test`, requiring an internal authoritative DNS server.

### Configuration (`dns/dnsmasq.conf`)
```conf
port=53
listen-address=127.0.0.1,10.7.7.218
bind-interfaces
domain-needed
bogus-priv
no-resolv
server=1.1.1.1
server=8.8.8.8
address=/app.protocolx.test/10.7.12.189
```

### macOS Scoped Resolver Setup
To enable native macOS applications and system APIs to resolve `.test` without overriding public resolvers for normal web traffic, a scoped resolver file is installed at `/etc/resolver/test`:
```text
nameserver 127.0.0.1
nameserver 10.7.7.218
port 53
```

### Verification Commands
```bash
# Query private DNS directly on Mac 1
dig @10.7.7.218 app.protocolx.test

# Query via system resolver
dig app.protocolx.test

# Native macOS resolution check
dscacheutil -q host -a name app.protocolx.test
```

---

## Backend Services

The application tier consists of two independent HTTP servers built with pure Node.js standard libraries (`http`, `os`).

### Backend A (Mac 3 — Shagun)
- **Binding**: `0.0.0.0:3001`
- **Identity Header**: `X-Backend: A`
- **Endpoints**:
  - `GET /` -> `200 OK` (JSON: `{"message": "Hello from Backend A", "backend": "Backend A", "status": "healthy"}`)
  - `GET /api/status` -> `200 OK` (JSON: `{"status": "OK", "backend": "Backend A", "uptime": <seconds>}`)

### Backend B (Mac 4 — Archit)
- **Binding**: `0.0.0.0:3002`
- **Identity Header**: `X-Backend: B`
- **Endpoints**:
  - `GET /` -> `200 OK` (Plain text: `Hello from Backend B (Mac 4, host Archits-MacBook-Pro-4.local)`)
  - `GET /api/status` -> `200 OK` (JSON: `{"backend": "B", "status": "ok", "host": "<hostname>", "port": 3002}`)

### Direct LAN Verification Commands
```bash
curl -i http://10.7.16.69:3001/api/status
curl -i http://10.7.13.247:3002/api/status
```

---

## nginx Load Balancing & Reverse Proxy

`nginx` running on Mac 2 acts as the single public gateway for the platform. Clients never address backend IPs directly.

### Configuration (`nginx/nginx.conf`)
```nginx
upstream protocolx_backends {
    server 10.7.16.69:3001;
    server 10.7.13.247:3002;
}

server {
    listen 80;
    server_name app.protocolx.test;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name app.protocolx.test;

    ssl_certificate     /path/to/tls/app.protocolx.test.crt;
    ssl_certificate_key /path/to/tls/app.protocolx.test.key;
    ssl_protocols       TLSv1.2 TLSv1.3;

    proxy_connect_timeout 2s;

    location /api/status {
        proxy_method GET;
        proxy_pass http://protocolx_backends;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        add_header Cache-Control "public, max-age=10";
    }

    location / {
        proxy_pass http://protocolx_backends;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

### Alternation Verification
Requests alternate sequentially between Backend A and Backend B:
```bash
for i in {1..4}; do
  curl -s -D - https://app.protocolx.test/api/status -o /dev/null | grep -i X-Backend
done
```
Output:
```text
X-Backend: A
X-Backend: B
X-Backend: A
X-Backend: B
```

---

## HTTPS / TLS Implementation

### Certificate Generation
A custom X.509 certificate was generated on Mac 2 using OpenSSL (`tls/openssl.cnf`) with:
- **Common Name (CN)**: `app.protocolx.test`
- **Subject Alternative Name (SAN)**: `DNS:app.protocolx.test`
- **Validity**: 365 Days
- **Key Spec**: RSA 2048-bit

### Trust Store Installation on Client
Rather than bypassing security using insecure options (`curl -k` or `--insecure`), the public certificate [`tls/app.protocolx.test.crt`](file:///Users/n2/Desktop/CN/CN-Phase1-ProtocolX/tls/app.protocolx.test.crt) was imported into the macOS System Keychain on the client machine:
```bash
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain tls/app.protocolx.test.crt
```

### Strict TLS Verification
Native `curl` validates the certificate chain against the macOS System Keychain without warnings or flags:
```bash
curl -Iv https://app.protocolx.test/api/status
```
Key handshake output:
```text
* Server certificate:
*  subject: C=IN; ST=State; L=City; O=ProtocolX; CN=app.protocolx.test
*  subjectAltName: host "app.protocolx.test" matched cert's "app.protocolx.test"
*  issuer: C=IN; ST=State; L=City; O=ProtocolX; CN=app.protocolx.test
*  SSL certificate verify ok.
* SSL connection using TLSv1.3 / AEAD-CHACHA20-POLY1305-SHA256
```

---

## HTTP Caching

### Behavior
The caching mechanism implemented in this phase is driven by HTTP response headers:
- `nginx` injects `Cache-Control: public, max-age=10` on the `/api/status` location block.
- Downstream HTTP clients and browser agents respect the `max-age=10` TTL to reduce unnecessary round trips.
- **Architectural Note**: `nginx` does not maintain an internal server-side proxy disk cache (`proxy_cache` is not enabled in `nginx.conf`); the caching contract operates between `nginx` and the client.

### Verification Output
```text
$ curl -sI https://app.protocolx.test/api/status | grep -i Cache-Control
Cache-Control: public, max-age=10
```

---

## Wireshark Evidence

Packet captures and analysis screenshots were gathered on Mac 4 (Archit) and cataloged under [`evidence/C-wireshark/`](file:///Users/n2/Desktop/CN/CN-Phase1-ProtocolX/evidence/C-wireshark/).

### 1. Raw Capture File
- [`evidence/C-wireshark/protocolX.pcapng`](file:///Users/n2/Desktop/CN/CN-Phase1-ProtocolX/evidence/C-wireshark/protocolX.pcapng): Contains live packet traces of DNS queries, TCP 3-way handshakes, and TLS exchanges.

### 2. Protocol Breakdown
- **DNS Protocol (`evidence/C-wireshark/ss/dns/`)**:
  - `Standard query 0x... A app.protocolx.test` sent to `10.7.7.218:53`.
  - `Standard query response 0x... A 10.7.12.189` returned by `dnsmasq`.
- **TCP Handshake (`evidence/C-wireshark/ss/tls-tcp/`)**:
  - Client sends `[SYN]` to `10.7.12.189:443`.
  - Server replies with `[SYN, ACK]`.
  - Client acknowledges with `[ACK]`, establishing the Layer 4 connection.
- **TLS 1.3 Handshake & Application Data (`evidence/C-wireshark/ss/tls-tcp/`)**:
  - Client transmits `Client Hello` proposing TLS 1.3 ciphers and SNI `app.protocolx.test`.
  - Server responds with `Server Hello`, setting up ephemeral Diffie-Hellman keys.
  - *Protocol Note*: Under TLS 1.3 (RFC 8446), the server certificate and encrypted handshake messages are ciphertext; they appear as `Application Data` or `Encrypted Handshake Message` packets rather than plain X.509 frames.

---

## Failure & Fault-Tolerance Demonstration

A real-time service failure and automatic recovery experiment was conducted by stopping Backend B on Mac 4 during active traffic generation.

### Stage 1: Before Failure (Baseline)
- Backend B is reachable on `10.7.13.247:3002`.
- Sequential requests show alternating round-robin distribution:
  ```text
  X-Backend: A
  X-Backend: B
  X-Backend: A
  X-Backend: B
  ```

### Stage 2: During Failure (Backend B Stopped)
- Backend B process terminated on Mac 4 (`nc: connectx failed: Connection refused`).
- `nginx` detects TCP connection refusal to `10.7.13.247:3002`.
- `nginx` automatically routes requests to the remaining healthy upstream (`Backend A`).
- **Result**: Client experiences 0% downtime and 100% `HTTP/1.1 200 OK` success rate:
  ```text
  X-Backend: A
  X-Backend: A
  X-Backend: A
  X-Backend: A
  ```

### Stage 3: After Restoration (Backend B Restarted)
- Backend B process restarted on Mac 4 (`port 3002 listening`).
- `nginx` upstream probe successfully connects to Backend B.
- Backend B seamlessly rejoins the active pool, and 50/50 alternation resumes immediately:
  ```text
  X-Backend: B
  X-Backend: A
  X-Backend: B
  X-Backend: A
  ```

*Technical Note on Resilience*: `nginx` upstream failover occurred gracefully upon connection rejection. No configuration modifications were made during the test.

---

## Evidence Directory

All terminal session transcripts, packet captures, and screenshots are organized under [`evidence/`](file:///Users/n2/Desktop/CN/CN-Phase1-ProtocolX/evidence/):

| Area | Evidence Directory / File | Description |
|---|---|---|
| **LAN & DNS** | [`evidence/A-lan-dns/dns_verification.txt`](file:///Users/n2/Desktop/CN/CN-Phase1-ProtocolX/evidence/A-lan-dns/dns_verification.txt) | `dnsmasq` syntax checks, service status, `scutil --dns`, and `dig` outputs |
| **HTTPS & Load Balancing** | [`evidence/B-https-load-balancing/https_lb_verification.txt`](file:///Users/n2/Desktop/CN/CN-Phase1-ProtocolX/evidence/B-https-load-balancing/https_lb_verification.txt) | Certificate SAN details, strict `curl` TLS verification, 4-request A/B load balancing |
| **Wireshark Analysis** | [`evidence/C-wireshark/protocolX.pcapng`](file:///Users/n2/Desktop/CN/CN-Phase1-ProtocolX/evidence/C-wireshark/protocolX.pcapng) | Raw PCAP-NG capture file covering DNS, TCP, and TLS packets |
| **Wireshark Screenshots** | [`evidence/C-wireshark/ss/`](file:///Users/n2/Desktop/CN/CN-Phase1-ProtocolX/evidence/C-wireshark/ss/) | Filtered screenshots of DNS queries and TCP/TLS handshakes |
| **Caching Verification** | [`evidence/D-caching-failure/caching_verification.txt`](file:///Users/n2/Desktop/CN/CN-Phase1-ProtocolX/evidence/D-caching-failure/caching_verification.txt) | Header verification of `Cache-Control: public, max-age=10` |
| **Failure Demonstration** | [`evidence/D-caching-failure/failure-demo.txt`](file:///Users/n2/Desktop/CN/CN-Phase1-ProtocolX/evidence/D-caching-failure/failure-demo.txt) | Complete 3-stage terminal log of the Backend B outage and recovery |

---

## Repository Structure

```text
CN-Phase1-ProtocolX/
├── .gitignore
├── README.md
├── backend/
│   ├── backend-a/
│   │   ├── package.json
│   │   └── server.js
│   └── backend-b/
│       └── server.js
├── dns/
│   └── dnsmasq.conf
├── docs/
├── evidence/
│   ├── A-lan-dns/
│   │   └── dns_verification.txt
│   ├── B-https-load-balancing/
│   │   └── https_lb_verification.txt
│   ├── C-wireshark/
│   │   ├── protocolX.pcapng
│   │   └── ss/
│   │       ├── dns/
│   │       │   ├── Screenshot 2026-10-02 at 1.17.04 AM.png
│   │       │   ├── Screenshot 2026-10-02 at 1.17.07 AM.png
│   │       │   └── Screenshot 2026-10-02 at 1.17.11 AM.png
│   │       └── tls-tcp/
│   │           ├── Screenshot 2026-10-02 at 1.22.06 AM.png
│   │           └── Screenshot 2026-10-02 at 1.23.09 AM.png
│   └── D-caching-failure/
│       ├── caching_verification.txt
│       └── failure-demo.txt
├── nginx/
│   └── nginx.conf
├── scripts/
│   └── start_dns.sh
├── tls/
│   ├── app.protocolx.test.crt
│   └── openssl.cnf
└── wireshark/
```

---

## Setup Guide

Follow these instructions to run ProtocolX across four laptops on the same Wi-Fi network.

### Mac 3 (Shagun) — Start Backend A
1. Navigate to [`backend/backend-a`](file:///Users/n2/Desktop/CN/CN-Phase1-ProtocolX/backend/backend-a):
   ```bash
   cd backend/backend-a
   ```
2. Start the Node.js server:
   ```bash
   node server.js
   ```
3. Confirm listening on port 3001:
   ```bash
   lsof -nP -iTCP:3001 -sTCP:LISTEN
   ```

### Mac 4 (Archit) — Start Backend B
1. Navigate to [`backend/backend-b`](file:///Users/n2/Desktop/CN/CN-Phase1-ProtocolX/backend/backend-b):
   ```bash
   cd backend/backend-b
   ```
2. Start the Node.js server:
   ```bash
   node server.js
   ```
3. Confirm listening on port 3002:
   ```bash
   lsof -nP -iTCP:3002 -sTCP:LISTEN
   ```

### Mac 2 (Aditya) — Start nginx Edge
1. Validate nginx configuration syntax:
   ```bash
   sudo nginx -t -c $(pwd)/nginx/nginx.conf
   ```
2. Start `nginx`:
   ```bash
   sudo nginx -c $(pwd)/nginx/nginx.conf
   ```
3. Confirm listening on ports 80 and 443:
   ```bash
   sudo lsof -nP -iTCP:80,443 -sTCP:LISTEN
   ```

### Mac 1 (Naveen) — Start DNS & Install Trust
1. Install `dnsmasq` (via Homebrew if not installed):
   ```bash
   brew install dnsmasq
   ```
2. Deploy configuration and launch `dnsmasq` using the project script *(requires sudo)*:
   ```bash
   sudo ./scripts/start_dns.sh
   ```
3. Import the TLS certificate into macOS Keychain *(requires sudo)*:
   ```bash
   sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain tls/app.protocolx.test.crt
   ```

---

## End-to-End Verification Sequence

Execute this verification sequence from **Mac 1** to validate the entire platform:

1. **Verify Private DNS Resolution**:
   ```bash
   dig app.protocolx.test
   ```
   *Expected*: `ANSWER SECTION: app.protocolx.test. 0 IN A 10.7.12.189`

2. **Verify HTTP to HTTPS 301 Redirect**:
   ```bash
   curl -I http://app.protocolx.test
   ```
   *Expected*: `HTTP/1.1 301 Moved Permanently`, `Location: https://app.protocolx.test/`

3. **Verify Strict HTTPS (Without `-k` or `--cacert`)**:
   ```bash
   curl -i https://app.protocolx.test/api/status
   ```
   *Expected*: `HTTP/1.1 200 OK`, `Cache-Control: public, max-age=10`, `X-Backend: A` (or `B`)

4. **Verify Load Balancing Alternation**:
   ```bash
   for i in {1..6}; do curl -s -D - https://app.protocolx.test/api/status -o /dev/null | grep -i X-Backend; done
   ```
   *Expected*: Alternating sequence of `X-Backend: A` and `X-Backend: B`.

---

## Failure Testing Procedure

To reproduce the Phase 8 failure resilience test:

1. **Baseline**: Run 6 requests from Mac 1; confirm both `X-Backend: A` and `X-Backend: B` respond.
2. **Trigger Outage**: On Mac 4 (Archit), stop Backend B (`Ctrl+C` in the terminal running `server.js`).
3. **Verify Outage**: On Mac 1, verify TCP port 3002 is down:
   ```bash
   nc -zv -w 2 10.7.13.247 3002
   ```
   *Result*: `Connection refused`.
4. **Observe Failover**: Run 6 requests from Mac 1:
   ```bash
   for i in {1..6}; do curl -s -D - https://app.protocolx.test/api/status -o /dev/null | grep -i X-Backend; done
   ```
   *Result*: 100% of requests succeed with `HTTP 200 OK` and `X-Backend: A`.
5. **Restore**: On Mac 4, restart Backend B (`node server.js`).
6. **Verify Recovery**: Run 6 requests from Mac 1. `X-Backend: B` immediately reappears and resumes 50/50 alternation.

---

## Learning Outcomes

Through building and evaluating ProtocolX, the team gained hands-on experience with:
- **Host Addressing & Subnetting**: Calculating CIDR boundaries (`/19`) and routing across physical interfaces.
- **DNS Protocols**: Split-horizon DNS, record types, query recursion, and OS-level resolver scoping.
- **Layer 4 Transport**: TCP connection states, three-way handshake (`SYN`, `SYN-ACK`, `ACK`), and timeout handling.
- **Layer 7 Application Routing**: Reverse proxy mechanics, HTTP header translation, and upstream load-balancing algorithms.
- **Network Security & PKI**: Public-key cryptography, X.509 certificate fields, SAN matching, and certificate authority trust chains.
- **Caching Semantics**: Client-side HTTP cache directives and TTL evaluation.
- **Packet Analysis**: Dissecting captured frame bytes in Wireshark to correlate theory with real wire traffic.
- **Fault Tolerance**: Upstream failure detection and automated failover in distributed systems.

---

## Project Status

- [x] **Phase 1**: LAN connectivity and IP inventory established across 4 laptops
- [x] **Phase 2**: Backend A (`Node.js`: 3001) and Backend B (`Node.js`: 3002) operational
- [x] **Phase 3**: Private DNS (`dnsmasq`) authoritative for `app.protocolx.test` -> `10.7.12.189`
- [x] **Phase 4**: `nginx` reverse proxy and upstream round-robin load balancing active
- [x] **Phase 5**: HTTPS/TLS 1.3 configured with SAN certificate and native client trust (no `-k`)
- [x] **Phase 6**: HTTP `Cache-Control: public, max-age=10` verified
- [x] **Phase 7**: Wireshark packet capture (`protocolX.pcapng`) and screenshots archived
- [x] **Phase 8**: Real-time service failure and automatic failover recovery demonstrated
- [x] **Phase 9**: Evidence structured, verified, and pushed to GitHub
- [ ] **Final Submission**: 5-minute project demonstration video recording
- [ ] **Final Submission**: Google Form submission link

---

## Team Contributions

- **Naveen (Mac 1)**: Coordinated project milestones, deployed and configured `dnsmasq` on Mac 1, configured macOS scoped resolvers, verified native client-side TLS certificate trust, and orchestrated the multi-stage failure demonstration.
- **Aditya (Mac 2)**: Designed and deployed the `nginx` reverse proxy, configured upstream round-robin load balancing, generated the X.509 SAN certificate, implemented HTTPS/TLS termination with HTTP 301 redirection, and injected client caching headers.
- **Shagun (Mac 3)**: Developed the Backend A microservice in Node.js, exposed `/` and `/api/status` endpoints, implemented the `X-Backend: A` header, and ensured LAN availability on port 3001.
- **Archit (Mac 4)**: Developed the Backend B microservice in Node.js on port 3002, recorded raw packet captures (`protocolX.pcapng`), extracted protocol evidence screenshots in Wireshark, and executed the Backend B shutdown/restart for the failure test.

---

## Conclusion

ProtocolX demonstrates an end-to-end local network service architecture deployed on real physical hardware. By methodically layering DNS resolution, TCP transport, TLS encryption, HTTP reverse proxying, round-robin load balancing, caching directives, packet inspection, and fault recovery, the platform proves how distributed internet systems function under the hood in an observable, secure, and resilient environment.
