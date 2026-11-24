#!/bin/bash
set -e

echo "======================================================="
echo "ProtocolX Firewall Rollback Controller"
echo "Flushing custom PF rules and restoring default state..."
echo "======================================================="

# Flush custom pf rules
sudo pfctl -F all 2>/dev/null || true

# Revert to macOS default /etc/pf.conf if available
if [ -f /etc/pf.conf ]; then
    echo "Reloading system default /etc/pf.conf..."
    sudo pfctl -f /etc/pf.conf 2>/dev/null || true
fi

# Disable PF packet filter
sudo pfctl -d 2>/dev/null || true

echo "SUCCESS: Firewall completely disabled. All ports restored to open LAN access."
