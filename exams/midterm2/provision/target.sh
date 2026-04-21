#!/bin/sh
set -e

echo ">>> [target] Starting provisioning..."

# ── Repos ──────────────────────────────────────────────────────────────────────
echo "http://dl-cdn.alpinelinux.org/alpine/v3.19/community" >> /etc/apk/repositories
apk update -q

# ── Services ───────────────────────────────────────────────────────────────────
apk add -q nginx vsftpd openssh openrc

# ── nginx ──────────────────────────────────────────────────────────────────────
mkdir -p /var/www/html
cat > /var/www/html/index.html << 'EOF'
<!DOCTYPE html>
<html>
<head><title>CorpIntranet</title></head>
<body>
  <h1>CorpIntranet Internal Server</h1>
  <p>Welcome to the internal portal. Access is restricted to authorized users.</p>
</body>
</html>
EOF

cat > /etc/nginx/http.d/default.conf << 'EOF'
server {
    listen 80 default_server;
    server_name _;
    root /var/www/html;
    index index.html;
    location / { try_files $uri $uri/ =404; }
}
EOF

rc-service nginx start
rc-update add nginx default

# ── vsftpd (anonymous enabled) ─────────────────────────────────────────────────
mkdir -p /var/ftp/pub
echo "Authorized access only." > /var/ftp/pub/README.txt

cat > /etc/vsftpd/vsftpd.conf << 'EOF'
listen=YES
anonymous_enable=YES
local_enable=YES
write_enable=NO
anon_root=/var/ftp
anon_max_rate=0
xferlog_enable=YES
connect_from_port_20=YES
EOF

rc-service vsftpd start
rc-update add vsftpd default

# ── SSH ────────────────────────────────────────────────────────────────────────
rc-service sshd start
rc-update add sshd default

# ── Persistent route back to the attack segment via snort-ids ──────────────────
mkdir -p /etc/local.d
cat > /etc/local.d/routes.start << 'EOF'
#!/bin/sh
ip route add 10.0.1.0/24 via 10.0.2.10 2>/dev/null || true
EOF
chmod +x /etc/local.d/routes.start
rc-update add local default 2>/dev/null || true

# Apply immediately (for this provisioning session)
ip route add 10.0.1.0/24 via 10.0.2.10 2>/dev/null || true

echo ">>> [target] Provisioning complete."
echo "    Running services: nginx (80), vsftpd (21), sshd (22)"
echo "    Network interfaces:"
ip -br addr show
