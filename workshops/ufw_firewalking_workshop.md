# Operation IRON CURTAIN — Firewalls, UFW, and the Art of Firewalking
## A Gray Hat Workshop (45 minutes)

> *"A firewall is not a wall. It is a checkpoint. And every checkpoint has a procedure — you just need to know how to read it."*
>
> — **K4iros**, Prague underground, DEFCON 18 hallway track, 2010

---

## Prague, Czech Republic — August 2010

The hotel smelled like cigarettes and old carpet. Somewhere down the hall, three researchers from a Polish university were arguing loudly about BGP. It was 2 AM and the conference badge around **K4iros**'s neck still read GOON — volunteer staff, floor roamer, the kind of person who knew where the power outlets were hidden.

He had a laptop, a hotel wifi connection with suspicious DNS, and a problem.

The target wasn't malicious. It was an internal network segment at his own employer — a logistics company in Brno — whose network admin had deployed a firewall three months ago and simply told everyone: *"ports are locked down, trust me."* No documentation. No ruleset. No change log. K4iros was on the security team. He had every right to audit it. What he didn't have was access to the firewall config — the admin was on vacation and the backup was a handwritten note that someone had spilled coffee on.

He needed to know what the firewall was actually doing. Not what the admin *thought* it was doing. Not what the policy document said. What the packets saw when they hit it.

He opened `hping3` and thought about TTL.

The technique he was about to use was old. Older than him. It had a name: **firewalking**. Mike Schiffman and David Goldsmith had published it in 1998. Most people in the security world had heard of it. Very few had actually used it carefully, methodically, the way a surgeon uses a scalpel.

K4iros set his TTL to exactly one hop past the firewall. He sent the first probe.

He waited.

The ICMP came back.

He smiled.

The firewall had a hole in it on port 8080. The admin didn't know. The policy doc didn't mention it. But the network did — and the network never lies.

By 4 AM he had a full map of every open, closed, and filtered port on the protected segment. By Monday morning, the admin had a six-page report waiting on his desk.

Nobody got pwned that night. That was the point.

---

## Workshop Overview

| Item | Detail |
|---|---|
| **Duration** | 45 minutes |
| **Level** | Intermediate (comfortable with CLI and basic networking) |
| **Platform** | Ubuntu / ParrotOS |
| **Tools** | `ufw`, `iptables`, `hping3`, `firewalk`, `nmap`, `scapy` |
| **Goal** | Master UFW from the CLI and understand Firewalking as an auditing technique |

---

## Lab Environment

You need **two machines** — an attacker and a target with UFW enabled:

```
[Attacker]   192.168.56.10   ParrotOS / Ubuntu (no firewall, all tools installed)
[Target]     192.168.56.20   Ubuntu Server     (UFW enabled, services running)
[Gateway]    192.168.56.1    Router / VM host  (needed for firewalking TTL math)
```

> **Ethics reminder:** All exercises must be performed on your own lab VMs or on networks and systems you own or have explicit written authorization to test. Firewalking against production or third-party networks without permission is illegal.

---

## Part 1 — Firewall Fundamentals (5 min)

### The Three Layers of Linux Firewalling

```
Application  ──►  UFW (Uncomplicated Firewall)
                     │
                     ▼
               iptables / nftables  (kernel netfilter rules)
                     │
                     ▼
               Linux kernel netfilter framework
```

**UFW** is a frontend that translates human-readable rules into `iptables` rules. When you run `ufw allow 22`, it writes the equivalent `iptables` rule for you. Understanding this stack matters — it means you can always drop below UFW to `iptables` when you need precision.

### Stateful vs Stateless Firewalls

| Type | Tracks connections? | Example | Notes |
|---|---|---|---|
| **Stateless** | No — inspects each packet independently | ACLs on routers | Fast but easy to bypass with crafted packets |
| **Stateful** | Yes — tracks connection state (SYN, ESTABLISHED, etc.) | UFW / iptables with conntrack | Default on modern Linux; blocks unsolicited inbound |
| **Application-layer** | Yes + inspects payload | WAF, Snort, Suricata | Much harder to bypass |

