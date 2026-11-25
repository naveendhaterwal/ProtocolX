#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
if command -v dnsmasq >/dev/null 2>&1; then
    DNSMASQ_BIN="$(command -v dnsmasq)"
elif [ -x /opt/homebrew/opt/dnsmasq/sbin/dnsmasq ]; then
    DNSMASQ_BIN="/opt/homebrew/opt/dnsmasq/sbin/dnsmasq"
elif [ -x /opt/homebrew/sbin/dnsmasq ]; then
    DNSMASQ_BIN="/opt/homebrew/sbin/dnsmasq"
elif [ -x /usr/local/sbin/dnsmasq ]; then
    DNSMASQ_BIN="/usr/local/sbin/dnsmasq"
else
    DNSMASQ_BIN=""
fi
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
