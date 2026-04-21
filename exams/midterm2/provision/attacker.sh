#!/bin/sh
set -e

echo ">>> [attacker] Starting provisioning..."

# ── Repos ──────────────────────────────────────────────────────────────────────
echo "http://dl-cdn.alpinelinux.org/alpine/v3.19/community" >> /etc/apk/repositories
apk update -q

# ── Core attack tools ──────────────────────────────────────────────────────────
apk add -q nmap nikto ftp curl tcpdump iproute2

# ── hping3 — try community, fall back to edge/testing ─────────────────────────
apk add -q hping3 2>/dev/null || {
    echo "http://dl-cdn.alpinelinux.org/alpine/edge/testing" >> /etc/apk/repositories
    apk update -q
    apk add -q hping3 2>/dev/null || \
        echo "WARNING: hping3 unavailable. Use 'nmap --flood' as an alternative."
}

# ── Persistent route to the target segment via snort-ids ──────────────────────
mkdir -p /etc/local.d
cat > /etc/local.d/routes.start << 'EOF'
#!/bin/sh
ip route add 10.0.2.0/24 via 10.0.1.10 2>/dev/null || true
EOF
chmod +x /etc/local.d/routes.start
rc-update add local default 2>/dev/null || true

# Apply immediately
ip route add 10.0.2.0/24 via 10.0.1.10 2>/dev/null || true

echo ">>> [attacker] Provisioning complete."
echo "    Installed tools:"
command -v nmap    && echo "      nmap    : $(nmap --version 2>&1 | head -1)"    || true
command -v hping3  && echo "      hping3  : available"                            || true
command -v nikto   && echo "      nikto   : available"                            || true
command -v ftp     && echo "      ftp     : available"                            || true
echo "    Network interfaces:"
ip -br addr show
