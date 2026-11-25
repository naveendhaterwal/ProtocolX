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
    # Re-order sections if needed (options/scrub -> nat/rdr/binat -> filtering) so pfctl -f accepts it
    ORDERED_CONF="/var/tmp/protocolx_pf_backup/pf_rules_ordered.bak"
    {
        grep -E '^(set |scrub)' "$BACKUP_DIR/pf_rules.bak" || true
        grep -E '^(nat|rdr|binat)' "$BACKUP_DIR/pf_rules.bak" || true
        grep -vE '^(set |scrub|nat|rdr|binat)' "$BACKUP_DIR/pf_rules.bak" || true
    } | sudo tee "$ORDERED_CONF" >/dev/null

    if sudo pfctl -nf "$ORDERED_CONF" 2>/dev/null; then
        sudo pfctl -f "$ORDERED_CONF"
    elif [ -f /etc/pf.conf ]; then
        echo "Saved ruleset could not be parsed directly; falling back to /etc/pf.conf..."
        sudo pfctl -f /etc/pf.conf
    fi
    sudo rm -f "$ORDERED_CONF"
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
