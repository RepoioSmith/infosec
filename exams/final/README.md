# Operation GHOST SIGNAL — Final Exam
## Cybersecurity | Year 3000 Edition

---

## Overview

This is your final exam. It is a **take-home, team-based, hands-on penetration test** against a simulated corporate network. There are no multiple choice questions. There are no essays. You will break into things — legally, ethically, and skillfully — and document everything you find.

The scenario, the network, and the challenge are described in [`FINAL_EXAM_STUDENT.md`](FINAL_EXAM_STUDENT.md). Read it carefully before you start.

---

## Logistics

| Item              | Details |
|-------------------|---------|
| **Format**        | Take-home practical exam |
| **Duration**      | 10 days from date of delivery |
| **Team size**     | 2 students per team |
| **Submission**    | One report per team via BrightSpace |
| **Report format** | Markdown (`.md`) |
| **Filename**      | `LASTNAME1_LASTNAME2_ghostsignal.md` |

> Teams are assigned by the instructor. You may not work alone or in groups larger than two.

---

## Getting Started

### Step 1 — Install prerequisites

You need the following on your machine before anything else:

- [VirtualBox 6.1+](https://www.virtualbox.org/wiki/Downloads)
- [Vagrant 2.3+](https://developer.hashicorp.com/vagrant/downloads)

Verify your install:

```bash
vagrant --version
vboxmanage --version
```

### Step 2 — Get the exam key

Your instructor will release the **exam key file** (`.exam_key`) via BrightSpace at the start of the exam window. Place it here:

```
exams/final/provision/.exam_key
```

Without this file, `vagrant up` will fail. This is intentional.

### Step 3 — Boot the network

```bash
cd exams/final/
vagrant up
```

First run downloads the Alpine Linux box (~150 MB) and provisions all 7 VMs. Allow **10–15 minutes**. Subsequent boots are much faster.

### Step 4 — Log into your attack terminal

```bash
vagrant ssh attacker
cat ~/ghost-ops/notes/mission_brief.txt
```

You are now inside the NQS perimeter. Your mission begins.

---

## Useful Vagrant Commands

| Command | What it does |
|---|---|
| `vagrant up` | Boot all VMs |
| `vagrant up web01` | Boot a specific VM |
| `vagrant ssh attacker` | SSH into attacker VM |
| `vagrant halt` | Gracefully shut down all VMs |
| `vagrant destroy -f` | Wipe everything and start clean |
| `vagrant provision web01` | Re-run provisioning on a single VM |
| `vagrant status` | Show state of all VMs |

> If a VM gets into a bad state during the exam, `vagrant destroy <name> && vagrant up <name>` resets it cleanly. No progress is lost on other VMs.

---

## Attack VM — Available Tools

Your attack terminal (`ghost-terminal`, IP `10.10.10.5`) comes pre-loaded with the following tools. You are **not** required to use all of them — choosing the right tool for each task is part of the exam.

| Tool | Category | What it does |
|---|---|---|
| `nmap` | Reconnaissance | Network discovery, port scanning, service/version detection |
| `curl` | Web | HTTP requests, manual web app interaction |
| `wget` | Web | File download over HTTP/FTP |
| `nikto` | Web | Web server vulnerability scanner |
| `sqlmap` | Web | Automated SQL injection detection and exploitation |
| `hydra` | Credential Attack | Online password brute-forcing (SSH, FTP, HTTP, etc.) |
| `john` | Credential Attack | Offline password hash cracking |
| `ftp` / `lftp` | File Transfer | FTP client (`lftp` supports scripting and directory listing) |
| `nc` (netcat) | Networking | TCP/UDP connections, port scanning, bind/reverse shells |
| `openssl` | Crypto / TLS | Certificate inspection, manual TLS connections, encoding |
| `ssh` | Remote Access | SSH client, port forwarding, SOCKS proxy (`-D`) |
| `mysql` | Database | MariaDB/MySQL command-line client |
| `tcpdump` | Traffic Analysis | Packet capture and analysis |
| `dig` / `nslookup` | DNS | DNS enumeration and queries |
| `python3` | Scripting | Custom scripts, one-liners, quick HTTP servers |
| `perl` | Scripting | Quick text processing and network scripts |
| `vim` | Editor | Edit files, write exploit scripts |
| `tmux` | Terminal | Multiple panes/windows in one SSH session (highly recommended) |
| `screen` | Terminal | Alternative terminal multiplexer |
| `git` | Misc | Clone external tools or scripts if needed |

> **Pro tip:** Start `tmux` the moment you log in. Split your terminal into panes — one for scanning, one for exploitation, one for notes. You will thank yourself later.

---

## Workspace Layout

Your home directory inside the attacker VM is pre-organized:

```
~/ghost-ops/
├── recon/      ← Save nmap output, service lists, host notes
├── loot/       ← Captured flags, credentials, interesting files
├── exploits/   ← Any custom scripts or payloads you write
└── notes/      ← Running notes, hypotheses, dead ends
```

Keep it organized. Your report will be much easier to write if your notes are clean throughout the 10 days.

---

## Report Requirements

Submit a single Markdown file named `LASTNAME1_LASTNAME2_ghostsignal.md`. It must contain the following sections:

### 1. Network Topology
A diagram or structured description of every host you discovered, with IPs, open ports, and services. Build this entirely from your own reconnaissance.

### 2. Flag Submissions
For each of the 6 flags, a dedicated section following this template:

```markdown
## Flag N — <Host Name>

**Flag value:** FLAG{...}
**Host:** <IP>
**Vulnerability:** <Name of the vulnerability>

### Steps to Reproduce
1. ...
2. ...

### Commands Used
​```bash
# exact commands, in order
​```

**What made this vulnerable:** <1–2 sentence explanation>
```

### 3. Pivot Methodology
Explain how you moved from the DMZ into the internal network. Include the technique used (SSH tunnel, SOCKS proxy, etc.) and the exact commands.

### 4. Team Contributions
A short section describing who did what. Both team members are expected to contribute to all phases.

### 5. Lessons Learned
What surprised you? What would you fix if you were the defender?

---

## Grading

| Component | Points |
|---|---|
| Flag 1 — DMZ File Server | 10 |
| Flag 2 — DMZ Web Portal | 20 |
| Flag 3 — Perimeter Gateway | 15 |
| Flag 4 — Internal Web Server | 15 |
| Flag 5 — Internal Database | 20 |
| Flag 6 — Operator Workstation | 20 |
| **Total** | **100** |
| Network topology diagram | +Bonus |

Points per flag are split: **flag value (60%) + methodology (40%)**. A correct flag with no explanation earns partial credit. A well-documented failed attempt also earns partial credit — show your work.

---

## Pre-Exam Review Guide

Use the days before you start to review weak spots. Below is a checklist of every skill and tool this exam exercises directly.

### Network Reconnaissance
- [ ] `nmap` scan types: `-sV`, `-sC`, `-p-`, `-T4`, output flags (`-oN`, `-oG`)
- [ ] Reading nmap output: open/filtered/closed, service names, version strings
- [ ] Host discovery with ping sweep: `nmap -sn 10.10.10.0/24`

### FTP
- [ ] What anonymous FTP is and why it is a misconfiguration
- [ ] Connecting: `ftp <ip>`, `lftp <ip>`
- [ ] Navigation and download: `ls`, `cd`, `get`, `mget`, `prompt off`
- [ ] Recognizing sensitive files: `.bak`, `.log`, `.conf`, anything with "admin" or "backup" in the name

### Web Application Security
- [ ] How HTTP GET parameters work and how to manipulate them with `curl`
- [ ] What `robots.txt` reveals and why attackers always check it
- [ ] **SQL Injection** — this is the most important topic on this exam:
  - What causes it (unsanitized string interpolation into SQL)
  - Authentication bypass: `' OR 1=1-- -`
  - UNION-based extraction: how to find column count, identify reflected columns
  - Dumping tables via `information_schema`
  - Running `sqlmap` with `--dbs`, `--tables`, `--dump`, `-T`, `--batch`
- [ ] **OS Command Injection** — second most important:
  - How CGI scripts can pass user input to shell commands
  - Injection separators: `;`, `|`, `&&`, `` `cmd` ``
  - Testing: `; id`, `; whoami`, `; cat /etc/passwd`
  - URL encoding for special characters in GET params

### SSH & Credentials
- [ ] SSH client flags: `-p` (port), `-L` (local forward), `-D` (SOCKS proxy), `-N` (no shell)
- [ ] `hydra` for brute-forcing SSH: `hydra -l user -P wordlist.txt ssh://<ip>`
- [ ] Credential reuse: one leaked password often opens multiple doors
- [ ] How to spot credentials in backup files, logs, and config files

### Network Pivoting
- [ ] What pivoting is and when you need it
- [ ] SSH local port forward: `ssh -L <localport>:<internaltarget>:<remoteport> user@gateway`
- [ ] SSH dynamic SOCKS proxy: `ssh -D 1080 -f -N user@gateway`
- [ ] Configuring `proxychains` to route tools through a SOCKS proxy
- [ ] Scanning a network segment you cannot reach directly

### Database Enumeration
- [ ] `mysql -h <ip> -u <user> -p` — remote connection
- [ ] `SHOW DATABASES;` `SHOW TABLES;` `SELECT * FROM <table>;` `DESCRIBE <table>;`
- [ ] What a dangerous DB misconfiguration looks like: remote root, no password, bound to `0.0.0.0`

### Linux Privilege Escalation
- [ ] `sudo -l` — always run this first on a new shell
- [ ] GTFOBins ([gtfobins.github.io](https://gtfobins.github.io)) — what it is and how to look up binaries
- [ ] Common sudo misconfigs: unrestricted binaries (`find`, `vim`, `less`, `awk`, `python3`)
- [ ] Escalating with `find`: `sudo find . -exec /bin/sh \; -quit`
- [ ] What to look for after getting root: `/root/`, cron jobs, `/etc/shadow`, SUID binaries

### Report Writing
- [ ] Markdown: headers, fenced code blocks, tables, inline code
- [ ] How to structure a finding: vulnerability → evidence → impact → reproduction steps
- [ ] Taking notes continuously, not reconstructing from memory at the end

---

## Tips for a Great Exam Experience

**Work like a pentester, not a CTF speedrunner.**
Documentation is half the grade. Real pentesters write reports their clients can act on. Screenshot everything, save every command, note every dead end.

**Divide and conquer, then converge.**
Split recon tasks so both teammates are working in parallel from the start. When something interesting surfaces, work it together — two people think of different attack angles.

**Use your workspace religiously.**
Save every nmap scan to `~/ghost-ops/recon/`. Drop every credential you find into `~/ghost-ops/loot/creds.txt` immediately. You will forget things if you don't write them down as you go.

**Try manual before automated.**
Before firing `sqlmap`, try the injection by hand with `curl`. You'll understand the vulnerability better, and your report will reflect it. Automated tools are fine — but knowing what they're doing is the whole point.

**When stuck, enumerate harder.**
Most roadblocks are recon problems, not exploit problems. Scan all ports. Check every directory. Read every file you've already grabbed. The clue you missed is almost always in something you already have.

**Rotate when blocked.**
If one teammate is stuck for more than an hour, switch roles. Fresh eyes on a problem spot things the stuck person has been looking past for hours.

**Reset is always one command away.**
If a VM breaks, reset it without affecting anything else:
```bash
vagrant destroy <vmname> -f && vagrant up <vmname>
```

---

## Academic Integrity

This exam is completed in teams of two. You may **not**:
- Share findings, flags, or report content with other teams
- Receive help from students outside your team
- Use AI tools to write your methodology or report sections

You **may**:
- Use course slides, your personal notes, and man pages
- Use tools' built-in help (`nmap --help`, `man sqlmap`, etc.)
- Ask the instructor general methodology questions on the discussion board (without revealing findings)

Violations result in a zero for both team members.

---

## Questions

Post to the course discussion board. The instructor monitors it daily. Phrase questions about methodology without revealing specific findings — other teams are working the same network.

---

*"The best hackers aren't the ones who know the most exploits.*
*They're the ones who ask the best questions."*
*— Ghost Rider Field Manual, Chapter 7*
