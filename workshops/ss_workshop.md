# Operation OPEN SOCKET — ss: The Network Analyst's Scalpel
## A Zero-to-Hero Workshop (45 minutes)

> *"Give me six hours to chop down a tree and I will spend the first four sharpening the axe."*
> *Adapted for the NOC: give me six hours to hunt a threat and I will spend the first four learning my tools.*
>
> — **Amara Diallo**, Senior SOC Analyst, Dakar, 2022

---

## Dakar, Senegal — March 2022

The breach call came in at 11 PM.

**Amara** had been on rotation for six years at a regional financial institution. She had worked three major incidents. She knew what a compromised machine looked like before the SIEM told her.

The anomaly was a single Linux server — a payment processor — that had started generating slightly higher outbound traffic at irregular intervals. Nothing dramatic. Thirty kilobytes here, fifty there. The kind of thing that hides in baseline noise unless you're looking for it.

She SSHed in and ran `netstat -antp`. The output scrolled for twelve seconds. The server had 4,200 active TCP connections. Legitimate high-throughput financial infrastructure. Finding the needle was going to take more than scrolling.

She switched tools.

```bash
ss -antp state established '( dport != :443 and dport != :80 and dport != :8443 )'
```

Twenty-three lines. She read them in ten seconds.

One connection stood out: a Python process — not on the approved software list — connected to an IP in Eastern Europe on port `8443`. Not unusual by port. Very unusual by process. She filtered further.

```bash
ss -antp | grep python
```

One line. PID `7841`. She pivoted to `/proc/7841` and found a script with a `.pyc` extension living in `/tmp`. It had been beaconing home every 47 seconds.

From `ss` filter to confirmed compromise: four minutes.

The tool wasn't magic. But knowing how to filter, how to query, how to slice connection tables with surgical precision — that was the difference between four minutes and four hours.

---

## Workshop Overview

| Item | Detail |
|---|---|
| **Duration** | 45 minutes |
| **Level** | Intermediate (comfortable with CLI) |
| **Platform** | Linux (Ubuntu / ParrotOS) |
| **Tool** | `ss` (iproute2 suite) |
| **Goal** | Master `ss` for network triage, service auditing, and malicious connection hunting |

---

## Why `ss` Replaced `netstat` (and Why It Matters)

`netstat` reads from `/proc/net/tcp` and `/proc/net/udp` — text files that the kernel writes for backwards compatibility. It's slow, not always current, and lacks filtering.

`ss` talks directly to the kernel via **Netlink sockets** — a modern IPC mechanism for kernel-userspace communication. The result:

| Feature | `netstat` | `ss` |
|---|---|---|
| Speed on large connection tables | Slow | Fast |
| Kernel interface | `/proc/net/` (legacy) | Netlink socket (modern) |
| Built-in filtering | None — pipe to `grep` | Native filter expressions |
| Socket memory stats | No | Yes |
| TCP internal state (retransmits, RTT) | No | Yes |
| Actively maintained | No (deprecated) | Yes |
| UNIX domain sockets | Basic | Full detail |
| UDP socket state | Limited | Better |

> **Bottom line:** On a server with 10,000 connections, `netstat -antp` may take 10+ seconds. `ss -antp` returns in under a second. In incident response, that matters.

---

## Part 1 — Installation and Version Check (2 min)

`ss` ships as part of the `iproute2` package — installed by default on virtually all modern Linux distributions.

```bash
# Check if ss is available
which ss
ss --version

# If somehow missing (rare)
sudo apt install iproute2      # Debian/Ubuntu
sudo dnf install iproute       # RHEL/Fedora/Rocky
sudo pacman -S iproute2        # Arch

# Confirm version (iproute2 version determines available features)
ss -V
```

> On **ParrotOS** and **Ubuntu 22.04+**, `ss` is always present. On very minimal container images or embedded distros, you may need to install `iproute2`.

---

## Part 2 — Core Syntax and Flags (8 min)

### 2.1 — The Basic Command Structure

```
ss [options] [filter]
```

Options control *what* to show. Filters control *which connections* to show. This two-part structure is what makes `ss` powerful.

### 2.2 — Essential Flags

