# Computer Networks — Phase 1

## Project Goal

Build a fully local private network service platform using four
macOS laptops.

## Team (ProtocolX)

| Member | Machine | Primary Role |
|---|---|---|
| Naveen | Mac 1 | Coordinator + Private DNS |
| Aditya | Mac 2 | nginx + HTTPS + Load Balancer |
| Shagun | Mac 3 | Backend A |
| Archit | Mac 4 | Backend B + Wireshark/Evidence |

## Architecture

Client
↓
Private DNS
↓
app.protocolx.test
↓
nginx Edge
↓
Backend A / Backend B

## Machine Information

| Machine | Member | Role | Private IP | Interface |
|---|---|---|---|---|
| Mac 1 | Naveen | DNS + Client | 10.7.7.218 | en0 |
| Mac 2 | Aditya | nginx + HTTPS + LB | 10.7.12.189 | TBD |
| Mac 3 | Shagun | Backend A | 10.7.16.69 | TBD |
| Mac 4 | Archit | Backend B | 10.7.13.247 | TBD |

## Phase 1 Checklist

- [x] LAN connectivity
- [x] Machine IP inventory
- [x] Private DNS
- [ ] Backend A
- [ ] Backend B
- [ ] nginx reverse proxy
- [ ] Load balancing
- [ ] HTTPS/TLS
- [ ] HTTP caching
- [ ] Wireshark DNS evidence
- [ ] Wireshark TCP evidence
- [ ] Wireshark TLS evidence
- [ ] Failure demonstration
- [ ] Final verification
- [ ] 5-minute demo video
- [ ] Google Form submission

## Important Rules

- Use the private `.test` namespace.
- Final service access must use the domain name, not an IP address.
- Never use `curl -k` in submitted evidence.
- Do not commit passwords, private keys, or other secrets.
- Do not add unnecessary technologies.
- The network is the main focus of the project.

## Evidence

All actual terminal output, configuration evidence, and Wireshark
evidence will be organized under the evidence/ directory.