UFW is **stateful** by default. This means:
- `ufw allow 22` → allows inbound TCP to port 22
- Return traffic (ACK, data) is automatically allowed — you don't need a separate rule
- Unsolicited inbound packets are dropped unless explicitly allowed

---

## Part 2 — UFW Basics (8 min)

### Installation and Initial State

```bash
# Install UFW (usually pre-installed on Ubuntu)
sudo apt install ufw -y

# Check current status (disabled by default on fresh install)
sudo ufw status
sudo ufw status verbose       # more detail
sudo ufw status numbered      # show rules with index numbers
```

### Default Policies — The Most Important Setting

Default policies define what happens to traffic that doesn't match any rule:

```bash
# Recommended defaults — deny everything in, allow everything out
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Paranoid mode — also deny outgoing (requires explicit allow for each service)
sudo ufw default deny outgoing
```

> **Security principle:** Default-deny is the correct posture. Never default-allow incoming traffic and then try to block the bad stuff — you will always miss something.

### Enable and Disable

```bash
# Enable UFW (WARNING: if SSH is not allowed, you will lock yourself out)
sudo ufw allow 22/tcp         # allow SSH FIRST if on a remote server
sudo ufw enable

# Disable UFW (all rules suspended, all traffic passes)
sudo ufw disable

# Reload rules after changes
sudo ufw reload

# Reset ALL rules to factory defaults (dangerous — prompts for confirmation)
sudo ufw reset
```

### Checking iptables Underneath

```bash
# See the actual iptables rules UFW generated
sudo iptables -L -n -v --line-numbers

# UFW stores its rules here — useful for auditing
cat /etc/ufw/user.rules
cat /etc/ufw/user6.rules          # IPv6 rules
```

---

## Part 3 — UFW Rule Management (10 min)

### Allow and Deny Rules

```bash
# Allow by port number
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 53/udp

# Allow by service name (reads from /etc/services)
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https

# Deny a port
sudo ufw deny 23/tcp              # block Telnet
sudo ufw deny 3389/tcp            # block RDP

# Reject instead of drop (sends RST back — faster for the client but reveals the firewall)
sudo ufw reject 25/tcp
```

> **Drop vs Reject:** `deny` silently drops the packet — the sender gets no response and must wait for timeout. `reject` sends an ICMP unreachable or TCP RST — polite but reveals the firewall exists. **Drop is preferred** for hardening (slower for attackers to enumerate).

### Source-based Rules

```bash
# Allow SSH only from a specific host
sudo ufw allow from 192.168.56.10 to any port 22

# Allow a subnet
sudo ufw allow from 192.168.56.0/24 to any port 3306   # MySQL only from LAN

# Block a specific attacker IP
sudo ufw deny from 10.10.10.99

# Block an entire subnet
sudo ufw deny from 203.0.113.0/24
```

### Interface-based Rules

```bash
# Allow HTTP traffic only on eth0 (not on other interfaces)
sudo ufw allow in on eth0 to any port 80

# Allow internal traffic on loopback
sudo ufw allow in on lo
```

### Managing and Deleting Rules

```bash
# Show numbered rules
sudo ufw status numbered

# Delete by number (safe — you see what you're deleting first)
sudo ufw delete 3

# Delete by rule specification
sudo ufw delete allow 80/tcp
sudo ufw delete deny from 10.10.10.99

# Insert a rule at a specific position (rule order matters — first match wins)
sudo ufw insert 1 deny from 10.10.10.99
```

### Rate Limiting (Anti-Brute-Force)

```bash
# Limit SSH: max 6 connections per 30 seconds per source IP — automatic brute-force protection
sudo ufw limit ssh

# Same with explicit port
sudo ufw limit 22/tcp
```

