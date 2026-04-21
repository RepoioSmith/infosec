#!/bin/bash
set -e

echo ">>> [snort-ids] Starting provisioning..."

# ── System update ──────────────────────────────────────────────────────────────
apt-get update -qq

# ── Pre-answer debconf so snort installs non-interactively ─────────────────────
# Students will reconfigure these values as part of the exam.
echo "snort snort/address_range string 10.0.0.0/8" | debconf-set-selections
echo "snort snort/interface string lo"              | debconf-set-selections
DEBIAN_FRONTEND=noninteractive apt-get install -y snort

# ── Useful utilities ───────────────────────────────────────────────────────────
DEBIAN_FRONTEND=noninteractive apt-get install -y \
    tcpdump net-tools curl wget iproute2

# ── Enable IP forwarding (snort-ids acts as the inter-segment router) ──────────
echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
sysctl -p

# ── Snort directory layout ─────────────────────────────────────────────────────
mkdir -p /etc/snort/rules
mkdir -p /var/log/snort
chmod 755 /var/log/snort

# Create an empty local rules file students will populate
touch /etc/snort/rules/local.rules

echo ">>> [snort-ids] Provisioning complete."
echo "    Snort: $(snort --version 2>&1 | head -1)"
echo "    Network interfaces:"
ip -br addr show
