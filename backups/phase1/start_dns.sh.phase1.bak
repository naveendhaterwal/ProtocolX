#!/bin/bash
set -e

# Require root privileges
if [ "$EUID" -ne 0 ]; then
    echo "Error: Please run as root (sudo ./scripts/start_dns.sh)"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Deploy repository dnsmasq configuration to Homebrew etc path
echo "Deploying dnsmasq configuration from repository..."
mkdir -p /opt/homebrew/etc
cp "$REPO_ROOT/dns/dnsmasq.conf" /opt/homebrew/etc/dnsmasq.conf

# Stop any running dnsmasq instance
killall dnsmasq 2>/dev/null || true

# Start dnsmasq with project configuration
/opt/homebrew/opt/dnsmasq/sbin/dnsmasq -C /opt/homebrew/etc/dnsmasq.conf

# Setup macOS scoped resolver for .test domain
mkdir -p /etc/resolver
cat << 'EOF' > /etc/resolver/test
nameserver 127.0.0.1
nameserver 10.7.7.218
port 53
EOF

# Flush macOS DNS cache
dscacheutil -flushcache
killall -HUP mDNSResponder || true

echo "dnsmasq started and macOS .test resolver configured successfully."
