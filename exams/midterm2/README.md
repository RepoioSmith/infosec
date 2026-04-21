# Universidad Anahuac Mayab
## Cybersecurity
### Midterm Exam 2 — Operation SILENT WATCH
#### Intrusion Detection Systems with Snort

---

- **Submission:** Teams of two (2) students
- **Format:** Single Markdown document — `midterm2_[name1]_[name2].md`
- **Due Date:** May, 3rd by midnight.

---

## Legal Disclaimer

```
╔══════════════════════════════════════════════════════════════════════════╗
║                        LEGAL DISCLAIMER                                  ║
║                   FOR EDUCATIONAL PURPOSES ONLY                          ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                          ║
║  All activities described in this exam are conducted EXCLUSIVELY for     ║
║  academic and educational purposes in a controlled lab environment.      ║
║                                                                          ║
║  Techniques demonstrated here must NEVER be applied to systems you do    ║
║  not own or lack explicit written authorization to test.                 ║
║                                                                          ║
║  This exam promotes the ethical application of cybersecurity skills.     ║
║  By beginning this exam, you acknowledge that you have read,             ║
║  understood, and agree to operate under these terms.                     ║
║                                                                          ║
╚══════════════════════════════════════════════════════════════════════════╝
```

---

## The Briefing — Operation SILENT WATCH

*[Read this. It sets the stage.]*

---

It's 02:04 AM. You're deep in a client engagement when a new secure message drops.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SECURE CHANNEL — ENCRYPTED TRANSMISSION
  TO   : Blue Cell Pair 7
  FROM : @OVERWATCH
  RE   : Operation SILENT WATCH — IMMEDIATE ACTION REQUIRED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Our threat intelligence just flagged CorpIntranet — a mid-sized
  logistics company — for anomalous network activity over the last
  72 hours. Unknown source, unknown intent. Could be recon.
  Could be worse.

  They have no IDS. No visibility. They are flying blind.

  Your team has been deployed. You have a Snort sensor and access
  to the internal network. The clock is already running.

  Your mission:

    1. Deploy and configure Snort as a Network IDS.
    2. Arm it with community detection rules.
    3. Write custom rules to catch threats the community rules miss.
    4. Demonstrate that the IDS works — launch controlled attacks
       and prove Snort catches them.
    5. Deliver a full report with evidence.

  The client is watching. Make it count.

  — @OVERWATCH

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Mission Overview

You and your partner are the Blue Team. Your job is to **set up eyes on the network** — configure Snort IDS to monitor traffic, load community detection rules, write original detection rules, and then prove the system works by launching controlled attacks and capturing the alerts.

This exam is hands-on and evidence-driven. Screenshots of tool output and copy-pasted terminal output are your proof of work. A finding that isn't documented didn't happen.

Think like a defender. Build your sensor. Watch the wire. Catch the threat.

---

## Grading Summary

| Part | Topic | Points |
|---|---|---|
| 1 | Installation & Verification | 20 |
| 2 | Snort Rule Syntax & Custom Rules | 25 |
| 3 | Configuration & Community Rules | 20 |
| 4 | Detection Demonstration | 30 |
| 5 | Analysis & Reflection | 5 |
| **TOTAL** | | **100** |

---

## Lab Environment

You are provided with **three virtual machines**. Each has a specific role in the lab.

| VM | OS | Role |
|---|---|---|
| `snort-ids` | Ubuntu 22.04 LTS | Your IDS sensor — Snort runs here |
| `target` | Alpine Linux | The protected server |
| `attacker` | Alpine Linux | Your controlled attack platform |

### Starting the Lab

```bash
# From the exam directory (where the Vagrantfile lives)
vagrant up

# Wait for all three VMs to provision, then access them:
vagrant ssh snort-ids
vagrant ssh attacker
vagrant ssh target
```

> **Important:** The `snort-ids` VM sits at the boundary between the attack segment and the target segment. Part of your mission is to understand this topology by exploring the network yourself. Use `ip addr show`, `ip route show`, and `ping` to map the environment before touching Snort.

### Useful Vagrant Commands

```bash
vagrant status            # Check which VMs are running
vagrant halt              # Shut down all VMs
vagrant reload            # Restart all VMs (re-runs provisioning)
vagrant ssh <vm-name>     # SSH into a specific VM
```

---

## Part 1: Installation & Verification — (20 pts)

### 1.1 Understand Your Network Topology (5 pts)

Before configuring anything, map your environment. On **each** VM, run:

```bash
ip addr show        # List all interfaces and IP addresses
ip route show       # Show routing table
hostname            # Confirm the VM identity
```