| Flag | Long Form | Meaning |
|---|---|---|
| `-a` | `--all` | Show all sockets (listening + established) |
| `-l` | `--listening` | Show only listening sockets |
| `-n` | `--numeric` | Do not resolve hostnames or port names |
| `-p` | `--processes` | Show process name and PID |
| `-t` | `--tcp` | TCP sockets only |
| `-u` | `--udp` | UDP sockets only |
| `-x` | `--unix` | UNIX domain sockets |
| `-4` | `--ipv4` | IPv4 only |
| `-6` | `--ipv6` | IPv6 only |
| `-s` | `--summary` | Print summary statistics |
| `-m` | `--memory` | Show socket memory usage |
| `-i` | `--info` | Show internal TCP info (RTT, retransmits, cwnd) |
| `-e` | `--extended` | Show extended socket information (uid, inode) |
| `-r` | `--resolve` | Resolve hostnames (opposite of `-n`) |

### 2.3 — Your Daily Driver Commands

```bash
# All TCP connections with PIDs (the daily driver)
sudo ss -antp

# All listening TCP ports with process names
sudo ss -tlnp

# All connections (TCP + UDP + UNIX) with PIDs
sudo ss -anp

# Summary statistics — quick health check
ss -s

# Show internal TCP details (congestion window, RTT, retransmits)
sudo ss -antp -i

# Show socket memory usage
sudo ss -antp -m
```

### 2.4 — Reading `ss` Output

```bash
$ sudo ss -antp
State    Recv-Q  Send-Q  Local Address:Port   Peer Address:Port  Process
LISTEN   0       128     0.0.0.0:22            0.0.0.0:*          users:(("sshd",pid=987,fd=3))
LISTEN   0       511     127.0.0.1:3306        0.0.0.0:*          users:(("mysqld",pid=1204,fd=24))
ESTAB    0       0       192.168.56.20:22      192.168.56.5:51234 users:(("sshd",pid=4412,fd=5))
ESTAB    0       52      192.168.56.20:54321   185.220.101.47:4444 users:(("bash",pid=7841,fd=3))
```

| Column | Meaning |
|---|---|
| `State` | Socket state (LISTEN, ESTAB, TIME-WAIT, etc.) |
| `Recv-Q` | Bytes received but not yet read by the process |
| `Send-Q` | Bytes sent but not yet acknowledged by the remote |
| `Local Address:Port` | Local endpoint |
| `Peer Address:Port` | Remote endpoint (`*` = any for listeners) |
| `Process` | Process name, PID, and file descriptor |

> **Key insight:** A high `Send-Q` value means data is being sent but not acknowledged — possible exfiltration or slow receiver. A high `Recv-Q` means data arrived but the process isn't consuming it — possible hung or overloaded application.

---

## Part 3 — Filtering: The Superpower of `ss` (12 min)

This is what sets `ss` apart. You can query the kernel directly with rich filter expressions instead of piping raw output to `grep`.

### 3.1 — Filter by State

```bash
# Only ESTABLISHED connections
ss -antp state established

# Only LISTENING sockets
ss -antp state listening

# Only TIME-WAIT (lots of these = potential SYN flood or connection churn)
ss -antp state time-wait

# Only SYN-SENT (outbound connection attempts in progress = beaconing indicator)
ss -antp state syn-sent

# Exclude a state
ss -antp exclude time-wait

# Multiple states (combine with 'or')
ss -antp '( state established or state syn-sent )'
```

**Valid state names:**
`established`, `syn-sent`, `syn-recv`, `fin-wait-1`, `fin-wait-2`, `time-wait`, `closed`, `close-wait`, `last-ack`, `listening`, `closing`, `all`, `connected`, `synchronized`, `bucket`, `big`

---

### 3.2 — Filter by Port

```bash
# Connections TO port 443 (destination port)
ss -antp 'dport = :443'

# Connections FROM port 22 (source port)
ss -antp 'sport = :22'

# Connections to ports ABOVE 1024 (user-space ports)
ss -antp 'dport > :1024'

# Connections to port 4444 (classic C2 port)
ss -antp 'dport = :4444'

# Connections NOT to common web ports (find the unusual ones)
ss -antp state established '( dport != :443 and dport != :80 and dport != :8443 )'

# Listening on high ports (suspicious bind shells often use high ports)
ss -tlnp 'sport > :1024'
```

> **Port filter syntax:** `ss` uses `:portname` or `:portnumber`. The colon is required. You can use service names (`ssh`, `http`) or numbers (`22`, `80`).

