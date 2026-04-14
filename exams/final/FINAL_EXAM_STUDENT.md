# CYBERSECURITY — FINAL EXAM
## Operation GHOST SIGNAL

**Time Allowed:** 3 Hours
**Total Points:** 100
**Open resources:** Man pages, personal notes, course slides

---

## Prologue — Year 3000

The Quantum Age changed everything.

By the year 2756, classical computers had been fully retired. Quantum processing units — QPUs — now ran everything from personal neural implants to interplanetary communications. Humanity sprawled across the solar system, connected by **QNet**: a planet-spanning, supposedly quantum-encrypted communication infrastructure managed by a single corporation.

**NeoCorp Quantum Syndicate (NQS).**

They promised security. They promised privacy. They said quantum encryption was mathematically unbreakable.

They lied.

---

Intelligence recovered by a Resistance field operative — at the cost of their life — revealed something that no government wanted to believe: NQS had been secretly embedding **hardware backdoors** into every quantum processor they sold. Processors used in government data centers. Military command networks. Judicial systems. Energy grids.

The backdoors bypassed quantum key distribution entirely. NQS could read anything. Anyone. Anytime.

The operation has a name: **PHANTOM QUBIT**.

Phase 1 is complete: 47 quantum nodes, 14 sovereign governments, all compromised. Phase 2 — mass interception — activates at the **Year 3000 rollover**. In hours, NQS will have leverage over every government on Earth.

The Resistance has one move left.

---

You are a **Ghost Rider** — a cyber operative of the Underground Resistance. Your quantum-shielded attack terminal has been positioned in the DMZ perimeter of an NQS regional data center, **Sector 7**. This is one of three data centers storing evidence of Operation PHANTOM QUBIT.

If you can penetrate the NQS network, extract the evidence packages, and get them to the Resistance broadcast array, the story breaks globally. Governments fall. NQS loses everything.

If you fail — Phase 2 proceeds. And every "quantum-secure" message ever sent belongs to NeoCorp.

**The clock is ticking, Ghost Rider. Make it count.**

---

## Mission Parameters

### Your Environment

You are logged into the **Ghost Terminal** — your attack machine inside the NQS DMZ perimeter.

```
vagrant ssh attacker
```

Your workspace is at `~/ghost-ops/`. Use it.

### Rules of Engagement

1. Your attack terminal is at IP **10.10.10.5** on the DMZ network.
2. You may scan, probe, and exploit any host reachable from your terminal.
3. You may use any tools available on the attacker VM.
4. Denial-of-service attacks are **not** required — finesse over force.
5. Document **every step** of your methodology.

### Deliverables

Submit a **single Markdown report** containing:

1. A network topology diagram of everything you discovered.
2. For each flag captured:
   - The flag value
   - The target host and IP
   - The vulnerability exploited
   - The exact commands you ran (in code blocks)
3. Your pivot methodology (if you reached the internal network).

---

## Objectives & Scoring

NQS has hidden **6 classified evidence packages** (flags) across their network. Each flag is a string in the format:

```
FLAG{...}
```

| Objective                          | Points |
|------------------------------------|--------|
| **Flag 1** — DMZ File Server       | 10 pts |
| **Flag 2** — DMZ Web Portal        | 20 pts |
| **Flag 3** — Perimeter Gateway     | 15 pts |
| **Flag 4** — Internal Web Server   | 15 pts |
| **Flag 5** — Internal Database     | 20 pts |
| **Flag 6** — Operator Workstation  | 20 pts |
| **Network Topology Diagram**       | Bonus  |

Points are awarded **only** with correct flags AND a clear explanation of the methodology used.
Partial credit is available for documented attempts that demonstrate correct technique, even without extracting the flag.

---

## Operational Intelligence (Hints)

The Resistance has managed to pull some intel before going dark. Use it wisely.

> *"The DMZ is their public face. Three systems are reachable immediately. One of them has a legacy file service that an NQS sysadmin forgot to lock down before the holidays. Classic."*

> *"Their web portal was built by interns. The developer left debug output enabled. That's all I'll say."*

> *"The network doesn't end at the DMZ. There's more behind the gateway — and the gateway operator recycled a password. Find it."*

> *"Once you're past the gate, the internal network is embarrassingly open. They got lazy because they thought no one would ever get that far."*

> *"The final target is a workstation. Operator has a bad habit with sudo. Check what they're allowed to run."*

---

## Getting Started

```bash
# Log into your attack terminal
vagrant ssh attacker

# Read your mission brief
cat ~/ghost-ops/notes/mission_brief.txt

# Your known entry point is the DMZ: 10.10.10.0/24
# Start with reconnaissance. Don't rush in blind.
```

---

## Submission

Submit your report file as `LASTNAME_FIRSTNAME_ghostsignal.md` via BrightSpace before the exam ends.

Include all flag values, all commands run, and your network topology diagram.

---

*"In a world of quantum noise, the truth still travels in plaintext."*
*— Ghost Rider Field Manual, Chapter 1*

---

**Good luck. The Resistance is watching.**
