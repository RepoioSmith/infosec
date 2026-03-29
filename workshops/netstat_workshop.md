# Operation DARK SOCKET — Netstat: Hunt Malicious Connections Like a Blue Teamer
## A Zero-to-Hero Workshop (45 minutes)

> *"You can't defend what you can't see. And you can't see what you don't know how to read."*
>
> — **Farrukh "Ferret" Tashkentov**, Incident Responder, Tashkent, 2019

---

## Tashkent, Uzbekistan — January 2019

It was 2:17 AM in the NOC when **Ferret's** screen lit up.

Not a SIEM alert — the SIEM was fine. The EDR was quiet. The firewall hadn't sneezed. But something was wrong with a Windows server in the finance subnet. Ferret knew it the way experienced SOC analysts always know it: the machine was slightly *slow*. Not crashing. Not throwing errors. Just a few extra milliseconds on RDP. The kind of thing you feel before you can prove.

He opened a command prompt on the machine, no fancy tools, no agent console. Just what Windows ships with.

```
netstat -anob
```

Three thousand lines of output. He paged through it for ninety seconds. Then he stopped.

Port `4444`. Outbound. `ESTABLISHED`. Process: `svchost.exe`. Remote IP: `185.220.101.x` — a Tor exit node he recognized from a threat intel feed he'd bookmarked six months ago.

*Not today.*

He had the process ID. He had the connection. He had the remote IP. In the next four minutes, before he touched anything else, he mapped every connection that process had made that week using Windows event logs. Then he killed it, isolated the machine, and called his team.

The attacker had been in the network for eleven days. Ferret found them with a built-in command that ships on every Windows machine since XP.

That command was `netstat`.

---

## Workshop Overview

| Item | Detail |
|---|---|
| **Duration** | 45 minutes |
| **Level** | Intermediate (comfortable with CLI) |
| **Platforms** | Linux (Ubuntu/ParrotOS) + Windows |
| **Tools** | `netstat`, `ss`, `lsof`, `ps`, `tasklist` |
| **Goal** | Use Netstat to identify, investigate, and triage malicious connections from a Blue Team perspective |

---

## Lab Environment

You need at minimum **one machine per OS** for cross-platform exercises:

```
[Blue Team Analyst]   192.168.56.5    (ParrotOS / Ubuntu)
[Windows Target]      192.168.56.10   (Windows 10/11 or Server)
[Linux Target]        192.168.56.20   (Ubuntu Server)
```

> All exercises use **read-only commands** — no exploitation. This is pure detection and analysis work.

---

## Part 1 — What is Netstat and Why Does It Still Matter? (5 min)

`netstat` — short for **network statistics** — is a command-line tool that displays:

- Active network connections (TCP/UDP)
- Listening ports (services waiting for connections)
- Routing tables
- Interface statistics

It is installed by default on **every** major OS. No download, no agent, no configuration. When you land on a compromised machine — or inherit a machine you didn't set up — `netstat` is often the first visibility tool you reach for.

> **Why not just use a fancy EDR?** Because attackers know how to blind EDR agents. They don't know if *you* know how to read `netstat` output. Living-off-the-land detection (using built-in tools) is a core blue team skill that complements your tooling — and the only option when your tooling is absent or compromised.

### The Deprecation Notice (and Why You Should Care)

On modern Linux distros, `netstat` ships via the `net-tools` package and has been **deprecated** in favor of `ss` (socket statistics from the `iproute2` suite). However:

- `netstat` is still available and still widely used in scripts, documentation, and real-world environments
- Windows `netstat` is **not deprecated** and remains the primary built-in network diagnostic tool
- You will encounter both in the field — know both

```bash
# Linux: check if netstat is installed
which netstat
netstat --version

# If not installed (Ubuntu/Debian)
sudo apt install net-tools

# The modern replacement
which ss
ss --version
```

---

## Part 2 — Linux vs Windows: Command Syntax and Key Differences (10 min)

This is the part most guides skip. The same concept — "show me connections" — uses different flags and produces different output depending on the OS. Knowing both cold is a superpower in incident response.

### 2.1 — Core Flag Comparison

