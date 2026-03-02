# Environment Setup Guide
## Metasploit Workshop — Lab Infrastructure

> This guide walks you through setting up the full lab environment before starting any
> of the Bronze, Silver, or Gold workshops.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Your Host Machine                         │
│                                                             │
│  ┌──────────────────┐    ┌──────────────────────────────┐  │
│  │  Attacker VM     │    │     VirtualBox Host-Only     │  │
│  │  Kali / ParrotOS │◄──►│     Network: 192.168.56.0/24 │  │
│  │  192.168.56.1    │    └──────────────┬───────────────┘  │
│  └──────────────────┘                   │                   │
│                              ┌──────────┴──────────┐        │
│                              │                     │        │
│               ┌──────────────▼──┐         ┌────────▼─────┐ │
│               │  MS3 - Windows  │         │ MS3 - Linux  │ │
│               │  Server 2008 R2 │         │ Ubuntu 14.04 │ │
│               │  192.168.56.103 │         │ 192.168.56.102│ │
│               └─────────────────┘         └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

> **Note:** IP addresses may vary depending on your DHCP configuration.
> Always verify with `nmap -sn 192.168.56.0/24` after booting VMs.

---

## Step 1 — Install VirtualBox and Vagrant

### On Ubuntu/ParrotOS (host or attacker VM setup):

```bash
# Install VirtualBox
sudo apt update && sudo apt install -y virtualbox virtualbox-ext-pack

# Install Vagrant
wget -O /tmp/vagrant.deb https://releases.hashicorp.com/vagrant/2.3.7/vagrant_2.3.7-1_amd64.deb
sudo dpkg -i /tmp/vagrant.deb
vagrant --version
```

### On Windows host:
Download and install from official sites:
- VirtualBox: https://www.virtualbox.org/wiki/Downloads
- Vagrant: https://developer.hashicorp.com/vagrant/downloads

---

## Step 2 — Download Metasploitable 3

Metasploitable 3 uses **Vagrant** to automate VM building.

```bash
# Create a dedicated directory
mkdir -p ~/labs/metasploitable3 && cd ~/labs/metasploitable3

# Clone the Metasploitable 3 repository
git clone https://github.com/rapid7/metasploitable3.git
cd metasploitable3
```

### Option A — Build from scratch (recommended, takes ~30-60 min)

```bash
# Install required Vagrant plugins
vagrant plugin install vagrant-reload

# Spin up the Windows VM
vagrant up win2k8

# Spin up the Linux VM
vagrant up ub1404
```

### Option B — Pre-built OVA (faster if available from instructor)

If your instructor provides pre-built OVA files:
```bash
# Import via VirtualBox GUI: File > Import Appliance
# Or via CLI:
VBoxManage import metasploitable3-win2k8.ova
VBoxManage import metasploitable3-ub1404.ova
```

---

## Step 3 — Configure Networking

Both VMs need a **Host-Only** network adapter so your attacker machine can reach them
without internet exposure.

```bash
# Create a host-only network in VirtualBox (if not exists)
VBoxManage hostonlyif create
VBoxManage hostonlyif ipconfig vboxnet0 --ip 192.168.56.1 --netmask 255.255.255.0

# Verify the network adapter is attached to each VM:
VBoxManage showvminfo "metasploitable3-win2k8" | grep -i "host-only"
VBoxManage showvminfo "metasploitable3-ub1404" | grep -i "host-only"
```

---

## Step 4 — Set Up Your Attacker Machine

### Using Kali Linux or ParrotOS (recommended):

If you're running Kali/Parrot as a VM, add a Host-Only adapter to it as well and
confirm network connectivity.

```bash
# Check your attacker IP on the host-only interface
ip addr show

# Verify you can reach the targets (after booting them)
ping -c 3 192.168.56.102   # Linux target
ping -c 3 192.168.56.103   # Windows target
```

### Metasploit is pre-installed on Kali/ParrotOS. Verify:

```bash
msfconsole --version
# Should return: Framework Version: 6.x.x

# Update the database (do this once per session)
sudo service postgresql start
sudo msfdb init        # First time only
sudo msfdb start
```

---

