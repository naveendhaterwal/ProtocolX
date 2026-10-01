#!/bin/bash
set -e

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