---

### 3.3 — Filter by Address

```bash
# Connections to/from a specific remote IP
ss -antp dst 185.220.101.47

# Connections to a specific remote IP AND port
ss -antp dst 185.220.101.47:4444

# Connections FROM a specific source IP
ss -antp src 192.168.56.20

# Connections to an entire subnet
ss -antp dst 10.10.10.0/24

# Local listeners on a specific interface
ss -tlnp src 192.168.56.20

# Connections NOT to your own subnet (purely external)
ss -antp state established 'dst ! 192.168.56.0/24'
```

---

### 3.4 — Combining Filters

Filters can be combined with `and`, `or`, and `not` (or `!`). Parentheses group expressions.

```bash
# ESTABLISHED connections that are NOT to common web ports and NOT to our LAN
ss -antp state established \
  '( dport != :443 and dport != :80 and dst ! 192.168.0.0/16 )'

# Connections to port 4444 OR 31337 OR 1337
ss -antp '( dport = :4444 or dport = :31337 or dport = :1337 )'

# LISTEN on all interfaces (0.0.0.0) on ports above 1024
ss -tlnp 'src 0.0.0.0 and sport > :1024'

# Anything established to a specific remote IP on any port
ss -antp state established dst 185.220.101.47

# SYN-SENT to anything outside local network (beaconing candidates)
ss -antp state syn-sent 'dst ! 192.168.0.0/16 and dst ! 10.0.0.0/8 and dst ! 172.16.0.0/12'
```

---

### 3.5 — Filter by Process

`ss` doesn't have a native "filter by process name" flag, but you combine `-p` output with `grep`:

```bash
# All connections by a specific process name
ss -antp | grep '"nginx"'
ss -antp | grep '"sshd"'
ss -antp | grep '"python"'

# All connections by PID
ss -antp | grep 'pid=7841'

# Find which process owns a specific port
ss -tlnp | grep ':8080'
```

---

## Part 4 — Advanced `ss` Capabilities (8 min)

### 4.1 — TCP Internal State (`-i`)

This goes deeper than any `netstat` equivalent. `ss -i` exposes the kernel's internal TCP state for each connection.

```bash
sudo ss -antpi state established
```

Sample output for one connection:
```
ESTAB  0  0  192.168.56.20:22  192.168.56.5:51234  users:(("sshd",pid=4412,fd=5))
	 cubic wscale:7,7 rto:204 rtt:3.5/1.75 ato:40 mss:1448 pmtu:1500 rcvmss:1448
	 rcvbuf:369280 sndbuf:87040 rcv_space:14600 rcv_ssthresh:64076
	 retrans:0/0 reordering:3 pacing_rate 1.3Mbps delivery_rate 1.3Mbps
	 delivered:7 app_limited busy:28ms lastsnd:2360 lastrcv:2360 lastack:2316
	 pacing_rate 1.3Mbps delivery_rate 1.3Mbps
```

| Field | Meaning | Suspicious If... |
|---|---|---|
| `rto` | Retransmit timeout (ms) | Very high = connectivity issue |
| `rtt` | Round-trip time (ms) | High = distant remote, possible Tor |
| `retrans` | Retransmit count | Non-zero = packet loss or instability |
| `rcvbuf` / `sndbuf` | Receive/send buffer sizes | Unusually large = tuned for bulk transfer |
| `delivery_rate` | Throughput estimate | Very high sustained = data exfil |
| `cubic` / `bbr` | Congestion algorithm | BBR on unexpected connection = tuned client |

```bash
# Find connections with retransmits (unstable or throttled)
sudo ss -antpi | grep -A1 ESTAB | grep retrans | grep -v 'retrans:0/0'

# Find connections with high RTT (> 100ms = potentially overseas)
sudo ss -antpi | grep -A1 ESTAB | grep 'rtt:[1-9][0-9][0-9]'
```

---

### 4.2 — Socket Memory (`-m`)

```bash
sudo ss -antpm
```

Output includes:
```
skmem:(r0,rb369280,t0,tb87040,f0,w0,o0,bl0,d0)
```