Also run a quick connectivity test from the attacker to the target:

```bash
ping -c 3 <target_ip>
```

In your submission: document the IP addresses discovered on each VM, identify which interface on `snort-ids` faces the attack segment, and include a self-drawn ASCII diagram of the network topology.

---

### 1.2 Verify Snort Installation (10 pts)

Snort 2.9.x is pre-installed on the `snort-ids` VM. Confirm the installation and version:

```bash
snort --version
```

Next, run Snort in validation mode to test the default configuration:

```bash
sudo snort -T -c /etc/snort/snort.conf
```

The `-T` flag parses the config and rules without opening a capture interface. You should see a line similar to:

```
Snort successfully validated the configuration!
```

Fix any errors before proceeding. Include the full output of both commands in your submission.

---

### 1.3 Identify the Monitoring Interface (5 pts)

Snort needs to be told which network interface to listen on. Based on the topology you mapped in 1.1, identify the correct interface on `snort-ids` — the one facing the attack segment where traffic between the attacker and the target will flow.

```bash
# List interfaces with their states
ip link show

# Confirm traffic is visible on your chosen interface
sudo tcpdump -i <interface> -c 10
```

Document:
- The interface name you will use for Snort
- Why you chose this interface (not the management/NAT interface)
- Sample `tcpdump` output confirming traffic is visible

---

## Part 2: Snort Rule Syntax & Custom Rules — (25 pts)

### 2.1 Introduction to Snort Rule Syntax

Every Snort rule has two parts: a **header** and an **options block**. Together they answer: *what to match* (header) and *what to do / what to look for* (options).

```
action  protocol  src_ip  src_port  direction  dst_ip  dst_port  (option:value; ...)
```

---

#### Rule Header

**Actions**

| Action | Effect |
|---|---|
| `alert` | Generate an alert and log the packet |
| `log` | Log the packet without alerting |
| `pass` | Ignore the packet |
| `drop` | Block and log (IPS mode only) |
| `reject` | Block, log, and send a TCP reset / ICMP unreachable |

In NIDS (passive monitoring) mode you will almost always use `alert`.

---

**Protocols**

```
tcp   udp   icmp   ip
```

Use the most specific protocol that applies. `ip` matches all IP traffic regardless of transport layer protocol.

---

**Source and Destination IP Addresses**

```
any              →  Match any IP address
192.168.1.0/24   →  Match a specific subnet
!192.168.1.0/24  →  Match anything EXCEPT this subnet
[192.168.1.0/24,10.0.0.0/8]  →  Match a list of networks
$HOME_NET        →  Snort variable — your protected network(s)
$EXTERNAL_NET    →  Snort variable — everything outside HOME_NET
```

---

**Ports**

```
any          →  Match any port
80           →  Match port 80 only
1:1024       →  Match ports 1 through 1024 (inclusive)
!80          →  Match any port EXCEPT 80
[80,443,8080]→  Match a list of ports
```

---

**Direction Operator**

```
->    →  Unidirectional: src → dst
<>    →  Bidirectional: match traffic in either direction
```

---

#### Rule Options (the Body)

Options live inside parentheses, separated by semicolons. Each is a `keyword:value;` pair (or just `keyword;` for flags).

---

**`msg`** — Alert message displayed in the log. Always the first option.

```
msg:"Descriptive alert message here";
```

---

**`content`** — Match a literal string in the packet payload.

```
content:"GET";           # Case-sensitive match
content:"get";nocase;    # Case-insensitive match
```

You can also match binary data using hex notation:

```
content:"|0d 0a|";       # Match CRLF (carriage return + line feed)
```

---

**`nocase`** — Makes the preceding `content` keyword case-insensitive.

```
content:"password"; nocase;
```

---

**`flow`** — Specifies the direction of traffic relative to a TCP session.

| Value | Meaning |
|---|---|
| `to_server` | Traffic flowing from client to server |
| `to_client` | Traffic flowing from server to client |
| `established` | Match only on fully established TCP connections |
| `stateless` | Match regardless of connection state |

Common combination:
```
flow:to_server,established;
```

This means: match packets sent from the client to the server on an already-established TCP connection. Use this when you want to inspect what a client is *sending* (commands, requests, payloads).

---

**`sid`** — Unique Snort rule ID (Signature ID). Required for every rule.

```
sid:1000001;
```

- SIDs 1–999,999 are reserved for official Snort rules
- SIDs 1,000,000+ are for local/custom rules
- Every rule must have a unique SID

---

**`rev`** — Rule revision number. Increment when you modify a rule.

```
rev:1;
```

---

