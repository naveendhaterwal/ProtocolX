#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
NGINX_CONF="$REPO_ROOT/nginx/nginx.conf"

NGINX_BIN=$(which nginx 2>/dev/null || test -x /opt/homebrew/bin/nginx && echo /opt/homebrew/bin/nginx || echo /usr/local/bin/nginx)

echo "======================================================="
echo "ProtocolX Nginx Gateway Starter — Mac 2"
echo "Binary: $NGINX_BIN"
echo "Config: $NGINX_CONF"
echo "======================================================="

if [ ! -x "$NGINX_BIN" ]; then
    echo "Error: nginx binary not found at $NGINX_BIN"
    exit 1
fi

echo "[1/4] Testing Nginx configuration syntax..."
$NGINX_BIN -t -c "$NGINX_CONF"

echo "[2/4] Stopping previous Nginx instances..."
sudo $NGINX_BIN -s stop 2>/dev/null || true
sudo killall nginx 2>/dev/null || true
sleep 1

echo "[3/4] Starting Nginx Edge Gateway..."
sudo $NGINX_BIN -c "$NGINX_CONF"

echo "[4/4] Verifying HTTP/HTTPS listener status..."
sleep 1
if sudo lsof -nP -iTCP:80,443 -sTCP:LISTEN; then
    echo "SUCCESS: Nginx Edge Gateway is active on ports 80 and 443."
else
    echo "Warning: Ports 80 and 443 not detected yet. Check error log."
fi