This single command replaces a complex iptables rule using `recent` and `hashlimit` modules. It is the single most impactful UFW rule for any internet-facing SSH server.

### Application Profiles

UFW ships with named profiles for common applications:

```bash
# List available profiles
sudo ufw app list

# Show what a profile does
sudo ufw app info 'Nginx Full'

# Apply a profile
sudo ufw allow 'Nginx Full'
sudo ufw allow 'OpenSSH'
```

Profiles are defined in `/etc/ufw/applications.d/` — you can write your own.

### Logging

```bash
# Enable logging (off by default)
sudo ufw logging on
sudo ufw logging low     # blocked packets only
sudo ufw logging medium  # blocked + rate-limited
sudo ufw logging high    # all packets
sudo ufw logging full    # everything (very verbose)

# UFW logs land here
tail -f /var/log/ufw.log

# Quick filter — see denied connections
grep '\[UFW BLOCK\]' /var/log/ufw.log | tail -20
```

---

## Part 4 — Firewalking: Reading the Firewall's Mind (17 min)

### The Core Idea

Firewalking is a **reconnaissance technique** for mapping firewall ACL rules without ever connecting to the protected host. It exploits how routers handle **TTL (Time To Live)** expiration.

Recall from TCP/IP: every IP packet carries a TTL field. Each router that forwards the packet decrements TTL by 1. When TTL hits 0, the router **drops the packet and sends an ICMP Time Exceeded (Type 11)** message back to the source.

**The firewalking insight:**

```
[Attacker] ──TTL=2──► [Firewall/GW] ──TTL=1──► [Protected Host]
                            │                         │
                     TTL reaches 0               TTL reaches 0
                     at this hop                 at this hop
```

If you craft a packet with TTL set to exactly **one hop past the gateway**:

- **If the port is ALLOWED:** the packet passes through the firewall, reaches the next router, TTL hits 0 there, and you receive an **ICMP Time Exceeded from the router behind the firewall** — proof the packet made it through.
- **If the port is BLOCKED:** the firewall drops the packet silently — you receive **nothing** (or an ICMP unreachable from the firewall itself).

You never connect to the target. You use the firewall's own forwarding behavior as a measurement instrument.

```
ALLOWED port:
  Attacker ──probe──► Firewall (passes) ──► Router-behind ──ICMP TTL-Exceeded──► Attacker ✓

BLOCKED port:
  Attacker ──probe──► Firewall (drops)   ──X                                     Attacker (silence) ✗
```

### Step 1 — Determine the Hop Count to the Gateway

```bash
# Find how many hops to the firewall/gateway
traceroute 192.168.56.1

# Or with hping3 (more control)
sudo hping3 -S -p 80 --traceroute 192.168.56.1
```

Take note of the hop count. If the gateway is **1 hop away**, your firewalking TTL will be **2** (one past the gateway).

### Step 2 — Firewalking with hping3

`hping3` gives you precise TTL control per packet. This is the manual, surgical approach.

```bash
# Probe TCP port 22 with TTL=2 (one hop past a 1-hop gateway)
# If allowed: you get ICMP Time Exceeded from the host behind the firewall
# If blocked: silence or ICMP unreachable from the firewall

sudo hping3 -S -p 22 --ttl 2 -c 3 192.168.56.20

# Probe multiple ports manually
for port in 22 80 443 3306 8080 8443; do
    echo -n "Port $port: "
    result=$(sudo hping3 -S -p $port --ttl 2 -c 1 --fast 192.168.56.20 2>&1)
    if echo "$result" | grep -q "TTL 0"; then
        echo "ALLOWED (ICMP TTL exceeded received)"
    else
        echo "BLOCKED (silence)"
    fi
done
```

### Step 3 — Firewalking with the `firewalk` Tool

`firewalk` automates the TTL-based probe across a port range. It requires two addresses: the **gateway** (the firewall) and the **target** (the protected host).

