# Lab 12 — Operation VELVET LOCK
## TLS Hardening: Securing the Web with OpenSSL and Apache

| Field | Value |
|---|---|
| **Student** | [Full Name] — [Student ID] |
| **Date** | [Date] |
| **OS** | Ubuntu 22.04 (Vagrant VM) |

---

## Part 1: HTTP Plaintext Capture — The Vulnerability

### 1.1 tcpdump Output (HTTP on port 80)

```
[paste full tcpdump -A output here — show the plaintext HTTP request including headers]
```

### 1.2 Credential Decoded

**Command:**
```bash
echo "c3Zvb29kYTpzZWNyZXQxMjM=" | base64 -d
```

**Output:**
```
[paste decoded output here]
```

**Username:** [extracted value]
**Password:** [extracted value]

### 1.3 Interceptor Analysis

**URL accessed:** [what page was requested]
**Credentials exposed:** [username:password]
**Other exposed data:** [list other visible headers or content]

**Security impact:** [What could an interceptor do with this? 2–3 sentences]

---

## Part 2: Generating the Cryptographic Key & Certificate

### 2.1 RSA Private Key Generation

**Command:**
```bash
[paste the openssl genrsa command here]
```

**Verification:**
```
[paste output of: openssl rsa -in /etc/ssl/private/svoboda.key -check]
```

### 2.2 Self-Signed Certificate Generation

**Command:**
```bash
[paste the openssl req -new -x509 command here]
```

### 2.3 Certificate Inspection

**`openssl x509 -text -noout` output:**
```
[paste FULL output here]
```

**Field Analysis:**

| Field | Value from Certificate | Notes |
|---|---|---|
| Issuer | | |
| Subject | | Same as Issuer? [Yes/No — why?] |
| Serial Number | | |
| Not Before | | |
| Not After | | |
| Public Key Algorithm | | |
| Key Size | | |
| Signature Algorithm | | |

---

## Part 3: Apache TLS Configuration

### 3.1 Modules Enabled

```bash
[paste a2enmod commands and their output]
```

### 3.2 SSL VirtualHost Configuration

**`/etc/apache2/sites-available/default-ssl.conf` full contents:**

```apache
[paste entire file contents here]
```

**`apache2ctl configtest` output:**
```
[paste here — should show "Syntax OK"]
```

### 3.3 HTTPS Verified Working

**`curl -k https://localhost` output:**
```
[paste HTML response here]
```

**`openssl s_client` certificate verification:**
```bash
echo | openssl s_client -connect localhost:443 2>/dev/null | openssl x509 -noout -subject -issuer -dates
```
```
[paste output here]
```

---

## Part 4: HTTP → HTTPS Redirect & HSTS

### 4.1 Redirect Configuration

**`/etc/apache2/sites-available/000-default.conf` relevant section:**

```apache
[paste VirtualHost *:80 block here]
```

**`curl -v http://localhost` output (showing the 301):**
```
[paste output here — look for 301 Moved Permanently and Location header]
```

### 4.2 HSTS Header

**HSTS directive added to `default-ssl.conf`:**
```apache
[paste the Header directive here]
```

**`curl -k -I https://localhost` output (showing the HSTS header):**
```
[paste response headers here — look for Strict-Transport-Security]
```

---

## Part 5: TLS Hardening

### 5.1 Hardening Directives Added

**Directives added to `default-ssl.conf`:**
```apache
[paste SSLProtocol and SSLCipherSuite lines here]
```

### 5.2 nmap Protocol Verification

**`sudo nmap --script ssl-enum-ciphers -p 443 localhost` output:**
```
[paste full nmap output here — verify TLS 1.0/1.1 absent, TLS 1.2/1.3 present]
```

### 5.3 openssl s_client Protocol Tests

**TLS 1.0 (should fail):**
```
[paste output]
```

**TLS 1.1 (should fail):**
```
[paste output]
```

**TLS 1.2 (should succeed):**
```
[paste output]
```

**TLS 1.3 (should succeed):**
```
[paste output]
```

---

## Part 6: Before & After — HTTP vs HTTPS on the Wire

### 6.1 HTTPS tcpdump Capture

```
[paste tcpdump -A port 443 output here — should show ciphertext, not plaintext]
```

### 6.2 Side-by-Side Comparison

| | HTTP Capture (Part 1) | HTTPS Capture (Part 6) |
|---|---|---|
| Destination URL visible? | | |
| Authorization header visible? | | |
| Page content readable? | | |
| Other headers exposed? | | |

### 6.3 Written Analysis

**The Interceptor's 21-Day Access:**

[What was the SVOBODA interceptor reading for three weeks? What could they have done with that access?]

**What TLS Protects — and What It Does Not:**

[Based on your captures: what does TLS hide? What remains visible even over HTTPS?]

**The `-k` Flag and Its Risk:**

[What does `curl -k` do? What real-world attack does bypassing certificate verification enable?]

**HSTS — Why It Matters:**

[Explain in your own words what HSTS prevents and why it is necessary even when TLS is configured.]

---

## Final Verification Checklist

```bash
# Run all five checks and paste output here
curl -v http://localhost 2>&1 | grep "301\|Location"
curl -k https://localhost | grep "SVOBODA"
echo | openssl s_client -connect localhost:443 2>/dev/null | openssl x509 -noout -subject
sudo nmap --script ssl-enum-ciphers -p 443 localhost | grep -E "TLSv|SSLv"
curl -k -I https://localhost | grep -i strict
```

```
[paste all five outputs here]
```