| Field | Meaning |
|---|---|
| `r` | Receive queue bytes |
| `rb` | Receive buffer size |
| `t` | Transmit queue bytes |
| `tb` | Transmit buffer size |
| `f` | Forward alloc bytes |
| `w` | wmem_queued bytes |
| `o` | Optional memory |
| `bl` | Socket backlog |

```bash
# Connections with large send buffers (may indicate data exfil in progress)
sudo ss -antpm | grep -E 'tb[0-9]{6,}'
```

---

### 4.3 — UNIX Domain Sockets

UNIX sockets are used by local IPC — databases, web servers, container runtimes. They can also be used for covert local communication between malicious processes.

```bash
# All UNIX domain sockets
ss -xanp

# Only UNIX sockets in CONNECTED state
ss -xanp state connected

# UNIX sockets with process info
sudo ss -xlnp

# Find unexpected UNIX socket listeners
sudo ss -xlnp | grep -v -E 'systemd|dbus|docker|containerd|snapd|NetworkManager'
```

---

### 4.4 — Summary Statistics (`-s`)

```bash
ss -s
```

Sample output:
```
Total: 432
TCP:   187 (estab 89, closed 12, orphaned 0, timewait 11)

Transport  Total  IP   IPv6
RAW        0      0    0
UDP        8      5    3
TCP        175    88   87
INET       183    93   90
FRAG       0      0    0
```

> **Blue team use:** Check this first when you suspect a SYN flood (look for massive `timewait` count) or connection exhaustion attack (total TCP count near system limit).

```bash
# Quick health check one-liner
ss -s | grep -E 'TCP:|estab|timewait'
```

---

### 4.5 — Extended Information (`-e`)

Shows UID, inode number, and socket cookie — useful for correlating sockets with system calls in audit logs.

```bash
sudo ss -antpe state established
```

```
ESTAB  0  0  192.168.56.20:54321  185.220.101.47:4444
	 users:(("bash",pid=7841,fd=3)) uid:1001 ino:98234 sk:a1b2c3 <->
```

The **inode number** (`ino:98234`) can be cross-referenced with `/proc/<PID>/fd/` to confirm the connection belongs to the process:

```bash
# Verify: does PID 7841 own inode 98234?
ls -la /proc/7841/fd/ | grep socket
# Output: lrwxrwxrwx 1 root root 64 Mar 29 02:17 3 -> socket:[98234]
# ✓ Confirmed — fd 3 of PID 7841 is inode 98234
```

---

## Part 5 — Blue Team Detection Scenarios (10 min)

### Scenario 1 — Hunt for Non-Web Outbound Connections

```bash
# All established outbound connections NOT on standard web ports
# (Great for finding C2 channels that try to blend in on 443)
sudo ss -antp state established \
  '( dport != :443 and dport != :80 and dport != :8443 and dport != :22 )'

# Narrow it to external IPs only
sudo ss -antp state established \
  '( dport != :443 and dport != :80 and dst ! 192.168.0.0/16 and dst ! 10.0.0.0/8 )'
```

---

### Scenario 2 — Detect Bind Shells (Listening on All Interfaces)

A legitimate service binds to a specific IP or `127.0.0.1`. A bind shell typically binds to `0.0.0.0` (all interfaces) on a high port.

```bash
# All listeners on 0.0.0.0 (accessible from network) — exclude common services
sudo ss -tlnp src 0.0.0.0 'sport > :1024' | \
  grep -v -E ':3306|:5432|:6379|:27017|:8080|:8443'

# Flag anything listening globally that isn't a known service
sudo ss -tlnp | grep '0.0.0.0:' | awk '{print $5, $6}' | sort -u
```

---

### Scenario 3 — Beaconing Detection with `watch`

```bash
# Watch for repeated SYN-SENT to the same remote IP
watch -n2 "sudo ss -antp state syn-sent"

# Log and deduplicate to find beacon pattern
for i in $(seq 1 30); do
  sudo ss -antp state syn-sent >> /tmp/syn_log.txt
  sleep 2
done

# Analyze: which remote IPs appear most frequently?
grep -oE '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+:[0-9]+' /tmp/syn_log.txt \
  | sort | uniq -c | sort -rn | head -20
```

---

### Scenario 4 — Find Processes With Unexpected Internet Access

