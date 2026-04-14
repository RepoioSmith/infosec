# Lab 9 — Operation VAULT BREACH
### Web Application Security CTF | OWASP Top 10:2025

---

## The Briefing

You are a member of a contracted red team brought in by **NorthStar Bank & Trust** before their online banking portal goes live. The internal security team has reason to believe the application was rushed to production without a proper security review. Your task: find the vulnerabilities, capture the flags, and document everything.

The scope is the web application at `http://192.168.56.30`. No social engineering. No infrastructure attacks. No DoS. Web application layer only — go to work.

---

## Objectives

Five vulnerability categories are present in the application, drawn from the **OWASP Top 10:2025**. Ten flags are hidden across those five categories. Find them all.

| Category | OWASP 2025 |
|---|---|
| Security Misconfiguration | A05 |
| Injection | A04 |
| Broken Access Control | A01 |
| Cryptographic Failures | A02 |
| Server-Side Request Forgery | A10 |

---

## Flag Scoring

| Flag | Points | Difficulty |
|---|---|---|
| FLAG-01 | 50  | ★☆☆☆☆ |
| FLAG-02 | 75  | ★★☆☆☆ |
| FLAG-03 | 100 | ★★☆☆☆ |
| FLAG-04 | 150 | ★★★☆☆ |
| FLAG-05 | 200 | ★★★☆☆ |
| FLAG-06 | 250 | ★★★☆☆ |
| FLAG-07 | 300 | ★★★★☆ |
| FLAG-08 | 400 | ★★★★☆ |
| FLAG-09 | 500 | ★★★★★ |
| FLAG-10 | 600 | ★★★★★ |
| **Total** | **2,625** | |

All flags follow the format: `FLAG{...}`

---

## Setup

```bash
# Start the target VM
vagrant up northstar

# Target is reachable at:
#   http://192.168.56.30       (from your attacker VM)
#   http://localhost:8080      (from your host machine via port forward)
```

Your attacker machine: `192.168.56.10` (or your existing lab VM with standard tools).

---

## Tools

No commercial tools. Open source only.

| Tool | Install |
|---|---|
| `ffuf` | `sudo apt install ffuf` |
| `gobuster` | `sudo apt install gobuster` |
| `nikto` | `sudo apt install nikto` |
| `sqlmap` | `sudo apt install sqlmap` |
| `curl` | pre-installed |
| `john` | `sudo apt install john` |
| `hashcat` | `sudo apt install hashcat` |
| `jwt_tool` | `pip3 install jwt_tool` |
| Burp Suite CE | https://portswigger.net/burp |

---

## Rules of Engagement

- Target: `192.168.56.30` only
- No brute-force attacks on login (rate limiting may apply)
- No DoS or resource exhaustion
- Document every finding: tool used, payload, response
- All flags must be submitted with evidence of how they were found

---

## Deliverables

Submit a **penetration test report** containing:

1. **Flag Submission Table** — each flag, the vulnerability exploited, OWASP category, and CVSS severity estimate
2. **Proof of Exploitation** — for each flag: the exact command/payload used and the raw server response
3. **Attack Narrative** — a short paragraph per vulnerability explaining what the flaw is, why it exists, and how a developer could have prevented it
4. **Risk Rating** — order the 5 vulnerabilities from highest to lowest business risk for a financial institution and justify your ranking

---

## Ethics Notice

All activities are authorized within this isolated lab environment. Applying these techniques against any real-world system without explicit written authorization is illegal under 18 U.S.C. § 1030 (CFAA) and equivalent statutes. Think Purple Team — find the hole, document the fix.

---

*NorthStar Bank & Trust — "Securing Your Financial Future Since 1987"*