```bash
# Install firewalk
sudo apt install firewalk -y

# Basic firewalk scan
# Syntax: firewalk [options] <gateway> <target>
sudo firewalk -S 1-1024 -i eth0 192.168.56.1 192.168.56.20

# Scan only specific ports
sudo firewalk -S 22,80,443,3306,8080 -i eth0 192.168.56.1 192.168.56.20

# UDP firewalking
sudo firewalk -S 53,161,123 -i eth0 -P udp 192.168.56.1 192.168.56.20
```

**Reading firewalk output:**

```
port 22/tcp - open          ← packet got through, ICMP TTL-exceeded received
port 80/tcp - open          ← allowed
port 443/tcp - open         ← allowed
port 3306/tcp - filtered    ← dropped by firewall, silence
port 8080/tcp - open        ← HOLE FOUND — this shouldn't be open
```

### Step 4 — Firewalking with Nmap

Nmap can combine traceroute and port probing to achieve a similar result with `--ttl` flag:

```bash
# Nmap firewalking-style scan — set TTL to expire one hop past target
sudo nmap -sS -p 1-1024 --ttl 2 --reason 192.168.56.20

# Scan with traceroute correlation
sudo nmap -sS -p 22,80,443,8080,8443,3306 --traceroute --reason 192.168.56.20

# Combine with version detection for any open ports that slip through
sudo nmap -sS -sV -p- --ttl 2 --reason 192.168.56.20
```

### Step 5 — Firewalking with Scapy (Manual Crafting)

This gives you the deepest understanding — you see exactly what goes out and what comes back:

```python
from scapy.all import *

gateway = "192.168.56.1"
target  = "192.168.56.20"
ports   = [22, 80, 443, 3306, 8080, 8443]

print(f"{'Port':<8} {'Result':<30} {'Response From'}")
print("-" * 60)

for port in ports:
    # TTL=2: expires one hop past the gateway
    pkt = IP(dst=target, ttl=2) / TCP(dport=port, flags="S")
    reply = sr1(pkt, timeout=2, verbose=0)

    if reply is None:
        print(f"{port:<8} {'BLOCKED (no response)':<30}")
    elif reply.haslayer(ICMP) and reply[ICMP].type == 11:
        print(f"{port:<8} {'ALLOWED (ICMP TTL exceeded)':<30} {reply[IP].src}")
    elif reply.haslayer(TCP) and reply[TCP].flags == 0x12:  # SYN-ACK
        print(f"{port:<8} {'OPEN (SYN-ACK direct)':<30} {reply[IP].src}")
    elif reply.haslayer(ICMP) and reply[ICMP].type == 3:
        print(f"{port:<8} {'REJECTED (ICMP unreachable)':<30} {reply[IP].src}")
    else:
        print(f"{port:<8} {'UNKNOWN':<30} {reply.summary()}")
```

Save as `firewalk_probe.py` and run:

```bash
sudo python3 firewalk_probe.py
```

### Understanding the Results

| Response | Meaning |
|---|---|
| **ICMP Type 11 (TTL Exceeded) from a host behind the firewall** | Port is ALLOWED through the firewall |
| **Silence / timeout** | Port is BLOCKED (dropped) by the firewall |
| **ICMP Type 3 (Destination Unreachable) from the firewall** | Port is REJECTED (firewall actively refuses it) |
| **TCP SYN-ACK direct** | Port is open AND your TTL was high enough to reach target |
| **TCP RST direct** | Port is closed on target but firewall let the probe through |

> **Key insight:** Firewalking reveals the *firewall's ACL*, not the target host's open ports. A firewalked "open" port means the firewall lets that traffic through — the service behind it may still refuse the connection. These are two separate questions.

---

## Part 5 — Purple Team: Detection and Hardening (5 min)

Because we wear a gray hat and love the purple team:

### Detecting Firewalking from the Blue Side