```bash
# Build a list of all processes with ESTABLISHED external connections
sudo ss -antp state established \
  'dst ! 127.0.0.0/8 and dst ! 192.168.0.0/16 and dst ! 10.0.0.0/8' \
  | grep -oP '"[^"]+",pid=\d+' | sort -u

# Expected output (legitimate):
# "sshd",pid=987
# "nginx",pid=1204
# "curl",pid=3312   ← if you just ran curl

# UNEXPECTED:
# "python3",pid=7841     ← python connecting externally = investigate
# "bash",pid=4421        ← raw bash connecting externally = almost certainly malicious
# "vim",pid=2209         ← text editor connecting externally = very suspicious
```

---

### Scenario 5 — Database Exposure Check

```bash
# Check if databases are exposed to the network (should be 127.0.0.1 only)
sudo ss -tlnp | grep -E ':3306|:5432|:6379|:27017|:9200|:9042'

# RED FLAG output:
# LISTEN  0  70  0.0.0.0:3306   0.0.0.0:*   users:(("mysqld",pid=1204,fd=24))
# ↑ MySQL listening on ALL interfaces — exposed to the network

# SAFE output:
# LISTEN  0  70  127.0.0.1:3306  0.0.0.0:*  users:(("mysqld",pid=1204,fd=24))
# ↑ MySQL listening on loopback only — not accessible from network
```

---

### Scenario 6 — Count Connections Per Remote IP (DDoS / Scan Detection)

```bash
# How many connections per unique remote IP?
ss -antp state established \
  | awk '{print $5}' \
  | grep -v 'Peer' \
  | cut -d: -f1 \
  | sort | uniq -c | sort -rn | head -20

# More than 50 connections from a single IP = port scan or DDoS candidate
# Also useful to spot a compromised machine talking to one C2 IP very heavily
```

---

## Part 6 — Reference: `ss` vs `netstat` Migration Guide (5 min)

If you're used to `netstat`, here's your translation table. Muscle memory will catch up fast.

| What you want | Old `netstat` way | New `ss` way |
|---|---|---|
| All connections | `netstat -an` | `ss -an` |
| TCP + PIDs | `netstat -antp` | `ss -antp` |
| UDP + PIDs | `netstat -anup` | `ss -anup` |
| Listening only | `netstat -anlp` | `ss -tlnp` |
| Specific port | `netstat -antp \| grep :4444` | `ss -antp 'sport = :4444 or dport = :4444'` |
| Specific IP | `netstat -antp \| grep 1.2.3.4` | `ss -antp dst 1.2.3.4` |
| ESTABLISHED only | `netstat -antp \| grep ESTABLISHED` | `ss -antp state established` |
| Summary stats | `netstat -s` | `ss -s` |
| Routing table | `netstat -r` | `ip route` |
| Interface stats | `netstat -i` | `ip -s link` |
| UNIX sockets | `netstat -ax` | `ss -x` |
| TCP internals | Not available | `ss -antpi` |
| Socket memory | Not available | `ss -antpm` |

---

## Blue Team Quick Triage Playbook

Copy this to your incident response runbook.

```bash
#!/bin/bash
# ss_triage.sh — Run as root on a suspect Linux machine
# Usage: sudo bash ss_triage.sh

echo "=============================="
echo " ss TRIAGE — $(hostname) — $(date)"
echo "=============================="

echo ""
echo "[1] SUMMARY STATISTICS"
ss -s

echo ""
echo "[2] ALL LISTENING PORTS (TCP)"
ss -tlnp

echo ""
echo "[3] ESTABLISHED CONNECTIONS WITH PROCESSES"
ss -antp state established

echo ""
echo "[4] SUSPICIOUS: LISTENERS ON 0.0.0.0 ABOVE PORT 1024"
ss -tlnp src 0.0.0.0 | awk 'NR>1 {split($5,a,":"); if(a[2]+0 > 1024) print}'

echo ""
echo "[5] SUSPICIOUS: OUTBOUND NON-WEB ESTABLISHED"
ss -antp state established \
  '( dport != :443 and dport != :80 and dport != :8443 and dport != :22 and dport != :53 )'

echo ""
echo "[6] SYN-SENT (ACTIVE OUTBOUND ATTEMPTS)"
ss -antp state syn-sent

echo ""
echo "[7] CONNECTION COUNT PER REMOTE IP"
ss -antp state established \
  | awk 'NR>1 {print $5}' \
  | cut -d: -f1 \
  | sort | uniq -c | sort -rn | head -15

echo ""
echo "[8] UNIX DOMAIN SOCKETS (CONNECTED)"
ss -xanp state connected 2>/dev/null | head -30

echo ""
echo "[9] PROCESSES WITH EXTERNAL ESTABLISHED CONNECTIONS"
ss -antp state established \
  'dst ! 127.0.0.0/8 and dst ! 192.168.0.0/16 and dst ! 10.0.0.0/8' \
  | grep -oP '"[^"]+",pid=\d+' | sort -u
```

