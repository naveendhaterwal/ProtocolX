#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="/var/tmp/protocolx_pf_backup"

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

# 1. Verify syntax first before touching active firewall
echo "[1/4] Verifying pfctl syntax without applying..."
sudo pfctl -vnf "$CONF"

# 2. Save pre-change PF state if no active backup exists yet
echo "[2/4] Backing up existing PF state to $BACKUP_DIR..."
sudo mkdir -p "$BACKUP_DIR"
if [ ! -f "$BACKUP_DIR/pf_status.bak" ]; then
    if sudo pfctl -s info 2>/dev/null | grep -qi "Status: Enabled"; then
        echo "enabled" | sudo tee "$BACKUP_DIR/pf_status.bak" >/dev/null
    else
        echo "disabled" | sudo tee "$BACKUP_DIR/pf_status.bak" >/dev/null
    fi

    # Save active PF rules in valid PF section order: options/normalization -> translation -> filtering
    {
        sudo pfctl -sr 2>/dev/null | grep -E '^(set |scrub)' || true
        sudo pfctl -sn 2>/dev/null || true
        sudo pfctl -sr 2>/dev/null | grep -vE '^(set |scrub)' || true
    } | sudo tee "$BACKUP_DIR/pf_rules.bak" >/dev/null
    if [ ! -s "$BACKUP_DIR/pf_rules.bak" ] && [ -f /etc/pf.conf ]; then
        sudo cp /etc/pf.conf "$BACKUP_DIR/pf_rules.bak"
    fi
    echo "Saved baseline PF state ($(cat "$BACKUP_DIR/pf_status.bak"))."
else
    echo "Existing PF backup found at $BACKUP_DIR; preserving original baseline."
fi

# 3. Enable and load rules
echo "[3/4] Loading packet filter rules..."
sudo pfctl -e -f "$CONF" 2>/dev/null || sudo pfctl -f "$CONF"

# 4. Inspect active rules
echo "[4/4] Inspecting active rules for port $PORT..."
sudo pfctl -sr | grep "$PORT" || true

echo "SUCCESS: Firewall isolation active. Only 10.7.10.188 (Mac 2 Edge) is permitted on port $PORT."
