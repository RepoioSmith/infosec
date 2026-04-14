# TCP/IP Wizard

Interactive visual learning tool for TCP/IP packet inspection — built for undergrad cybersecurity students.

## Overview

TCP/IP Wizard is a browser-based single-page app that teaches the inner workings of TCP/IP protocols from a security perspective. Students explore packet headers layer by layer, understand each field's purpose, learn how attackers abuse them, and generate ready-to-run Scapy code to experiment in the lab.

## Features

- **3-panel one-screen layout** — no scrolling required
- **Packet Structure panel** — color-coded, clickable field blocks per protocol layer
- **Field Inspector panel** — per-field breakdown including:
  - Field name, size (bits), and Scapy key
  - Protocol purpose and description
  - Security exploitation perspective
  - Known attack techniques
  - CVE references and real-world tools
- **Scapy Generator panel** — live Python code that updates as you edit field values, with one-click copy and a quick-reference cheat sheet
- **Attack Presets** — one-click scenarios: SYN Flood, XMAS Scan, NULL Scan, ACK Scan, ICMP Redirect, ARP Poison, Gratuitous ARP

## Protocols Covered

| Protocol | Layers | Fields |
|---|---|---|
| TCP | Ethernet / IP / TCP | 17 fields |
| UDP | Ethernet / IP / UDP | 14 fields |
| ICMP | Ethernet / IP / ICMP | 13 fields |
| ARP | Ethernet / ARP | 8 fields |

## Tech Stack

- **React + Vite** — frontend framework and build tool
- **Tailwind CSS** — utility-first styling
- No backend — pure client-side, no data leaves the browser

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

App runs at `http://localhost:5173` by default.

## Project Structure

```
src/
  data/
    protocols.js          # All protocol field definitions, security notes, attacks, CVEs
  components/
    PacketVisualizer.jsx  # Left panel — clickable layered field blocks
    FieldInspector.jsx    # Center panel — field detail viewer and value editor
    ScapyGenerator.jsx    # Right panel — live Scapy code generator
  App.jsx                 # Main layout and application state
  index.css               # Global styles and Tailwind import
```

## Using the Scapy Output

Copy the generated code and paste it directly into a Scapy REPL:

```bash
sudo scapy
```

```python
>>> pkt.show()       # inspect all layers
>>> send(pkt)        # send at Layer 3
>>> sendp(pkt)       # send at Layer 2
>>> sr1(pkt)         # send and capture one reply
>>> hexdump(pkt)     # raw hex view
>>> wrpcap('x.pcap', pkt)  # save to pcap file
```

## Educational Use

This tool is intended for educational purposes in controlled lab environments. All attack techniques described are for learning defensive security concepts. Always practice on networks and systems you own or have explicit written permission to test.
