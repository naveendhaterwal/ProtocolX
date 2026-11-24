#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DNSMASQ_BIN=$(which dnsmasq 2>/dev/null || test -x /opt/homebrew/opt/dnsmasq/sbin/dnsmasq && echo /opt/homebrew/opt/dnsmasq/sbin/dnsmasq || echo /usr/local/sbin/dnsmasq)
CONF_PATH="$REPO_ROOT/dns/dnsmasq_backup.conf"

echo "======================================================="
echo "ProtocolX Backup DNS Server Starter — Mac 4"
echo "Binary: $DNSMASQ_BIN"
echo "Config: $CONF_PATH"
echo "======================================================="

if [ ! -x "$DNSMASQ_BIN" ]; then
    echo "Error: dnsmasq not found at $DNSMASQ_BIN"
    exit 1
fi

echo "[1/3] Stopping any previous dnsmasq instances..."
sudo killall dnsmasq 2>/dev/null || true
sleep 1

echo "[2/3] Launching backup dnsmasq service..."
sudo "$DNSMASQ_BIN" -C "$CONF_PATH"

echo "[3/3] Testing backup DNS resolution..."
sleep 1
dig @127.0.0.1 app.protocolx.test +short

echo "SUCCESS: Backup DNS active on port 53."
