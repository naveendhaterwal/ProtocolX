#!/bin/bash
set -e

# ProtocolX - Task 4: DNS TTL Experiment Script
# Demonstrates 30-second TTL caching, record updates, cache expiration, and manual cache flushing.

RECORD="migration.protocolx.test"
IP1="10.7.10.188"
IP2="10.7.18.164"
DNS_SERVER="127.0.0.1"
TTL="30"
CONF="/opt/homebrew/etc/dnsmasq.conf"
DNSMASQ_BIN="/opt/homebrew/opt/dnsmasq/sbin/dnsmasq"

echo "============================================================"
echo "ProtocolX - Phase 2: Task 4 DNS TTL Experiment"
echo "Record: $RECORD | Configured TTL: ${TTL}s"
echo "============================================================"

reload_dnsmasq() {
    sudo killall dnsmasq 2>/dev/null || true
    sleep 1
    sudo "$DNSMASQ_BIN" -C "$CONF"
}

# Step 1: Ensure initial record with 30s TTL in dnsmasq.conf
echo ""
echo "[Step 1] Configuring initial record: $RECORD -> $IP1 with TTL ${TTL}s..."
sudo sed -i '' "/$RECORD/d" "$CONF" || true
echo "host-record=$RECORD,$IP1,$TTL" | sudo tee -a "$CONF" > /dev/null
reload_dnsmasq
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder || true

# Step 2: Initial Query (Authoritative + System Resolver)
echo ""
echo "[Step 2] Initial DNS Query (Baseline Answer):"
dig @$DNS_SERVER $RECORD +noall +answer
dscacheutil -q host -a name $RECORD | grep -E "name:|ip_address:" || true

# Step 3: Change authoritative record in dnsmasq.conf to IP2
echo ""
echo "[Step 3] Updating DNS server authoritative record to: $RECORD -> $IP2..."
sudo sed -i '' "s|host-record=$RECORD,.*|host-record=$RECORD,$IP2,$TTL|" "$CONF"
reload_dnsmasq

echo "Authoritative dnsmasq answer now:"
dig @$DNS_SERVER $RECORD +noall +answer

# Step 4: Query system resolver immediately (within 30s TTL window)
echo ""
echo "[Step 4] Querying system resolver immediately (within 30s TTL window):"
dscacheutil -q host -a name $RECORD | grep -E "name:|ip_address:" || true

# Step 5: Flush macOS DNS cache and re-query system resolver
echo ""
echo "[Step 5] Flushing macOS DNS cache (dscacheutil -flushcache) and querying again:"
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder || true
sleep 1
dscacheutil -q host -a name $RECORD | grep -E "name:|ip_address:" || true

# Restore original record
echo ""
echo "[Cleanup] Restoring $RECORD -> $IP1..."
sudo sed -i '' "s|host-record=$RECORD,.*|host-record=$RECORD,$IP1,$TTL|" "$CONF"
reload_dnsmasq
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder || true

echo ""
echo "============================================================"
echo "DNS TTL Experiment Completed."
echo "============================================================"