## Step 5 — Verify Metasploitable 3 Services

### Default Credentials

| VM      | Username  | Password  |
|---------|-----------|-----------|
| Windows | vagrant   | vagrant   |
| Linux   | vagrant   | vagrant   |

> These are intentionally weak — that's the point.

### Quick service check — Windows target:

```bash
nmap -sV -p 21,22,80,445,3389,8080,8282 192.168.56.103
```

Expected open ports (Windows):
- `21/tcp`  — FTP (FileZilla)
- `22/tcp`  — SSH (OpenSSH)
- `80/tcp`  — HTTP (WampServer/Apache)
- `445/tcp` — SMB (vulnerable to MS17-010)
- `3389/tcp`— RDP
- `8080/tcp`— Apache Tomcat
- `8282/tcp`— ManageEngine Desktop Central
- `9200/tcp`— Elasticsearch

### Quick service check — Linux target:

```bash
nmap -sV -p 21,22,80,445,1524,3306,6667,8080 192.168.56.102
```

Expected open ports (Linux):
- `21/tcp`  — ProFTPd (vulnerable mod_copy)
- `22/tcp`  — SSH
- `80/tcp`  — Apache / WordPress
- `445/tcp` — Samba (CVE-2017-7494)
- `6667/tcp`— UnrealIRCd (backdoor)
- `8080/tcp`— Apache Tomcat
- `3306/tcp`— MySQL (no root password)

---

## Step 6 — Initialize Metasploit Database (msfdb)

The MSF database lets you store scan results, hosts, services, and loot.
This is crucial for organized engagements.

```bash
# Start PostgreSQL
sudo service postgresql start

# Initialize the MSF database (first time only)
sudo msfdb init

# Launch msfconsole and verify DB connection
msfconsole -q
msf6 > db_status
# Expected: [*] Connected to msf. Connection type: postgresql.

# Create a workspace for this lab
msf6 > workspace -a metasploitable3
msf6 > workspace
# * metasploitable3
```

---

## Snapshot Your VMs

Before you start hacking, take a snapshot of each VM in its clean state.
This lets you revert after testing without rebuilding.

```bash
# Take a snapshot (VirtualBox CLI)
VBoxManage snapshot "metasploitable3-win2k8" take "clean-state" --description "Before lab"
VBoxManage snapshot "metasploitable3-ub1404" take "clean-state" --description "Before lab"

# Revert to clean state when needed
VBoxManage snapshot "metasploitable3-win2k8" restore "clean-state"
```

---

## Cheat Sheet — Essential msfconsole Commands

```
help                          # Show help menu
search <term>                 # Search modules by name/CVE/platform
use <module path>             # Load a module
back                          # Unload current module
info                          # Show module info and author
show options                  # Show required options
show payloads                 # List compatible payloads
set <OPTION> <value>          # Set an option
setg <OPTION> <value>         # Set option globally (all modules)
unset <OPTION>                # Clear an option
run / exploit                 # Execute the module
check                         # Check if target is vulnerable (if supported)
sessions                      # List active sessions
sessions -i <id>              # Interact with a session
sessions -k <id>              # Kill a session
jobs                          # List background jobs
kill <job_id>                 # Kill a job
db_nmap <options> <target>    # Nmap scan that saves to DB
hosts                         # Show discovered hosts in DB
services                      # Show discovered services in DB
vulns                         # Show discovered vulnerabilities in DB
loot                          # Show collected loot (files, hashes, etc.)
creds                         # Show collected credentials
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `db_status` shows not connected | Run `sudo service postgresql start && sudo msfdb start` |
| Cannot reach target VMs | Verify Host-Only adapter on all VMs; check `ip addr` |
| `vagrant up` fails | Check VirtualBox version compatibility with Vagrant |
| Windows VM boots but no RDP | Allow 3-5 min for all services to start |
| Module not found | Run `updatedb` in msfconsole or `apt update && apt upgrade metasploit-framework` |
| Session dies immediately | Try a different payload (stageless vs staged, 32-bit vs 64-bit) |

---

*You're now ready to begin. Start with `bronze-windows.md` or `bronze-linux.md`.*