| Goal | Linux `netstat` | Linux `ss` | Windows `netstat` |
|---|---|---|---|
| All connections | `netstat -an` | `ss -an` | `netstat -an` |
| TCP only | `netstat -ant` | `ss -ant` | `netstat -anp tcp` |
| UDP only | `netstat -anu` | `ss -anu` | `netstat -anp udp` |
| Show PIDs | `netstat -anp` | `ss -anp` | `netstat -ano` |
| Show process names | `netstat -anp` | `ss -anp` | `netstat -anob` |
| Listening ports only | `netstat -anlt` | `ss -tlnp` | `netstat -an \| findstr LISTENING` |
| Numeric (no DNS) | `-n` | `-n` | `-n` (default) |
| Routing table | `netstat -r` | `ip route` | `netstat -r` or `route print` |

> **Critical difference:** On Linux, `-p` shows the PID/program. On Windows, `-o` shows the PID and `-b` shows the binary name. The flag letters are **not the same**.

---

### 2.2 — Linux Netstat in Practice

```bash
# The most useful all-in-one command for a quick triage
netstat -antp

# Breakdown:
# -a  show all (listening + established)
# -n  numeric — don't resolve hostnames (faster, avoids DNS lookups that tip off attackers)
# -t  TCP only
# -p  show PID and process name (requires root for processes you don't own)

# With sudo to see all processes
sudo netstat -antp

# Sample output:
# Proto  Recv-Q  Send-Q  Local Address     Foreign Address    State       PID/Program
# tcp         0       0  0.0.0.0:22        0.0.0.0:*          LISTEN      1042/sshd
# tcp         0       0  127.0.0.1:3306    0.0.0.0:*          LISTEN      2301/mysqld
# tcp         0     208  192.168.56.20:22  192.168.56.5:51234 ESTABLISHED 3412/sshd: ferret
```

**UDP connections:**
```bash
sudo netstat -anup
```

**Combined TCP + UDP:**
```bash
sudo netstat -anp
```

