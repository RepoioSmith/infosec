# Operation VAULT BREACH — Hint Sheet
## Released by instructor upon request. Do not distribute in advance.

---

> Each flag has three tiers of hints. Start with Tier 1 before moving down.
> Using a hint does not deduct points, but the instructor tracks which hints were used.

---

## FLAG-01 (50 pts) — Security Misconfiguration

**Tier 1:** Every web application has a file that tells search engine crawlers which paths to skip. Read it.

**Tier 2:** The path you found in that file — try accessing it directly with `curl`. Some paths that are "disallowed" are disallowed *because* they exist.

**Tier 3:** `curl http://192.168.56.30/.env`

---

## FLAG-02 (75 pts) — Security Misconfiguration

**Tier 1:** The `robots.txt` file reveals a restricted area. Developers often deploy admin panels and forget to change the factory credentials.

**Tier 2:** Navigate to the admin panel in your browser. Try the most commonly used default credentials for web admin panels.

**Tier 3:** The admin panel login endpoint is at `POST /api/admin/login`. Username: `admin`. Try the obvious password.

---

## FLAG-03 (100 pts) — SQL Injection

**Tier 1:** What does the login form do with the username you supply? Test how it handles a single quote character.

**Tier 2:** The login endpoint returns a verbose error when the database query fails. That error message contains the raw query. Now read it carefully — where would you inject?

**Tier 3:** Send `username = ' OR '1'='1' --` to `POST /api/auth/login`. Inspect the full JSON response — not just the token.

---

## FLAG-04 (150 pts) — SQL Injection

**Tier 1:** You found SQL injection in the login. The statement endpoint also takes user input that goes directly into a query. What other tables might the database have?

**Tier 2:** The `/api/statement` endpoint is vulnerable to UNION-based injection. First find out how many columns the query returns by introducing ORDER BY clauses. Then craft a UNION SELECT to read from another table.

**Tier 3:** The hidden table is called `vault_secrets`. The main query returns 9 columns. Payload: `account_id=0 UNION SELECT id,secret_name,flag,4,5,6,7,8,9 FROM vault_secrets--`

---

## FLAG-05 (200 pts) — Broken Access Control

**Tier 1:** Your dashboard loads your own account statement using an `account_id` parameter. What happens if you change that parameter to a different number?

**Tier 2:** Try iterating through account IDs 1 through 10. Not all accounts belong to you. Look carefully at every field returned — including fields that might normally be empty.

**Tier 3:** `GET /api/statement?account_id=7`. The flag is in the `notes` field of one of the transactions.

---

## FLAG-06 (250 pts) — Broken Access Control

**Tier 1:** The `robots.txt` file disallows a `/documents/` path. Why would a bank restrict that? What kind of documents might be there?

**Tier 2:** Use `ffuf` or `gobuster` to enumerate paths under `/documents/`. Try common wordlists. Try `-recursion` to go one level deeper.

**Tier 3:** `ffuf -u http://192.168.56.30/documents/FUZZ -w /usr/share/wordlists/dirb/common.txt -recursion -mc 200` — then read what you find.

---

## FLAG-07 (300 pts) — Cryptographic Failures

**Tier 1:** You have access to a backup of the database. It contains password hashes. Research what algorithm they use — the hash length is a giveaway. Is it a strong algorithm?

**Tier 2:** The CFO's password hash is 32 hex characters. That format is MD5 — a hashing algorithm that has been broken since 2004. The password is a common English word. Try `john` or `hashcat` with `rockyou.txt`.

**Tier 3:** `echo "0571749e2ac330a7455809c6b0e7af90" > hash.txt && john hash.txt --format=raw-md5 --wordlist=/usr/share/wordlists/rockyou.txt`. Then log in as `cfo.harris` with the cracked password and visit the dashboard.

---

## FLAG-08 (400 pts) — Cryptographic Failures

**Tier 1:** JSON Web Tokens have three parts separated by dots. The first part is the header — it tells the server which algorithm to use to verify the signature. What happens if you change that algorithm?

**Tier 2:** You already have the JWT signing secret (it's in the file you found for Flag 1). Use `jwt_tool` to decode your current token. Then tamper with the `role` field and re-sign with the known secret — or try the `alg:none` attack.

**Tier 3:** Use `jwt_tool <your_token> -X a` to attempt an `alg:none` bypass. Or: forge a token with `role:"admin"` signed with `secret123`. Then call `GET /api/admin/users` with the forged token in the `Authorization: Bearer` header.

---

## FLAG-09 (500 pts) — Server-Side Request Forgery

**Tier 1:** The transfer page has a field labeled "Webhook Notification URL." It says the server will call that URL when a transfer is processed. What does "the server will call that URL" mean in terms of network origin?

**Tier 2:** The request to the webhook URL is made *server-side* — the bank's server initiates the HTTP request, not your browser. This means it can reach services that you cannot reach directly. What services might be running on `localhost` of the bank's server?

**Tier 3:** Submit a transfer with `"callback_url": "http://localhost:8888/internal/config"`. The server fetches this URL from its own loopback interface and returns the response to you. Read the JSON carefully.

---

## FLAG-10 (600 pts) — Server-Side Request Forgery

**Tier 1:** HTTP isn't the only URL scheme. What other schemes does a URL support? Think about what a web server might do if you asked it to fetch a resource with a scheme other than `http://`.

**Tier 2:** Some HTTP client libraries support `file://` URIs — allowing them to read local filesystem paths as if they were URLs. If the server fetches any URL you give it without validating the scheme, what local files could you read?

**Tier 3:** Try `"callback_url": "file:///etc/passwd"` first to confirm file:// works. Then target `file:///var/www/app/secret/master_key.txt`. The flag is at the bottom of that file.

---

## General Recon Tips

- Always read `robots.txt` first
- Check HTTP response headers for version leakage (`curl -I http://...`)
- Read JavaScript source files — they reveal API endpoints
- The `_debug` field in API responses is your friend
- If an endpoint returns an error, read the error message — verbose errors are themselves a vulnerability

---

*Hints are ordered from subtle to explicit. A student who needs Tier 3 should revisit the workshop material for that vulnerability class.*
