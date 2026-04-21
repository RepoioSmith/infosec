# Midterm 2 — Operation SILENT WATCH
## Intrusion Detection Systems with Snort

| Field | Value |
|---|---|
| **Student 1** | [Full Name] — [Student ID] |
| **Student 2** | [Full Name] — [Student ID] |
| **Date** | [Submission Date] |
| **Course** | Cybersecurity — Universidad Anahuac Mayab |

---

## Part 1: Installation & Verification

### 1.1 Network Topology

**IP Addresses Discovered:**

| VM | Interface | IP Address | Role |
|---|---|---|---|
| snort-ids | | | Management (NAT) |
| snort-ids | | | Attack segment |
| snort-ids | | | Target segment |
| attacker | | | |
| target | | | |

**Network Topology Diagram:**

```
[paste your ASCII diagram here]
```

**Connectivity test (attacker → target):**

```
[paste ping output here]
```

---

### 1.2 Snort Version & Test Run

**`snort --version` output:**

```
[paste output here]
```

**`snort -T -c /etc/snort/snort.conf` output:**

```
[paste output here]
```

---

### 1.3 Monitoring Interface

**Selected interface:** `[interface name]`

**Why this interface (explanation):**

[Your explanation here]

**`ip link show` output:**

```
[paste output here]
```

**`tcpdump` sample confirming traffic visibility:**

```
[paste tcpdump output here]
```

---

## Part 2: Snort Rule Syntax & Custom Rules

### Rule 1

**Complete rule:**

```snort
[paste your rule here]
```

**What it detects:**

[Explain what network event this rule matches]

**Why this event matters:**

[Explain the security significance — what would an attacker doing this imply?]

**Evidence the rule fires (from Part 4):**

```
[paste Snort alert entry here — fill this in after completing Part 4]
```

---

### Rule 2

**Complete rule:**

```snort
[paste your rule here]
```

**What it detects:**

[Explain what network event this rule matches]

**Why this event matters:**

[Explain the security significance]

**Evidence the rule fires (from Part 4):**

```
[paste Snort alert entry here — fill this in after completing Part 4]
```

---

## Part 3: Configuration & Community Rules

### 3.1 snort.conf Configuration

**Relevant snort.conf excerpt:**

```
[paste the four configured lines: HOME_NET, RULE_PATH, output alert_full, include directives]
```

---

### 3.2 Community Rules Download

**Commands run:**

```bash
[paste commands here]
```

**`ls /etc/snort/rules/` output after installation:**

```
[paste output here]
```

---

### 3.3 Full Configuration Validation

**`snort -T -c /etc/snort/snort.conf` output (final, with all rules loaded):**

```
[paste full output — especially the rule count and "successfully validated" line]
```

---

## Part 4: Detection Demonstration

> Note: Snort was running with this command during all attacks:
```bash
sudo snort -i [interface] -c /etc/snort/snort.conf -A full -l /var/log/snort/
```

---

### 4.1 Attack 1 — nmap Reconnaissance

**Commands run (from attacker VM):**

```bash
[paste exact nmap commands with target IP]
```

**Snort alert output:**

```
[paste relevant alert entries from /var/log/snort/snort.alert]
```

**Analysis — which scans were detected and which were not:**

[Your analysis here]

---

### 4.2 Attack 2 — hping3 Flood

**Commands run (from attacker VM):**

```bash
[paste hping3 commands with target IP]
```

**Snort alert output:**

```
[paste relevant alert entries]
```

**Analysis:**

[Your analysis here]

---

### 4.3 Attack 3 — Nikto Web Scanner

**Command run:**

```bash
nikto -h [target_ip] -p 80
```

**Nikto output summary:**

```
[paste nikto findings here]
```

**Snort alert output:**

```
[paste alert entries — look for both community rule hits AND your custom Rule 2]
```

**Did custom Rule 2 fire? Evidence:**

```
[paste specific alert entry for Rule 2 here]
```

---

### 4.4 FTP Interaction

**FTP terminal session (from attacker VM):**

```
[paste ftp session output including login with anonymous user]
```

**Snort alert output:**

```
[paste FTP-related alert entries — look for your custom Rule 1]
```

**Did custom Rule 1 fire? Evidence:**

```
[paste specific alert entry for Rule 1 here]
```

---

### 4.5 Full Alert Log Excerpt

```
[paste minimum 30 alert entries from /var/log/snort/snort.alert]
```

---

## Part 5: Analysis & Reflection

### Detection Coverage Table

| Attack | Detected? | Rule Source | Alert Message |
|---|---|---|---|
| nmap SYN scan | | Community / Custom / None | |
| nmap OS scan | | | |
| nmap NULL scan | | | |
| hping3 SYN flood | | | |
| hping3 ICMP flood | | | |
| Nikto web scan | | | |
| FTP anonymous login | | | |

---

### Blind Spots

[What attacks did Snort miss, and why? What rules would catch them?]

---

### IDS vs. IPS

[Explain the operational difference in your own words. When would you deploy each?]

---

### Blue Team Memo to CorpIntranet

**TO:** CorpIntranet Security Team
**FROM:** [Team Names]
**RE:** Security Posture Recommendations

- 
- 
- 
- 
- 

---

*Submission word count (Part 5): approximately [N] words*
