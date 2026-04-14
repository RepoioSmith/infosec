#!/usr/bin/env bash
# Lab 9 — NorthStar Bank CTF
# Provisions Ubuntu 22.04 with a deliberately vulnerable Node.js banking app.
set -e
export DEBIAN_FRONTEND=noninteractive

echo "[*] Updating system..."
apt-get update -qq

echo "[*] Installing dependencies..."
apt-get install -y -qq \
    build-essential \
    python3 \
    curl \
    git \
    ufw

# ── Node.js 20 LTS ───────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "[*] Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
  apt-get install -y -qq nodejs
fi
echo "[+] Node $(node -v) / npm $(npm -v)"

# ── Deploy application ────────────────────────────────────────────────────────
APP_DIR="/var/www/app"
echo "[*] Deploying application to ${APP_DIR}..."
mkdir -p "$APP_DIR"
cp -r /vagrant/app/. "$APP_DIR/"

cd "$APP_DIR"
echo "[*] Installing npm dependencies..."
npm install --omit=dev --silent 2>&1

# Ensure secret directory exists and has correct permissions
# (readable by the app user — the SSRF file:// target)
chmod 644 "$APP_DIR/secret/master_key.txt"

# ── UFW — allow HTTP, block direct access to internal service ─────────────────
ufw --force reset > /dev/null 2>&1
ufw default deny incoming > /dev/null 2>&1
ufw default allow outgoing > /dev/null 2>&1
ufw allow 22/tcp  > /dev/null 2>&1
ufw allow 80/tcp  > /dev/null 2>&1
# Port 8888 is intentionally NOT opened externally — internal service only
ufw --force enable > /dev/null 2>&1

# ── Systemd service — main app (port 80) ─────────────────────────────────────
cat > /etc/systemd/system/northstar.service << 'EOF'
[Unit]
Description=NorthStar Bank Portal
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/app
ExecStart=/usr/bin/node /var/www/app/server.js
Restart=always
RestartSec=3
Environment=NODE_ENV=development

[Install]
WantedBy=multi-user.target
EOF

# ── Systemd service — internal config service (port 8888) ─────────────────────
cat > /etc/systemd/system/northstar-internal.service << 'EOF'
[Unit]
Description=NorthStar Internal Config Service
After=network.target northstar.service

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/app
ExecStart=/usr/bin/node /var/www/app/internal-service.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable northstar northstar-internal
systemctl start northstar northstar-internal

sleep 2

# ── Verify services are running ───────────────────────────────────────────────
echo ""
echo "========================================================"
echo "  Lab 9 — NorthStar Bank CTF"
echo "========================================================"
echo "  Portal:           http://192.168.56.30"
echo "  Internal service: http://localhost:8888 (loopback only)"
echo "  UFW:              active (ports 22, 80)"
echo ""
if curl -s -o /dev/null -w "%{http_code}" http://localhost/ | grep -q "200\|304"; then
    echo "  [+] Main application: RUNNING"
else
    echo "  [!] Main application: CHECK LOGS (journalctl -u northstar)"
fi
if curl -s http://localhost:8888/internal/health | grep -q "ok"; then
    echo "  [+] Internal service: RUNNING"
else
    echo "  [!] Internal service: CHECK LOGS (journalctl -u northstar-internal)"
fi
echo "========================================================"
