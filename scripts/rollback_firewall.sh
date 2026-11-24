#!/bin/bash
set -e

BACKUP_DIR="/var/tmp/protocolx_pf_backup"

echo "======================================================="
echo "ProtocolX Firewall Rollback Controller"
echo "Restoring previously saved PF configuration..."
echo "======================================================="

if [ ! -f "$BACKUP_DIR/pf_status.bak" ] || [ ! -f "$BACKUP_DIR/pf_rules.bak" ]; then
    echo "ERROR: No saved PF backup found in $BACKUP_DIR."
    echo "Refusing to blindly flush/disable firewall. Inspect 'sudo pfctl -s info' manually."
    exit 1
fi

PREV_STATUS="$(cat "$BACKUP_DIR/pf_status.bak")"
echo "[1/3] Previous PF status: $PREV_STATUS"

echo "[2/3] Restoring saved PF ruleset from $BACKUP_DIR/pf_rules.bak..."
if [ -s "$BACKUP_DIR/pf_rules.bak" ]; then
    sudo pfctl -f "$BACKUP_DIR/pf_rules.bak"
elif [ -f /etc/pf.conf ]; then
    sudo pfctl -f /etc/pf.conf
fi

echo "[3/3] Restoring PF enabled/disabled state ($PREV_STATUS)..."
if [ "$PREV_STATUS" = "enabled" ]; then
    sudo pfctl -e 2>/dev/null || true
    echo "SUCCESS: PF restored to ENABLED with its original ruleset."
else
    sudo pfctl -d 2>/dev/null || true
    echo "SUCCESS: PF ruleset restored and PF returned to its original DISABLED state."
fi

sudo rm -f "$BACKUP_DIR/pf_status.bak" "$BACKUP_DIR/pf_rules.bak"
