# Lab 8: Firewall Hardening with UFW and iptables

## VM Setup

```bash
vagrant up
vagrant ssh target    # 192.168.56.20 — the server you will harden
vagrant ssh attacker  # 192.168.56.10 — your scanning platform
```

---

## The Call

It's **11:47 PM on a Thursday** when **Renata** gets the message.

She is a freelance security consultant, two espressos deep, halfway through a report
for a client in São Paulo. The new message is from a startup CTO she helped six months
ago — subject line: *"quick question, can you look at something?"*

*"Quick question"* always means the opposite. She clicks it.

The CTO had promoted his best developer to sysadmin three weeks ago. The developer —
smart, well-intentioned, completely untrained in security — had provisioned a new Ubuntu
server for their internal tools. Set up SSH, a web app, a database, an FTP share, and
another database for the analytics team. Everything ran. The developer was proud.

Then the CTO got an alert from their cloud provider: the server was generating outbound
traffic to an IP in Eastern Europe at 3 GB/hour. Not a lot. Just enough to notice.

Renata remoted in. First command she ran was `nmap -sS -sV -p- 192.168.56.20` from an
external host. The output came back in forty seconds.

Five services. All of them exposed to the internet. No firewall. MySQL's `bind-address`
set to `0.0.0.0`. FTP with anonymous read disabled but password auth open to the world.
PostgreSQL same story. Apache running the default index page with the server version
in the headers.

She took a screenshot for the report. Then she locked it down.

---

## Learning Objectives

By the end of this lab you will be able to:

- Enumerate open ports and running services on a live Linux server
- Configure UFW to implement a default-deny host firewall from scratch
- Manage firewall rules: allow, deny, rate-limit, source-restrict, delete
- Inspect the `iptables` rules that UFW generates underneath
- Recreate equivalent rules directly with `iptables`
- Verify firewall behavior using `nmap` from an external host
- Identify the difference between a firewall rule and a service binding

---

## The Server

The `target` VM (`192.168.56.20`) has five services installed and running. UFW is
installed but **inactive** — all ports are currently open to the world.

You are not told which services are running or on which ports. That is your first task.

---

## Part A — Reconnaissance (from the attacker VM)

Before touching the firewall, document the attack surface. From `192.168.56.10`,
run a thorough port and service scan against `192.168.56.20`.

**Save the full output.** This is your "before" snapshot and a required deliverable.

---

## Part B — UFW Hardening (on the target VM)

Work on `192.168.56.20`.

### Task 1 — Lock it down to SSH only

Enable UFW. Set a default policy that denies all inbound traffic. Allow only SSH.
Before you enable UFW, make sure you will not lock yourself out.

Verify from the attacker VM that only SSH is reachable and all other services are
now firewalled. Save the nmap output — this is your "locked" snapshot.

### Task 2 — Reopen ports for each service

For each of the five services running on this server, create the minimum necessary
UFW rule(s) to make it reachable from the attacker VM (`192.168.56.10`).

Requirements:
- Rules must be **source-restricted** where appropriate — not open to `0.0.0.0/0`
- FTP requires more than one rule — figure out why
- SSH must have **rate limiting** enabled
- All rules must survive a reboot

Verify each service is reachable from the attacker after adding its rule.

### Task 3 — The bind-address problem

Look at how MySQL and PostgreSQL are configured to listen on the network.
Describe what you observe. Then answer: if a firewall rule restricts access to those
ports, is the underlying service configuration still a problem? Why or why not?

---

## Part C — iptables: Under the Hood (on the target VM)

### Task 4 — Read what UFW wrote

Inspect the actual `iptables` rules that UFW generated. Identify the chains UFW uses
and match each UFW rule you created to its corresponding `iptables` entry.

### Task 5 — Recreate rules with raw iptables

Disable UFW. The firewall is now wide open again.

Using only `iptables` commands (no `ufw`), recreate the same ruleset you built in
Part B: default-deny inbound, allow SSH (with rate limiting), and allow each service
from `192.168.56.10` only.

Verify from the attacker VM that behavior is identical to your UFW configuration.

> `iptables` rules do not persist across reboots by default. Find the standard method
> to make them persistent on Ubuntu and apply it.

---

## Part D — Firewall Verification (from the attacker VM)

### Task 6 — Audit from the outside

Run a final nmap scan from `192.168.56.10` against `192.168.56.20`. The results must
reflect your intended policy exactly.

Then use the firewalking technique from the UFW workshop to confirm which ports are
allowed through the firewall. Use any tool from the workshop: `hping3`, `firewalk`,
or Scapy.

Compare firewalking results to your nmap results. Explain any discrepancies.

---

## Deliverables

Submit a single PDF report containing the following. Evidence must be terminal
output — no screenshots of terminal text.

| # | Deliverable |
|---|---|
| 1 | Full `nmap -sS -sV -p-` output from **before** any firewall was configured |
| 2 | Full `nmap` output after **Task 1** (SSH only) |
| 3 | Full `ufw status numbered` output after **Task 2** |
| 4 | Full `nmap` output after **Task 2** (all services reopened) |
| 5 | Written answer to **Task 3** (bind-address analysis, min. 150 words) |
| 6 | `iptables -L -n -v` output from **Task 4**, annotated — each line mapped to the UFW rule that generated it |
| 7 | All `iptables` commands used in **Task 5** (raw, not UFW) |
| 8 | `iptables -L -n -v` output after **Task 5**, showing the manually built ruleset |
| 9 | Firewalking output from **Task 6** with a written explanation of the results |
| 10 | Reboot verification: `ufw status` or `iptables -L` output after a `vagrant reload target` |

---

## Constraints

- Do not modify application configuration files to fix network exposure (except for
  Task 3 analysis). The firewall is your only tool in Parts A–C.
- All firewall rules must be documented with a comment explaining their purpose.
- Do not disable or uninstall any service.

---

## Evaluation Criteria

Your work will be evaluated on:

- **Correctness** — does the final nmap output match your stated policy exactly?
- **Least privilege** — are rules as narrow as they should be? Source-restricted where appropriate?
- **Understanding** — does your Task 3 and Task 6 analysis show you understand what you configured and why?
- **iptables depth** — does your Task 4 annotation correctly map UFW rules to iptables chains?
- **Persistence** — do your rules survive a reboot?

---

## Ethics Notice

All activities in this lab target VMs you control in an isolated private network.
Applying these techniques — scanning, firewall enumeration, or firewalking — against
any system without explicit written authorization is **illegal**. Understanding how
to harden a system requires understanding how it is attacked. Think Purple Team.

---
