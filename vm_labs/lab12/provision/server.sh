#!/bin/bash
set -e

echo ">>> [lab12] Provisioning SVOBODA web server..."

apt-get update -qq
apt-get install -y apache2 curl tcpdump net-tools openssl

# Ensure Apache is running and enabled
systemctl enable apache2
systemctl start apache2

# Deploy the SVOBODA Network landing page (HTTP — insecure, by design)
cat > /var/www/html/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>SVOBODA Network — Internal Portal</title>
  <style>
    body { font-family: monospace; background: #111; color: #0f0; padding: 40px; }
    h1   { color: #ff0; }
    p    { color: #ccc; }
    .warn { color: #f00; border: 1px solid #f00; padding: 10px; margin-top: 20px; }
  </style>
</head>
<body>
  <h1>SVOBODA Network — Internal Coordination Portal</h1>
  <p>Welcome, operative. This portal is for authorized team use only.</p>
  <p>Current active contacts: <strong>14</strong></p>
  <p>Next document release: <strong>72 hours</strong></p>
  <p>Secure drop: <strong>operative-drop@svoboda.internal</strong></p>
  <div class="warn">
    ⚠ WARNING: This site is running over HTTP. All traffic is unencrypted.
    Contact your security operative immediately.
  </div>
</body>
</html>
EOF

# Create the protected contact page (will be used for plaintext demo)
cat > /var/www/html/contacts.html << 'EOF'
<!DOCTYPE html>
<html>
<head><title>SVOBODA — Source Registry</title></head>
<body style="font-family:monospace;background:#111;color:#0f0;padding:40px;">
  <h2>Source Registry — CLASSIFIED</h2>
  <ul>
    <li>Source ATLAS — Embassy contact, Bratislava</li>
    <li>Source WRAITH — Ministry insider, Warsaw</li>
    <li>Source FALCON — Border intelligence, Lviv</li>
  </ul>
</body>
</html>
EOF

echo ">>> [lab12] Provisioning complete."
echo "    Apache: $(apache2 -v 2>&1 | head -1)"
echo "    OpenSSL: $(openssl version)"
echo ""
echo "    HTTP site:  http://localhost  (or http://localhost:8080 from host)"
echo "    HTTPS:      Not configured yet — student configures this as part of the lab"