Firewalking traffic has a distinctive signature: **low TTL values with SYN or UDP probes** that arrive with TTL=1 or TTL=2 at your gateway. This is abnormal — legitimate traffic arrives with TTL values in the 50–120 range.

```bash
# On the firewall/gateway — watch for TTL-manipulation probes
sudo tcpdump -i eth0 'ip[8] <= 3 and tcp[tcpflags] & tcp-syn != 0'
# ip[8] = TTL field; <= 3 = suspiciously low TTL

# Log low-TTL packets to a file
sudo tcpdump -i eth0 -w /tmp/low_ttl.pcap 'ip[8] <= 5' &

# With ufw logging on, look for low-TTL blocks
grep '\[UFW BLOCK\]' /var/log/ufw.log | awk '{print $13, $14}' | sort | uniq -c | sort -rn
# Look for patterns — many different DST ports from same SRC = firewalking
```

### Detect Port Scanning + Firewalking with nmap's Detection Scripts

```bash
# On the defender machine — check if portscan detection is running
sudo nmap --script firewall-bypass 192.168.56.20
```

### UFW Hardening Checklist

```bash
# 1. Verify default-deny is set
sudo ufw status verbose | grep -E 'Default:'

# 2. Confirm only necessary ports are open
sudo ufw status numbered

# 3. Enable rate limiting on SSH
sudo ufw limit 22/tcp

# 4. Block RFC1918 subnets that shouldn't reach you (if internet-facing)
# (adjust based on your topology — do NOT run this on a LAN-only server)
# sudo ufw deny from 10.0.0.0/8
# sudo ufw deny from 172.16.0.0/12
# sudo ufw deny from 192.168.0.0/16

# 5. Enable logging
sudo ufw logging medium

# 6. Block ICMP redirect (prevents ICMP Redirect MITM)
echo "net.ipv4.conf.all.accept_redirects = 0" | sudo tee -a /etc/sysctl.conf
echo "net.ipv4.conf.all.send_redirects = 0"   | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# 7. Enable SYN cookies (protects against SYN flood)
echo "net.ipv4.tcp_syncookies = 1" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# 8. Drop packets with suspicious TTL (advanced — use iptables directly)
sudo iptables -A INPUT -m ttl --ttl-lt 5 -j LOG --log-prefix "[LOW TTL] "
sudo iptables -A INPUT -m ttl --ttl-lt 5 -j DROP
```

### Firewall Audit — Verify Your Own Rules

After hardening, always verify from the *outside* what you think you've blocked:

```bash
# From the ATTACKER machine — verify UFW is doing what you think
sudo nmap -sS -p- --reason --open 192.168.56.20

# Compare nmap's view vs UFW's stated rules
# They should match exactly — if they don't, investigate
```

---

## Quick Reference — Cheat Sheet