**Only listening ports (services you're exposing):**
```bash
sudo netstat -anlp
# or with ss (preferred on modern Linux):
sudo ss -tlnp
```

---

### 2.3 — The Modern Linux Alternative: `ss`

`ss` is faster, more detailed, and the official successor to `netstat` on Linux. Learn both.

```bash
# All TCP connections with PIDs
sudo ss -antp

# Listening ports only (TCP)
sudo ss -tlnp

# Filter by port
sudo ss -antp sport = :443
sudo ss -antp dport = :4444

# Filter by state
sudo ss -antp state established

# Show socket memory (useful for detecting DoS conditions)
sudo ss -m

# Summary statistics
ss -s
```

> **Field tip:** In a live incident, `ss` is preferred for large connection tables — it's significantly faster than `netstat` on machines with thousands of connections.

---

### 2.4 — Windows Netstat in Practice

```powershell
# The Blue Teamer's first command on a suspect Windows machine
netstat -anob

# Breakdown:
# -a  all connections and listening ports
# -n  numeric (no DNS resolution)
# -o  show owning PID
# -b  show binary name (requires elevated prompt)

# Sample output:
#   TCP    0.0.0.0:445            0.0.0.0:0              LISTENING       4
#  [System]
#
#   TCP    192.168.56.10:50341    185.220.101.47:4444    ESTABLISHED     3912
#  [svchost.exe]
```

> **Important:** `-b` requires an **Administrator** command prompt. Without it, you get PIDs but not binary names.

**TCP only:**
```powershell
netstat -anp tcp
```

**UDP only:**
```powershell
netstat -anp udp
```

**Listening ports only:**
```powershell
netstat -an | findstr LISTENING
```

**Map PID to full process details:**
```powershell
# Get PID from netstat, then:
tasklist /fi "pid eq 3912"
# Or with more detail:
Get-Process -Id 3912 | Select-Object Name, Path, StartTime, CPU
```

**Continuous refresh (like watch on Linux):**
```powershell
# Refresh every 2 seconds
netstat -ano 2

# Or PowerShell loop
while ($true) { netstat -ano; Start-Sleep 2; Clear-Host }
```

---

### 2.5 — Platform Differences Cheat Sheet

| Behavior | Linux | Windows |
|---|---|---|
| Show PID flag | `-p` | `-o` |
| Show binary name | `-p` (includes it) | `-b` (separate flag) |
| Requires root/admin for full output | Yes (`-p` needs root) | Yes (`-b` needs Admin) |
| DNS resolution by default | No with `-n` | No with `-n` |
| Deprecated? | Yes — use `ss` | No |
| Filter by state | `ss state established` | `findstr ESTABLISHED` |
| Refresh/watch mode | `watch -n1 netstat` | `netstat -ano 2` |
| Routing table | `netstat -r` or `ip route` | `netstat -r` or `route print` |
| IPv6 support | Yes | Yes |

---

## Part 3 — Reading Output: Normal vs Suspicious (10 min)

This is the core of blue team netstat work. Most connections are normal. You need to develop the instinct for what is *not*.

### 3.1 — Understanding Connection States

| State | Meaning | Suspicious If... |
|---|---|---|
| `LISTEN` | Port is open, waiting for connections | Unexpected port or process |
| `ESTABLISHED` | Active two-way connection | Connects to unknown external IP |
| `TIME_WAIT` | Connection closed, OS cleaning up | High count may indicate scan |
| `CLOSE_WAIT` | Remote closed, local hasn't yet | Large count = possible resource leak or hung process |
| `SYN_SENT` | Connection attempt in progress | Many of these = beaconing malware |
| `SYN_RECV` | Inbound SYN received, waiting for ACK | Many of these = you're being scanned |
| `FIN_WAIT` | Connection teardown in progress | Usually fine |

---

### 3.2 — Indicators of Malicious Connections

When reviewing `netstat` output, look for these patterns:

**1. Unexpected listening ports**
```bash
# What processes are listening that shouldn't be?
sudo ss -tlnp
# or
sudo netstat -anlp | grep LISTEN
```

Red flags:
- Port `4444`, `1234`, `31337`, `8080`, `9999` — common C2/backdoor ports
- Port `443` or `80` opened by a process that is NOT your web server
- High-numbered ephemeral ports (`>49152`) in LISTEN state from strange processes

**2. Outbound connections to unusual IPs**
```bash
# Show only ESTABLISHED outbound connections with process names (Linux)
sudo netstat -antp | grep ESTABLISHED

# Windows
netstat -anob | findstr ESTABLISHED
```

Red flags:
- Connection from `svchost.exe` or `explorer.exe` to a public IP
- Connection to known Tor exit nodes (maintain a blocklist)
- Connection on an unusual port (malware often uses 4444, 443 to blend with HTTPS, 53 to blend with DNS)
- A process connecting to the internet that has no business doing so (e.g., calculator, notepad, Word)

**3. Beaconing pattern (repeated SYN_SENT)**
```bash
# Watch for repeated connection attempts — beaconing C2
watch -n1 "sudo netstat -antp | grep SYN_SENT"
```

Malware often beacons home every N seconds/minutes. If you see the same remote IP appearing and disappearing in `SYN_SENT`, that is a strong indicator.

**4. Unexpected local bind addresses**
```bash
# Something listening on 0.0.0.0 that should only be on 127.0.0.1
sudo netstat -anlp | grep "0.0.0.0"
```

A service binding to `0.0.0.0` is accessible from the network. A service binding to `127.0.0.1` is local only. If MySQL (`3306`) or Redis (`6379`) is bound to `0.0.0.0` — that is a misconfiguration or a backdoor.

---

### 3.3 — Cross-Reference PID with Process Details

Finding a suspicious connection is step 1. Pivoting from that connection to the full process context is step 2.

**Linux — full pivot chain:**
```bash
# Step 1: Find the suspicious connection and PID
sudo netstat -antp | grep ESTABLISHED
# Output: tcp 0 0 192.168.56.20:54321 185.220.101.47:4444 ESTABLISHED 4412/bash

# Step 2: Examine the process
ps aux | grep 4412
ls -la /proc/4412/exe          # what binary is this really?
cat /proc/4412/cmdline | tr '\0' ' '  # full command line including args
ls -la /proc/4412/fd           # what files does it have open?

# Step 3: Check parent process
ps -o ppid= -p 4412            # who spawned this?
ps aux | grep <ppid>           # examine the parent

# Step 4: Network map of this process only
sudo lsof -p 4412 -i           # all network connections by this PID
sudo lsof -p 4412              # all open files + network by this PID
```

**Windows — full pivot chain:**
```powershell
# Step 1: Find the PID from netstat
netstat -anob
# Note the PID — say it's 3912

# Step 2: Process details
tasklist /fi "pid eq 3912" /v
Get-Process -Id 3912 | Select-Object *

# Step 3: Full path of the binary
(Get-Process -Id 3912).MainModule.FileName

# Step 4: Parent process
$proc = Get-WmiObject Win32_Process -Filter "ProcessId = 3912"
$proc.ParentProcessId
Get-Process -Id $proc.ParentProcessId

# Step 5: All network connections for this PID
netstat -ano | findstr "3912"

# Step 6: DLL check (what libraries is it using?)
$proc.GetModules() | Select-Object FileName
```

---

## Part 4 — Hands-On Detection Scenarios (15 min)

These scenarios simulate what you will encounter during a real incident. Work through each one.

---

### Scenario 1 — Backdoor Listener Detection

A machine in your network is behaving strangely. You suspect a bind shell is running.

**On the Linux "victim" machine (lab setup only):**
```bash
# Plant a test listener (safe, no shell attached)
nc -lvnp 31337 &
```

**Blue team — detect it:**
```bash
# Method 1: netstat
sudo netstat -anlp | grep LISTEN

# Method 2: ss (faster)
sudo ss -tlnp

# Method 3: lsof (best for associating with file)
sudo lsof -i :31337

# What to look for in output:
# nc    4521  ferret   3u  IPv4  98234  TCP *:31337 (LISTEN)
# ↑                   PID is 4521, process is nc, listening on ALL interfaces
```

**Questions to answer:**
1. What is the PID of the listener?
2. What user is running it?
3. Is it listening on all interfaces (`0.0.0.0`) or just loopback (`127.0.0.1`)?
4. Kill the process — confirm it disappears from `ss` output.

```bash
# Clean up
kill $(sudo lsof -t -i :31337)
```

---

### Scenario 2 — Established C2 Connection (Linux)

A workstation is connecting outbound to an unusual IP on port 4444.

**Lab setup — simulate the connection:**
```bash
# On attacker VM: listener
nc -lvnp 4444

# On victim VM: outbound connection (open a second terminal)
nc 192.168.56.5 4444 &
```

**Blue team — investigate:**
```bash
# Find the connection
sudo netstat -antp | grep 4444

# Cross-reference to process
# Output will show PID — use it:
sudo lsof -p <PID> -i

# Check what binary this really is
ls -la /proc/<PID>/exe

# Check command line
cat /proc/<PID>/cmdline | tr '\0' ' '

# Check parent (was this spawned by something unexpected?)
ps -o ppid= -p <PID>
```

**Questions to answer:**
1. What process is making the connection?
2. What is the full path of the binary?
3. What spawned it (parent PID)?
4. Is there anything in `/proc/<PID>/fd` that looks like a shell being piped?

---

### Scenario 3 — Suspicious svchost on Windows

On Windows, `svchost.exe` is a legitimate system process that hosts Windows services. It is also heavily abused by malware for process injection and port-hiding.

**Detection:**
```powershell
# Step 1: Get all svchost connections
netstat -anob | findstr svchost

# Step 2: Any svchost connecting OUTBOUND to non-Microsoft IPs?
# Legitimate svchost connects to Windows Update, telemetry, etc.
# A svchost connecting to 185.x.x.x on port 4444 is NOT legitimate.

# Step 3: For every suspicious svchost PID, check which service it hosts
tasklist /svc /fi "imagename eq svchost.exe"
# Compare the PID from netstat against this list

# Step 4: A svchost with NO associated service name is injected/malicious
# Legitimate: "svchost.exe   1234   Dnscache, LanmanWorkstation"
# Suspicious:  "svchost.exe   3912   N/A"

# Step 5: Dig into the suspicious one
Get-Process -Id 3912 | Select-Object Name, Path, StartTime, CPU, WorkingSet
```

**Red flags:**
- `svchost.exe` running from `C:\Users\...` or `C:\Temp\` instead of `C:\Windows\System32\`
- `svchost.exe` with no services listed in `tasklist /svc`
- `svchost.exe` establishing connections to public IPs on non-standard ports

---

### Scenario 4 — Beaconing Detection

Malware checks in with its C2 server at regular intervals. This creates a pattern visible in `netstat` if you watch over time.

**Linux — watch for repeated SYN_SENT to the same IP:**
```bash
# Simulate beaconing (runs nc every 30 seconds, fails connection = SYN_SENT briefly visible)
# Lab only — do not run against real IPs
while true; do nc -w2 10.10.10.99 4444 2>/dev/null; sleep 30; done &

# Blue team: watch connection table for recurring pattern
watch -n2 "sudo netstat -antp | grep -E 'SYN_SENT|ESTABLISHED'"

# Or log it:
for i in $(seq 1 20); do
  sudo netstat -antp | grep SYN_SENT >> /tmp/beacon_log.txt
  sleep 5
done
cat /tmp/beacon_log.txt | sort | uniq -c | sort -rn
```

**If the same remote IP keeps appearing in SYN_SENT at regular intervals — you found a beacon.**

**Windows equivalent:**
```powershell
# Log netstat output every 5 seconds for 2 minutes
$logfile = "C:\Temp\netstat_log.txt"
1..24 | ForEach-Object {
    $timestamp = Get-Date -Format "HH:mm:ss"
    "$timestamp`n$(netstat -ano)" | Add-Content $logfile
    Start-Sleep 5
}
# Then review for repeated remote IPs in SYN_SENT
Select-String "SYN_SENT" $logfile | Group-Object -Property Line | Sort-Object Count -Descending
```

---

### Scenario 5 — Port Inventory Audit (Blue Team Baseline)

Before you can spot what is *wrong*, you need to know what is *normal*. This scenario builds a baseline.

**Linux:**
```bash
# Save a baseline of all listening ports + processes
sudo ss -tlnp > /tmp/baseline_$(hostname)_$(date +%Y%m%d).txt

# Or with netstat
sudo netstat -anlp | grep LISTEN > /tmp/baseline_$(hostname)_$(date +%Y%m%d).txt

# Compare two baselines (find new listeners since last snapshot)
diff /tmp/baseline_server1_20260320.txt /tmp/baseline_server1_20260329.txt
```

**Windows:**
```powershell
# Save baseline
netstat -anob | Out-File "C:\Temp\baseline_$(hostname)_$(Get-Date -Format 'yyyyMMdd').txt"

# Compare (PowerShell diff)
$old = Get-Content "C:\Temp\baseline_20260320.txt"
$new = Get-Content "C:\Temp\baseline_20260329.txt"
Compare-Object $old $new | Where-Object { $_.SideIndicator -eq "=>" }
# Lines with "=>" only appear in the NEW file — new connections/listeners
```

---

## Part 5 — Blue Team Playbook and Detection One-Liners (5 min)

When you land on a suspect machine, run these in order. Work fast — attackers may be watching.

### Linux Quick Triage

```bash
# 1. All established outbound connections with PIDs (most important first)
sudo netstat -antp | grep ESTABLISHED

# 2. All listeners — what is this machine exposing?
sudo ss -tlnp

# 3. Any connection to/from high-risk port ranges
sudo netstat -antp | grep -E ':4444|:1337|:31337|:8888|:9999|:12345'

# 4. Pivot: for each suspicious PID, dump everything
PID=1234
echo "=== Process ===" && ps aux | grep $PID
echo "=== Binary ===" && ls -la /proc/$PID/exe
echo "=== Cmdline ===" && cat /proc/$PID/cmdline | tr '\0' ' '
echo "=== Parent ===" && ps aux | grep $(ps -o ppid= -p $PID | tr -d ' ')
echo "=== Open files ===" && lsof -p $PID

# 5. Are there processes with no associated binary (deleted malware)?
sudo ls -la /proc/*/exe 2>/dev/null | grep '(deleted)'
```

### Windows Quick Triage

```powershell
# 1. All established connections with binary names (run as Admin)
netstat -anob | findstr ESTABLISHED

# 2. All listeners
netstat -an | findstr LISTENING

# 3. Flag connections on unusual ports
netstat -ano | findstr -E ":4444 |:1337 |:31337 |:8888 "

# 4. For each suspicious PID, full context
function Get-ConnectionProcess($PID) {
    Write-Host "=== Process ===" -ForegroundColor Yellow
    Get-Process -Id $PID | Select-Object Name, Path, StartTime, CPU, WorkingSet
    Write-Host "=== Parent ===" -ForegroundColor Yellow
    $parent = (Get-WmiObject Win32_Process -Filter "ProcessId=$PID").ParentProcessId
    Get-Process -Id $parent | Select-Object Name, Path
    Write-Host "=== All connections for this PID ===" -ForegroundColor Yellow
    netstat -ano | findstr $PID
}
Get-ConnectionProcess 3912

# 5. Svchost without services = injection candidate
$svc = Get-WmiObject Win32_Service | Select-Object ProcessId, Name
$svchosts = Get-Process svchost | Select-Object Id
$svchosts | ForEach-Object {
    $pid = $_.Id
    $services = ($svc | Where-Object { $_.ProcessId -eq $pid }).Name -join ", "
    if (-not $services) { Write-Host "SUSPICIOUS svchost PID: $pid (no services)" -ForegroundColor Red }
}
```

---

## Detection and Defense Summary

| Indicator | Netstat Command | What to Look For |
|---|---|---|
| Backdoor listener | `ss -tlnp` / `netstat -anob` | Unexpected LISTEN on high-numbered port |
| C2 connection | `netstat -antp \| grep ESTABLISHED` | Known-bad IP, unusual port, unexpected process |
| Process injection | `netstat -anob` (Windows) | `svchost.exe` with no service, unusual path |
| Beaconing | `watch` + `netstat` over time | Same remote IP recurring in SYN_SENT |
| Data exfiltration | `netstat -antp` | Large `Send-Q` values, persistent outbound to unknown IP |
| Port misconfig | `ss -tlnp` | DB/cache bound to `0.0.0.0` instead of `127.0.0.1` |
| Deleted malware running | `ls /proc/*/exe \| grep deleted` | Process with no backing file on disk |

---

## Lab Exercises

### Exercise 1 — Cross-Platform Baseline (5 min)
On both your Linux and Windows VMs, capture a full port inventory with process names. Save each to a file. Identify at least 3 differences in the tools and output format between the two platforms.

### Exercise 2 — Backdoor Hunt (10 min)
Your instructor will start a hidden `nc` listener on a port between 1024–65535 on the Linux VM. Using only `ss`/`netstat` and `lsof`, find:
- The port number
- The PID
- The username running it
- Whether it accepts connections from all interfaces or only loopback

### Exercise 3 — Windows Svchost Audit (10 min)
On your Windows VM, run the svchost audit one-liner. Identify which `svchost.exe` instances are hosting which services. Document any PID that appears in `netstat -anob` making an outbound connection. Is the connection expected given the service it hosts?

### Exercise 4 — Beaconing Simulation (10 min)
1. On Linux: run the beaconing simulation loop (Scenario 4)
2. Use `watch` to observe the connection table for 2 minutes
3. Export your log and identify the beacon interval from the timestamps
4. **Bonus:** Write a one-liner that alerts you (prints a warning) every time a new SYN_SENT to a specific IP appears

### Exercise 5 — Incident Triage Drill (10 min)
Your instructor will introduce one of the following on the victim VM (you won't know which):
- A bind shell listener
- An established outbound connection on an unusual port
- A misbound database service

Using only built-in tools (`netstat`, `ss`, `lsof`, `ps`, `tasklist`), produce a written triage report that includes: the suspicious indicator, the PID, the process name and path, the parent process, and your recommended response action.

---

## Recommended Reading & Resources

- `man netstat`, `man ss`, `man lsof` — always your first stop
- [ss(8) Man Page](https://man7.org/linux/man-pages/man8/ss.8.html) — the full `ss` reference
- [Microsoft Netstat Docs](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/netstat) — Windows-specific flags and behavior
- *The Practice of Network Security Monitoring* — Richard Bejtlich — the definitive blue team fieldbook
- *Blue Team Handbook* — Don Murdoch — incident response patterns including netstat-based triage
- SANS Blue Team Wiki — network forensics cheat sheets
- DEFCON Blue Team Village talks — search media.defcon.org

---

## Final Thought

Ferret wrapped the incident report at 6 AM. He'd contained the compromise, preserved evidence, and handed off a full timeline to forensics — all before the finance team arrived for their morning shift. They never knew.

He didn't use an expensive tool. He didn't need a zero-day or a SIEM dashboard. He used `netstat`, twenty years of Windows knowledge, and the patience to read three thousand lines of output at 2 AM until one line didn't belong.

That is the blue team mindset. Not flashier tooling — sharper eyes.

When an attacker gets in, they bring their tools. You already have yours — you just have to know how to use them.

**DEFCON vibes. Gray hat. Purple team. Know your sockets.**

---