---

## Lab Exercises

### Exercise 1 — Flag Mastery (5 min)
Using only `ss`, answer the following about your Linux VM — no `grep` allowed, use native filters:
1. How many TCP sockets are in ESTABLISHED state?
2. What process is listening on port 22?
3. Is your MySQL/PostgreSQL (if installed) bound to `127.0.0.1` or `0.0.0.0`?
4. What does `ss -s` tell you about your current socket counts?

### Exercise 2 — Filter Chain Practice (10 min)
Write a single `ss` command (no pipes to `grep`) for each of the following:
1. All ESTABLISHED TCP connections to ports above 8000
2. All listeners bound to all interfaces (`0.0.0.0`) except port 22
3. All SYN-SENT connections to destinations outside `192.168.0.0/16`
4. All connections (any state) involving the IP `192.168.56.5`

### Exercise 3 — Backdoor Hunt (10 min)
Your instructor will plant one of the following on the victim VM (you won't know which):
- A `nc` listener on a random high port
- A Python HTTP server on a random port
- A process making repeated outbound connections

Using only `ss` with filters (no `grep`), find:
1. The port or remote IP involved
2. The process name and PID
3. Whether it's inbound (LISTEN) or outbound (ESTAB/SYN-SENT)

Document your exact `ss` command chain.

### Exercise 4 — TCP Internals Analysis (10 min)
1. Establish an SSH connection to a remote machine (your second VM)
2. Run `sudo ss -antpi state established` and capture the output for that connection
3. Identify: RTT, congestion algorithm, retransmit count, delivery rate
4. Now run `sudo ss -antpm` — what are the send and receive buffer sizes?
5. **Bonus:** Open a second SSH session. Does the RTT change? Why or why not?

### Exercise 5 — Write the Triage Script (10 min)
Modify `ss_triage.sh` from the playbook section to:
1. Accept an optional command-line argument: a subnet to exclude from "external" checks (e.g., `./ss_triage.sh 172.16.0.0/12`)
2. Add a section that prints processes holding connections with `Send-Q > 0` (data queued for sending)
3. Save output to `/tmp/triage_<hostname>_<datetime>.txt` automatically
4. **Bonus:** Add a section that compares the current listener list against a saved baseline file (passed as second argument) and prints new listeners not in the baseline

---

## Recommended Reading & Resources

- `man ss` — the full flag and filter reference (the filter grammar section is essential)
- [iproute2 Source and Documentation](https://wiki.linuxfoundation.org/networking/iproute2) — upstream project
- [ss(8) Man Page — kernel.org](https://man7.org/linux/man-pages/man8/ss.8.html) — authoritative online version
- *Linux Networking Cookbook* — Carla Schroder — practical iproute2 and socket tools
- *The Practice of Network Security Monitoring* — Richard Bejtlich — how socket visibility fits into a detection program
- SANS FOR572 — Network Forensics — uses `ss` and socket analysis extensively
- DEFCON Blue Team Village — annual talks on host-based detection with built-in tools

---

## Final Thought

Amara had the attacker's beacon identified before most analysts would have finished scrolling through `netstat` output.

The tool wasn't smarter. She was.

`ss` gives you something `netstat` never could: the ability to *ask the kernel a question* and get only the answer you need. Not 4,200 lines. Twenty-three. The signal, not the noise.

In security, the difference between a four-minute find and a four-hour investigation is almost never processing power or tooling budget. It's knowing which question to ask, and knowing the command that asks it precisely.

That's the skill. Learn it until the filters are reflex, until you reach for `ss -antp state syn-sent` the same way a surgeon reaches for a scalpel — without thinking, in the dark, under pressure.

The socket table is always telling you something. Learn to listen.

**DEFCON vibes. Gray hat. Purple team. Know your sockets.**

---
