#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

TARGET="${1:-mac3}"

if [ "$TARGET" = "mac3" ]; then
    CONF="$REPO_ROOT/firewall/pf_backend_a.conf"
    PORT="3001"
elif [ "$TARGET" = "mac4" ]; then
    CONF="$REPO_ROOT/firewall/pf_backend_b.conf"
    PORT="3002"
else
    echo "Usage: sudo $0 [mac3|mac4]"
    exit 1
fi

echo "======================================================="
echo "ProtocolX Firewall Application: $TARGET (Port $PORT)"
echo "Ruleset: $CONF"
echo "======================================================="

# Verify syntax first
echo "[1/3] Verifying pfctl syntax without applying..."
sudo pfctl -vnf "$CONF"

# Enable and load rules
echo "[2/3] Loading packet filter rules..."
sudo pfctl -e -f "$CONF" 2>/dev/null || sudo pfctl -f "$CONF"

echo "[3/3] Inspecting active anchor rules..."
sudo pfctl -sr | grep "$PORT" || true

echo "SUCCESS: Firewall isolation active. Only 10.7.10.188 and 10.7.11.221 are permitted."