```
# UFW STATUS
sudo ufw status verbose
sudo ufw status numbered

# DEFAULT POLICIES
sudo ufw default deny incoming
sudo ufw default allow outgoing

# ALLOW / DENY
sudo ufw allow 22/tcp
sudo ufw allow from 192.168.1.0/24 to any port 3306
sudo ufw deny 23/tcp
sudo ufw limit ssh

# DELETE RULES
sudo ufw status numbered
sudo ufw delete <number>

# LOGGING
sudo ufw logging medium
tail -f /var/log/ufw.log
grep 'UFW BLOCK' /var/log/ufw.log | tail -20

# FIREWALKING — determine TTL to gateway
traceroute <gateway>

# FIREWALKING — hping3 (manual)
sudo hping3 -S -p <port> --ttl <gateway_hops+1> -c 3 <target>

# FIREWALKING — firewalk (automated)
sudo firewalk -S 1-1024 -i eth0 <gateway> <target>

# FIREWALKING — low TTL probe detection
sudo tcpdump -i eth0 'ip[8] <= 3 and tcp[tcpflags] & tcp-syn != 0'

# HARDENING — SYN cookies + block ICMP redirects
echo "net.ipv4.tcp_syncookies = 1" | sudo tee -a /etc/sysctl.conf
echo "net.ipv4.conf.all.accept_redirects = 0" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

---

## Lab Exercises

### Exercise 1 — UFW Baseline (8 min)

On the **target** machine:

1. Install and enable UFW with default-deny incoming, allow outgoing.
2. Allow only SSH (port 22) and HTTP (port 80).
3. Block all traffic from the attacker IP `192.168.56.10`.
4. Enable medium logging.
5. From the **attacker**, run `nmap -sS -p 1-1000 192.168.56.20` and confirm only port 22 and 80 show as open. All others should show `filtered`.

### Exercise 2 — Rule Manipulation (7 min)

1. Add a rule: allow MySQL (3306) only from `192.168.56.10`.
2. Add a rule: rate-limit SSH.
3. View all rules with `status numbered`.
4. Delete the MySQL rule by its number.
5. Verify with `nmap` that MySQL is now filtered again.
6. Check `/var/log/ufw.log` — find the blocked scan attempts.

### Exercise 3 — Firewalking: Map the Ruleset (15 min)

On the **target**: configure UFW with a non-obvious ruleset — allow ports 22, 80, 8080, and 5432. Block everything else. **Do not tell your partner which ports are open.**

On the **attacker**:

1. First use `traceroute` to find the hop count to the gateway.
2. Use `hping3` to manually probe ports 22, 80, 443, 3306, 8080, 5432, 8443 using the correct TTL.
3. Use `firewalk` to scan ports 1–10000.
4. Use the Scapy script from Part 4 to confirm the results.
5. Compare your findings to the actual UFW rules — did you find all open ports?

### Exercise 4 — Purple Team: Catch the Firewalker (5 min)

While your partner runs the firewalking probes from Exercise 3:

1. On the **target**, run the `tcpdump` low-TTL detection command.
2. Observe the low-TTL probes arriving in real time.
3. Add the iptables rule to log and drop low-TTL packets.
4. Re-run the firewalking probe from the attacker — what changes?

---

## Recommended Reading and Tools

- `man ufw` — always the first stop
- `/etc/ufw/` — read the actual rule files UFW manages
- [UFW Community Help Wiki](https://help.ubuntu.com/community/UFW) — comprehensive Ubuntu docs
- *Firewalk: A Traceroute-Like Method of Remotely Enumerating IP Firewall ACLs* — Schiffman & Goldsmith, 1998 — the original paper (read it)
- `man hping3` — essential for crafting custom probes
- *The Art of Exploitation* — Jon Erickson — chapter on network-level attacks
- [SANS Reading Room: Firewall Auditing](https://www.sans.org/reading-room/) — search "firewall auditing"
- DEFCON talks: search "firewall evasion" on media.defcon.org — DC18 and DC22 have excellent sessions

---

## Final Thought

K4iros landed back in Brno on a Tuesday. He filed his report, attached the firewalk output, and wrote three sentences at the top:

*"The firewall is running. The firewall is wrong. Here is what it is actually doing."*

Port 8080 was an old dev proxy that the admin had forgotten to close after a deployment two years prior. It had been silently forwarding traffic to an internal application server ever since. No exploit. No malware. Just a forgotten rule and the quiet patience of someone who knew how to ask the network the right questions.

Firewalls are not set-and-forget. They are living documents. They drift. Administrators make mistakes, deployments leave debris, rules stack up without cleanup. Firewalking is not an attack — it is a **diagnostic tool**. The same technique used by a penetration tester to find holes is used by a security engineer to verify the rules are correct.

The difference is authorization. The difference is intent.

Know how to use the tool. Know *why* you're using it. Know what to do with what you find.

**Gray hat. Purple team. DEFCON vibes. Go audit something you're allowed to audit.**

---
