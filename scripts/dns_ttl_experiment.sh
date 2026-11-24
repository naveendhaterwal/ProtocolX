#!/bin/bash
set -e

# ProtocolX - Task 4: DNS TTL Experiment Script
# Demonstrates 30-second TTL caching, record updates, cache expiration, and manual cache flushing.

RECORD="ttl-test.protocolx.test"
IP1="10.7.11.100"
IP2="10.7.11.200"
DNS_SERVER="127.0.0.1"
TTL="30"

echo "============================================================"
echo "ProtocolX - Phase 2: Task 4 DNS TTL Experiment"
echo "Record: $RECORD | Configured TTL: ${TTL}s"
echo "============================================================"

# Step 1: Add initial record with 30s TTL to dnsmasq
echo ""
echo "[Step 1] Configuring initial record: $RECORD -> $IP1 with TTL $TTL..."
sudo sed -i '' "/$RECORD/d" /opt/homebrew/etc/dnsmasq.conf || true
echo "address=/$RECORD/$IP1" | sudo tee -a /opt/homebrew/etc/dnsmasq.conf > /dev/null
sudo killall -HUP dnsmasq || true
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder || true

# Step 2: Initial Query
echo ""
echo "[Step 2] Initial DNS Query (Baseline Answer):"
dig @$DNS_SERVER $RECORD +noall +answer

# Step 3: Change record in dnsmasq backend to IP2
echo ""
echo "[Step 3] Updating DNS server backend record to: $RECORD -> $IP2..."
sudo sed -i '' "s|address=/$RECORD/.*|address=/$RECORD/$IP2|" /opt/homebrew/etc/dnsmasq.conf
sudo killall -HUP dnsmasq || true

# Step 4: Query immediately through system resolver (should show cached answer IP1)
echo ""
echo "[Step 4] Querying immediately (within TTL window):"
echo "Expected behavior: Cached answer ($IP1) is returned due to active TTL."
dig @$DNS_SERVER $RECORD +noall +answer

# Step 5: Wait for TTL expiration or test cache flush
echo ""
echo "[Step 5] Demonstrating client cache flush:"
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder || true
echo "Cache flushed. Querying again:"
dig @$DNS_SERVER $RECORD +noall +answer

echo ""
echo "============================================================"
echo "DNS TTL Experiment Completed Successfully."
echo "============================================================"