#### Putting It Together — Example Rules

**Example A — Detect a Telnet login prompt**

```
alert tcp any any -> $HOME_NET 23 (msg:"Telnet Login Prompt Detected"; flow:to_client,established; content:"login:"; nocase; sid:9000001; rev:1;)
```

Breaking it down:
- `alert tcp` — generate an alert on a TCP packet
- `any any -> $HOME_NET 23` — from any source to the Telnet port on our network
- `flow:to_client,established` — the *server* is sending this (login prompt going back to the client)
- `content:"login:"; nocase;` — payload contains "login:" (case-insensitive)
- `sid:9000001; rev:1;` — unique ID, revision 1

---

**Example B — Detect any ICMP echo request (ping)**

```
alert icmp any any -> $HOME_NET any (msg:"ICMP Echo Request to Protected Network"; itype:8; sid:9000002; rev:1;)
```

- `alert icmp` — protocol is ICMP (no ports for ICMP — use `any any`)
- `itype:8` — ICMP type 8 = Echo Request (what `ping` sends)
- No `content` needed — the ICMP type alone is enough to identify pings

---

**Example C — Minimal TCP rule (no content match)**

```
alert tcp any any -> $HOME_NET 22 (msg:"SSH Connection Attempt Detected"; flow:to_server; sid:9000003; rev:1;)
```

A rule without `content` will fire on *any* TCP connection to port 22. It is less precise than a content-match rule but useful for detecting connection attempts regardless of payload.

---

> **Key insight:** The examples above show the building blocks. In real-world detection engineering, the `content` keyword is your most powerful tool — it lets you fingerprint specific protocols, commands, and attack signatures by the exact strings they put on the wire.

---

### 2.2 Write Your Own Rules (25 pts)

The `target` VM runs the following services:

| Service | Port |
|---|---|
| HTTP | 80 |
| FTP | 21 |
| SSH | 22 |

Using **only the syntax introduced in Section 2.1**, write **two original Snort rules** that detect suspicious or security-relevant activity on this host. Your rules must:

- Use the `alert` action
- Target `tcp` protocol
- Include `msg`, `content`, `nocase`, `flow`, `sid`, and `rev`
- Use `sid:1000001` and `sid:1000002`
- Be original — do not copy community rules or adapt the examples above

Place both rules in `/etc/snort/rules/local.rules` on the `snort-ids` VM:

```bash
sudo nano /etc/snort/rules/local.rules
```

Then register the file in `snort.conf`:

```bash
# Add this line to /etc/snort/snort.conf (near the other include lines)
include $RULE_PATH/local.rules
```

Verify both rules load without errors:

```bash
sudo snort -T -c /etc/snort/snort.conf
```

**In your submission, for each rule provide:**
1. The complete rule (code block)
2. A one-paragraph explanation: what it detects, why this network event matters, and what an attacker doing this implies
3. Evidence that the rule triggered (you will generate this in Part 4)

---

## Part 3: Configuration & Community Rules — (20 pts)

### 3.1 Configure snort.conf (10 pts)

The main Snort configuration file lives at `/etc/snort/snort.conf`. You need to make four changes:

**a) Set `HOME_NET`** — Tell Snort which network(s) it is protecting. This is the core variable used throughout the rule set.

```bash
# Find the current HOME_NET line
grep "ipvar HOME_NET" /etc/snort/snort.conf
```

Edit it to reflect the actual IP range(s) of the target segment you discovered in Part 1:

```
ipvar HOME_NET <target_network_cidr>
```

**b) Confirm `RULE_PATH`** — Verify the rule directory is set correctly:

```
var RULE_PATH /etc/snort/rules
```

**c) Configure full alert output** — Add or uncomment this line to enable the full alert format (includes packet headers and payload hex dump):

```
output alert_full: snort.alert
```

**d) Include your local rules** — As done in Part 2, confirm this line is present:

```
include $RULE_PATH/local.rules
```

In your submission: include the relevant excerpt from your `snort.conf` showing each of these four settings.

---

### 3.2 Download & Install Community Rules (5 pts)

Snort Community Rules are maintained by the Snort team and are free to download without registration. They cover thousands of known attack signatures.

```bash
cd /tmp
wget https://www.snort.org/downloads/community/community-rules.tar.gz
tar -xzf community-rules.tar.gz
ls community-rules/
sudo cp community-rules/community.rules /etc/snort/rules/
```

Add the community rules to `snort.conf`:

```bash
# Add this include line in snort.conf (after the local.rules include):
include $RULE_PATH/community.rules
```

Document the commands you ran and the output of `ls /etc/snort/rules/` after copying.

