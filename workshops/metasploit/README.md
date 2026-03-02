# Metasploit Framework Workshop Series
## Operation: Lazarus Protocol

> *"The quieter you become, the more you are able to hear."* — Kali Linux motto

---

## The Story

### Prologue — The Call

It was 2:47 AM on a Tuesday when Marcus "Grim" Reeves got the call. He'd been up anyway,
three monitors lit in his Austin home office, a half-cold cup of black coffee next to a
sticker-bombed laptop. The number showed PRIVATE, but he knew who it was.

"They got us," said David Park, CTO of Nexus Dynamics — a mid-size defense subcontractor
whose code touched satellite telemetry and logistics systems for two different government
programs. His voice was flat. The voice of someone who'd already processed the panic and
arrived at the cold side of the problem. "Three months. We think they were in three months
before we caught any indicator."

Grim leaned back. *Ghost Circuit.* The same APT group that had hit two semiconductor firms
in Taiwan and a shipyard in Rotterdam the prior year. Sophisticated, patient, and notorious
for the fact that they almost never made noise. The attribution was fuzzy — the malware
artifacts suggested nation-state resources, but the TTPs looked borrowed from a half-dozen
public exploit kits stitched together with custom tooling.

"We're bringing in the Feds," Park said. "But before we bring the network back online, I
need to know every door they could have walked through. Every window. Every crack in the wall."

Grim cracked his knuckles. "You need a Red Team."

"I need *your* Red Team."

---

### The Team

**Marcus "Grim" Reeves** — 14 years in offensive security. Former NSA TAO operator,
DEFCON speaker (Villages: Red Team, Car Hacking). Methodical, calm under fire, allergic to
unnecessary complexity. His philosophy: *"If the basics can own it, use the basics."*

**Zara "0x1A" Chen** — Exploit developer and bug bounty queen. Reverse engineering is
her native language. She has a habit of finding the one weird edge case in enterprise
software nobody else thinks to look at. Her wall has four CVE numbers in frames.

**Jake "Phantom" Williams** — Persistence and evasion specialist. Started in physical
red teaming, moved to digital. Deeply paranoid in the best possible way. Motto:
*"Getting in is easy. Staying in undetected is the art."*

---

### The Mission

RedPhantom Security Labs sets up a **lab replica** of Nexus Dynamics' compromised network
— a Windows Server environment and an Ubuntu server — and proceeds to methodically map,
exploit, pillage, and pivot through it. Every technique they demonstrate is exactly what
Ghost Circuit could have — and likely did — use. The goal isn't just to find the holes.
It's to **show the client exactly how bad it could have been**, step by step, in a
reproducible, documented way.

That replica? That's **Metasploitable 3**.

And you're on the Red Team.

---

## Workshop Overview

This workshop series introduces the **Metasploit Framework** — the most widely used
penetration testing platform in the industry — across three mastery levels. You will
work as part of the RedPhantom Red Team against Metasploitable 3 targets.

| Level  | Code       | Target  | Theme                                  |
|--------|------------|---------|----------------------------------------|
| Bronze | MSF-101-W  | Windows | Initial Access — *"Getting In"*        |
| Bronze | MSF-101-L  | Linux   | Initial Access — *"The Back Door"*     |
| Silver | MSF-201-W  | Windows | Privilege Escalation & Persistence     |
| Gold   | MSF-301-W  | Windows | Full Chain — *"Owning the Kingdom"*    |

> **Ethical Hacking Reminder:** Every technique in this workshop is to be performed
> **exclusively** in your isolated lab environment. Unauthorized use of these tools
> against systems you do not own or have written permission to test is a federal crime
> (CFAA) and a violation of this course's academic integrity policy. The goal is to
> understand attacker TTPs so you can build better defenses — Purple Team mindset always.

---

## Prerequisites

- Completion of Midterm 1
- Comfort with Linux CLI (navigation, file permissions, process management, networking basics)
- VirtualBox or VMware installed on your host machine
- At least **8 GB RAM** and **60 GB free disk space**
- Basic understanding of TCP/IP (ports, services, protocols)
- Curiosity and a willingness to break things in a lab

---

## Target Environment — Metasploitable 3

Metasploitable 3 is an **intentionally vulnerable VM** built by Rapid7 (the makers of
Metasploit). It exists for exactly this purpose: learning exploitation in a safe, legal
environment. It comes in two flavors, both of which you will use.

| VM                   | OS                     | Key Services                                         |
|----------------------|------------------------|------------------------------------------------------|
| Metasploitable3-Win  | Windows Server 2008 R2 | SMB, RDP, HTTP, Tomcat, ManageEngine, MySQL, FTP     |
| Metasploitable3-Lin  | Ubuntu 14.04 LTS       | ProFTPd, Samba, UnrealIRCd, Tomcat, WordPress, MySQL |

**See `setup.md` for full environment setup instructions.**

---

## The Metasploit Framework at a Glance

```
msfconsole                  # The interactive console (your main interface)
  └── use <module>          # Load a module
  └── info                  # Module description and options
  └── show options          # Required/optional parameters
  └── set <OPTION> <value>  # Configure a parameter
  └── run / exploit         # Execute the module
  └── sessions              # Manage active sessions
  └── sessions -i <id>      # Interact with a session

Module Types:
  auxiliary/     # Scanners, fuzzers, sniffers (no shell)
  exploit/       # Exploit code targeting a vulnerability
  payload/       # Code that runs after exploitation (shell, meterpreter)
  post/          # Post-exploitation actions (run inside a session)
  encoder/       # Obfuscate payloads
  nop/           # NOP sleds for buffer overflows
```

---

## Workshop Files

```
workshops/metasploit/
├── README.md              ← You are here (story + overview)
├── setup.md               ← Environment setup guide
├── bronze-windows.md      ← MSF-101-W: Bronze / Windows
├── bronze-linux.md        ← MSF-101-L: Bronze / Linux
├── silver-windows.md      ← MSF-201-W: Silver / Windows
└── gold-windows.md        ← MSF-301-W: Gold / Windows
```

---

## Story Arc — Where Each Lab Fits

```
BRONZE ──────────────────────────────────────────────────────────────────►
  Chapter 1: "Grim scans the replica network. Ports talk.
               Ghost Circuit's first mistake was leaving the lights on."

SILVER ──────────────────────────────────────────────────────────────────►
  Chapter 2: "0x1A drops into a low-privilege shell and starts climbing.
               Every sysadmin shortcut is an attacker's ladder."

GOLD ────────────────────────────────────────────────────────────────────►
  Chapter 3: "The full team coordinates. Custom payloads. Pivot routes.
               By 4 AM they owned the domain. Ghost Circuit had months.
               The team did it in a single shift."
```

---

*"Hackers are not magicians. They are people who read the manual."*
*— Unknown, repeated at every DEFCON since forever*
