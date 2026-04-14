#!/usr/bin/env bash
# Lab 8 — Firewall Hardening
# Provisions Ubuntu 22.04 with 5 misconfigured services.
# UFW is intentionally left inactive — that is the student's job.

set -e

export DEBIAN_FRONTEND=noninteractive

echo "[*] Updating package index..."
apt-get update -qq

echo "[*] Installing services..."
apt-get install -y -qq \
    openssh-server \
    apache2 \
    mysql-server \
    vsftpd \
    postgresql \
    ufw \
    nmap \
    net-tools \
    curl

# ─── SSH ────────────────────────────────────────────────────────────────────
echo "[*] Configuring SSH..."
systemctl enable ssh
systemctl start ssh

# ─── APACHE ─────────────────────────────────────────────────────────────────
echo "[*] Configuring Apache HTTP..."
echo "<html><body><h1>Lab 8 — Target Server</h1><p>Hardening in progress...</p></body></html>" \
    > /var/www/html/index.html
systemctl enable apache2
systemctl start apache2

# ─── MYSQL ──────────────────────────────────────────────────────────────────
echo "[*] Configuring MySQL (bound to 0.0.0.0)..."
# Intentionally misconfigured: listening on all interfaces, not just localhost
sed -i 's/^bind-address\s*=.*/bind-address = 0.0.0.0/' /etc/mysql/mysql.conf.d/mysqld.cnf
mysql -e "CREATE DATABASE IF NOT EXISTS lab8db;"
mysql -e "CREATE USER IF NOT EXISTS 'labuser'@'%' IDENTIFIED BY 'lab8pass';"
mysql -e "GRANT ALL PRIVILEGES ON lab8db.* TO 'labuser'@'%';"
mysql -e "FLUSH PRIVILEGES;"
systemctl enable mysql
systemctl restart mysql

# ─── FTP (vsftpd) ────────────────────────────────────────────────────────────
echo "[*] Configuring vsftpd with passive mode..."
useradd -m -s /bin/bash ftpuser 2>/dev/null || true
echo "ftpuser:ftppass" | chpasswd

cat > /etc/vsftpd.conf << 'EOF'
listen=YES
listen_ipv6=NO
anonymous_enable=NO
local_enable=YES
write_enable=YES
local_umask=022
dirmessage_enable=YES
use_localtime=YES
xferlog_enable=YES
connect_from_port_20=YES
chroot_local_user=YES
allow_writeable_chroot=YES
secure_chroot_dir=/var/run/vsftpd/empty
pam_service_name=vsftpd
# Passive mode — port range the firewall must allow
pasv_enable=YES
pasv_min_port=50000
pasv_max_port=50010
pasv_address=192.168.56.20
EOF

systemctl enable vsftpd
systemctl restart vsftpd

# ─── POSTGRESQL ──────────────────────────────────────────────────────────────
echo "[*] Configuring PostgreSQL (bound to all interfaces)..."
PG_VERSION=$(psql --version | awk '{print $3}' | cut -d. -f1)
PG_CONF="/etc/postgresql/${PG_VERSION}/main/postgresql.conf"
PG_HBA="/etc/postgresql/${PG_VERSION}/main/pg_hba.conf"

# Intentionally misconfigured: listening on all interfaces
sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" "$PG_CONF"

# Allow password auth from any host (intentionally misconfigured)
echo "host    all             all             0.0.0.0/0               md5" >> "$PG_HBA"

sudo -u postgres psql -c "CREATE USER labpg WITH PASSWORD 'pgpass';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE lab8pg OWNER labpg;" 2>/dev/null || true

systemctl enable postgresql
systemctl restart postgresql

# ─── UFW — intentionally left INACTIVE ──────────────────────────────────────
echo "[*] UFW left inactive — student's task to configure."
ufw --force reset > /dev/null 2>&1
ufw disable > /dev/null 2>&1

echo ""
echo "======================================================"
echo "  Lab 8 provisioning complete."
echo "  Services running: SSH(22) HTTP(80) MySQL(3306) FTP(21) PostgreSQL(5432)"
echo "  UFW status: INACTIVE"
echo "  Your job: harden this box."
echo "======================================================"