---

### 3.3 Verify Full Configuration Loads (5 pts)

Run Snort in test mode one final time with the complete configuration — community rules + your local rules:

```bash
sudo snort -T -c /etc/snort/snort.conf
```

Look for the summary line at the end of the output, which tells you how many rules were loaded:

```
+++++++++++++++++++++++++++++++++++++++++++++++++++
Initializing rule chains...
...
   <N> Snort rules read
      <N> detection rules
...
Snort successfully validated the configuration!
```

In your submission: paste the full test output (or at minimum the rule-count summary and the final "successfully validated" line).

---

## Part 4: Detection Demonstration — (30 pts)

In this section you will launch controlled attacks from the `attacker` VM and prove that Snort catches them. All attacks target the `target` VM.

> **Before you start:** Open two terminal windows on `snort-ids`.
> - **Terminal 1:** Run Snort (stays open)
> - **Terminal 2:** Watch the alert log in real time

**Terminal 1 — Start Snort:**

```bash
sudo snort -i <interface> -c /etc/snort/snort.conf -A full -l /var/log/snort/
```

**Terminal 2 — Watch alerts live:**

```bash
sudo tail -f /var/log/snort/snort.alert
```

Leave both terminals running throughout all four attacks.

---

### 4.1 Attack 1 — nmap Reconnaissance (8 pts)

Port scanning is the first move in any intrusion. From the `attacker` VM:

```bash
# SYN scan — the classic "half-open" stealth scan
sudo nmap -sS <target_ip>

# Service version detection
sudo nmap -sV <target_ip>

# OS fingerprinting
sudo nmap -O <target_ip>

# NULL scan (no flags set — another evasion technique)
sudo nmap -sN <target_ip>
```

After all four scans, review the Snort alert log:

```bash
sudo cat /var/log/snort/snort.alert | grep -A 5 "nmap\|scan\|portscan" -i | head -60
```

In your submission:
- The exact commands you ran (with target IP filled in)
- Relevant Snort alert entries for this attack
- Which scan types generated alerts and which (if any) did not

---

### 4.2 Attack 2 — hping3 Packet Flood (8 pts)

hping3 lets you craft and send arbitrary packets at high rate. From the `attacker` VM:

```bash
# SYN flood simulation — 100 packets to HTTP port
sudo hping3 -S -p 80 --flood -c 100 <target_ip>

# ICMP flood simulation — 100 packets
sudo hping3 --icmp --flood -c 100 <target_ip>
```

> **Note:** The `-c 100` flag limits the burst to 100 packets. Do not remove this limit — this is a controlled test, not a real DoS attack.

Review the alert log for flood-related detections:

```bash
sudo cat /var/log/snort/snort.alert | grep -A 5 "flood\|icmp\|SYN" -i | head -60
```

In your submission:
- The commands run
- Snort alert entries generated
- Analysis of what Snort detected vs. what it missed

---

### 4.3 Attack 3 — Web Application Scanner (9 pts)

Nikto is an open-source web server scanner that probes for thousands of known vulnerabilities, misconfigurations, and dangerous files. From the `attacker` VM:

```bash
nikto -h <target_ip> -p 80
```

This scan will take a few minutes. While it runs, watch the Snort terminal — you should see alerts firing in real time.

After nikto completes, review the full alert log:

```bash
sudo cat /var/log/snort/snort.alert | head -100
```

In your submission:
- Nikto command and a summary of its findings (from nikto's own output)
- Snort alert entries for the web scan
- Did your custom rules from Part 2 fire during this attack? Provide evidence.

---

### 4.4 FTP Interaction (5 pts)

From the `attacker` VM, connect to the FTP service on the target:

```bash
ftp <target_ip>
```

When prompted for a username and password, enter:
- Username: `anonymous`
- Password: (press Enter or any string)

After logging in, run a few commands (`ls`, `pwd`, `quit`) and then disconnect.

Review the Snort alert log for any FTP-related entries:

```bash
sudo cat /var/log/snort/snort.alert | grep -i "ftp" -A 5 | head -40
```

In your submission:
- Confirm the FTP connection was established (paste terminal output)
- Snort alert entries related to this FTP session
- Did your custom rules capture this activity?

---

### 4.5 Full Alert Log Review

Once all attacks are complete, export the full alert log for your submission:

```bash
sudo cp /var/log/snort/snort.alert /home/vagrant/snort_full_alerts.txt
cat /home/vagrant/snort_full_alerts.txt
```

Include a meaningful excerpt (minimum 30 alert entries) in your submission as a code block.

---

## Part 5: Analysis & Reflection — (5 pts)

Write a structured analysis addressing **all four** of the following points. Minimum 300 words total.

**1. Detection Coverage**
Review every attack in Part 4. For each one, was it detected? Was it detected by a community rule or by one of your custom rules? Build a simple table:

| Attack | Detected? | Rule Source | Alert Message |
|---|---|---|---|
| nmap SYN scan | Yes / No | Community / Custom | `...` |
| ... | | | |

**2. Blind Spots**
Were there any attacks or techniques that Snort failed to detect? Why do you think they slipped through? What type of rule would catch them?

**3. IDS vs. IPS**
Based on your hands-on experience, explain in your own words the operational difference between an Intrusion Detection System (IDS) and an Intrusion Prevention System (IPS). In what scenarios would you deploy each? What are the risks of running an IPS in a production network?

**4. Blue Team Recommendation**
You are writing a short memo to the CorpIntranet security team. In 3–5 bullet points, summarize your key recommendations for improving their network security posture based on what you observed during this exercise.

---

## A Note on Snort 3

This exam uses **Snort 2.9.x**, the most widely documented and deployed major version of Snort.

**Snort 3** (also called Snort++) is the current generation of the platform, rewritten from the ground up. Key differences worth knowing:

- **Configuration format:** Snort 3 uses Lua-based configuration files instead of the classic `snort.conf` syntax
- **Performance:** Multi-threaded packet processing — significantly better on multi-core hardware
- **Rule syntax:** Largely compatible with 2.9.x rules, but some options and preprocessors have changed
- **Architecture:** Plugin-based with more modular preprocessors (now called "inspectors")
- **Deployment:** Recommended for all new production deployments as of 2021+

The detection fundamentals — rule structure, content matching, alert logic — remain the same between versions. Everything you learn here transfers directly. For official Snort 3 documentation and downloads: <https://www.snort.org>

---

## Submission Requirements

Submit a **single Markdown file** named:

```
midterm2_[lastname1]_[lastname2].md
```

Use the provided `submission_template.md` as your starting structure. Your document must contain:

- [ ] Cover section with team names and student IDs
- [ ] Part 1: Network topology diagram + interface identification + version output
- [ ] Part 2: Both custom rules (code blocks) + explanations
- [ ] Part 3: snort.conf excerpts + community rules install commands + validation output
- [ ] Part 4: All attack commands + corresponding Snort alert output (code blocks)
- [ ] Part 4.5: Full alert log excerpt (≥ 30 entries)
- [ ] Part 5: Analysis table + written reflection (≥ 300 words)

> All terminal output must be in fenced code blocks (` ``` `). Rules must be in Snort rule syntax code blocks. Do not submit screenshots — paste terminal output as text.

---

## Resources

| Resource | URL |
|---|---|
| Snort Official Site | <https://www.snort.org> |
| Snort 2.9 Users Manual | <https://www.snort.org/documents> |
| Community Rules | <https://www.snort.org/downloads/community/community-rules.tar.gz> |
| Snort Rule Writing Guide | <https://docs.snort.org/rules/> |
| nmap Reference | <https://nmap.org/book/man.html> |
| hping3 Man Page | `man hping3` |
| Nikto Documentation | `nikto -Help` |

---

## Pro Tips from the Field

> Defenders who have done this before left you some notes.

1. **Run `snort -T` obsessively.** Every time you edit `snort.conf` or `local.rules`, validate before you run. A syntax error in a rule file will kill the entire process silently.

2. **Know your interfaces.** On Ubuntu, interfaces are named predictably — `enp0s3` is usually NAT (management), `enp0s8` and `enp0s9` are your private networks. Running Snort on the wrong interface means zero alerts.

3. **`HOME_NET` matters.** If your `HOME_NET` is wrong, direction-based rules (`-> $HOME_NET`) won't match. Double-check your snort.conf variable against the actual IP range you discovered.

4. **`tail -f` is your friend.** Watching alerts stream in real time as you attack is far more instructive than reviewing a log after the fact.

5. **The alert log format is verbose.** Snort's full alert format includes the 5-tuple, flags, and hex dump. It's a lot to read — use `grep` to filter by msg or IP to find what you need.

6. **Reachability first.** If your attacks produce no alerts at all, check routing before blaming Snort. `ping` from attacker to target. `tcpdump` on the IDS interface. Verify traffic is actually flowing through the sensor.

---

*"An organization that thinks it has perfect security is either lying to itself or has never been seriously tested."*
*— Bruce Schneier*

---

**Good luck, Blue Team. The wire doesn't lie.**

*— Happy Hacking!*
