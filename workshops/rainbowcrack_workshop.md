# Operation ZOLOTO — Rainbow Tables & RainbowCrack
## A Password Cracking Workshop

> *"В тёмных водах нет рыбы, которую нельзя поймать."*
> *"In dark waters, there is no fish that cannot be caught."*
>
> — Yuri "Spektr" Volkov, Moscow underground, 1999

---

## Moscow, December 1999

The apartment smelled like cigarettes and cold tea. Four monitors cast a blue glow on
Yuri Volkov's face — 29 years old, former cryptography analyst for a state research
institute, now operating under the handle **Spektr** in Moscow's underground hacker
scene. He'd left the institute when the money stopped arriving. Most of his colleagues
had. The 1990s had not been kind to the USSR's scientific class.

Outside: snow, crumbling Brezhnev-era concrete, a broken streetlight on Ulitsa Akademika
Koroleva. Inside: three open terminals, a pirated copy of Midnight Commander, and a
problem.

His contact — an information broker known only as **Babushka** (she was 31, found the
nickname hilarious) — had delivered an encrypted archive two hours ago via an IRC
channel that didn't officially exist. Inside: a backup file from a private server
belonging to Viktor Chernov, a mid-tier oligarch with an appetite for creative
accounting and a security posture stuck somewhere in 1993.

The archive contained what Babushka had promised: **a dump of MD5 password hashes**
from Chernov's internal document management system. Documents that journalists at
*Novaya Gazeta* wanted very badly to read. Documents that would not read themselves.

Yuri lit another cigarette, cracked his knuckles, and opened a terminal.

*The passwords aren't going to crack themselves either. But I have rainbow tables.*

---

## Workshop Overview

| Item          | Detail                                              |
|---------------|-----------------------------------------------------|
| Duration      | 45 minutes                                          |
| Tool          | RainbowCrack (`rtgen`, `rtsort`, `rcrack`)          |
| Target OS     | Ubuntu / ParrotOS 		  		      | 
| Hash Type     | MD5                                                 |
| Difficulty    | Intermediate                                        |
| Prerequisites | Linux CLI basics, understanding of hash functions   |

> **Ethical Hacking Reminder:** All techniques in this workshop are performed in an
> **isolated lab environment against hashes you generate yourself**. Cracking hashes
> from systems you do not own or have explicit written authorization to test is a
> federal crime (CFAA / ECPA) and a violation of academic integrity policy.
> The goal is Purple Team thinking: learn the attack, build the defense.

---

## Part 0 — Theory Brief (10 min)

### The Hash Problem

When a system stores passwords, it (ideally) doesn't store the plaintext. It stores
the **hash** — the output of a one-way mathematical function:

```
MD5("password123")  →  482c811da5d5b4bc6d497ffa98491e38
SHA1("password123") →  cbfdac6008f9cab4083784cbd1874f76618d2a97
```

A hash function is a **one-way street**: easy to go from plaintext → hash, computationally
infeasible to reverse. So how do attackers crack hashes?

### Three Approaches

| Method              | How it works                                  | Tradeoff                            |
|---------------------|-----------------------------------------------|-------------------------------------|
| **Dictionary**      | Hash every word in a wordlist, compare        | Fast, limited by wordlist quality   |
| **Brute Force**     | Hash every possible combination               | Guaranteed but exponentially slow   |
| **Rainbow Tables**  | Pre-compute everything, look up at crack time | Slow to build, **instant** to crack |

### The Analogy — The Soviet Phone Directory

Imagine you're looking for someone's address and you only have their phone number.

- **Brute Force**: Call every address in Moscow until someone answers. Slow.
- **Dictionary**: Call every address on a list of "likely suspects." Faster, but incomplete.
- **Rainbow Table**: *You already have the phone directory*. You look up the number in
  O(log n) time. The work was done **once** when the directory was printed.

Rainbow tables are that directory — a pre-computed lookup structure that maps hashes
back to their plaintexts. Build it once, crack forever.

### Why Not Just a Hash→Plaintext Dictionary?

A pure lookup table for all 8-character alphanumeric passwords would require
**terabytes** of storage. Rainbow tables solve this with a **time-space tradeoff**
using **chains**:

```
plaintext₀ → hash₀ → reduce → plaintext₁ → hash₁ → reduce → ... → plaintextₙ → hashₙ
    ↑                                                                         ↑
  stored                                                                   stored
(start point)                                                            (end point)
```

Only the **start and end points of each chain** are stored. To crack a hash, you
run it through the reduction function and walk through chains until you find a match.
This compresses storage by orders of magnitude while maintaining high coverage.

### The RainbowCrack Toolchain

| Tool      | Role                                               |
|-----------|----------------------------------------------------|
| `rtgen`   | **Generate** rainbow tables (the heavy lifting)    |
| `rtsort`  | **Sort** tables by end point (enables fast lookup) |
| `rcrack`  | **Crack** hashes using the sorted tables           |

---

## Part 1 — Setup (5 min)

### Install RainbowCrack

```bash
sudo apt update && sudo apt install -y rainbowcrack
```

Verify installation:

```bash
rtgen --help
rtsort --help
rcrack --help
```

> On **ParrotOS**, RainbowCrack may already be installed. Verify with `which rtgen`.

Check where rainbow table files will be stored (default):

```bash
ls /usr/share/rainbowcrack/
```

You should see a `charset.txt` file listing all supported character sets. Take a look:

```bash
cat /usr/share/rainbowcrack/charset.txt
```

Key character sets for this workshop:

```
numeric         = [0123456789]
loweralpha      = [abcdefghijklmnopqrstuvwxyz]
loweralpha-numeric = [0123456789abcdefghijklmnopqrstuvwxyz]
```

---

## Part 2 — Meet the Target Hashes (5 min)

*Babushka's file contained several hashes. Spektr examines them.*

Create your working directory:

```bash
mkdir -p ~/lab_zoloto && cd ~/lab_zoloto
```

### Step 2.1 — Inspect the Hash Dump

Create the target hash file (simulating what Spektr received):

```bash
cat > target_hashes.txt << 'EOF'
cc03e747a6afbbcbf8be7668acfebee5
d8578edf8458ce06fbc5bb76a58c5ca4
827ccb0eea8a706c4c34a16891f84e7b
a87ff679a2f3e71d9181a67b7542122c
EOF
```

These are MD5 hashes. Note them — your mission is to recover the plaintexts.

### Step 2.2 — Benchmark Before You Generate

Before generating tables, **always benchmark** to estimate time and coverage:

```bash
rtgen md5 numeric 1 4 0 -bench
```

Then benchmark for lowercase alpha:

```bash
rtgen md5 loweralpha 1 4 0 -bench
```

**Read the output carefully.** It tells you chains-per-second on your hardware.
This is your planning tool. Always run it before committing to a table generation.

> Spektr ran the benchmark and lit another cigarette while the numbers appeared.
> *Time is the only currency that can't be laundered.* He had enough of it tonight.

---

## Part 3 — Generate Rainbow Tables with `rtgen` (12 min)

### The `rtgen` Syntax

```
rtgen <hash_algo> <charset> <min_len> <max_len> <table_index> <chain_len> <chain_num> <part_index>
```

| Parameter      | Description                                              |
|----------------|----------------------------------------------------------|
| `hash_algo`    | `md5`, `sha1`, `ntlm`, `sha256`, `lm`                   |
| `charset`      | Character set name from `charset.txt`                    |
| `min_len`      | Minimum plaintext length                                 |
| `max_len`      | Maximum plaintext length                                 |
| `table_index`  | Index (0 for first table, 1 for second, etc.)            |
| `chain_len`    | Length of each chain (longer = fewer chains needed)      |
| `chain_num`    | Number of chains (more = better coverage)                |
| `part_index`   | Partition index (use 0 unless splitting large tables)    |

### Step 3.1 — Generate a Numeric Table (fast demo)

Numeric passwords are short and the table will generate in seconds:

```bash
cd ~/lab_zoloto
rtgen md5 numeric 1 4 0 1000 2000 0
```

Watch it run. You'll see:
```
rainbow table md5_numeric#1-4_0_1000x2000_0.rt parameters
hash algorithm: md5
...
generating...
```

Wait for it to complete. The generated file will appear in the current directory:

```bash
ls -lh *.rt
```

### Step 3.2 — Generate a Lowercase Alpha Table (main exercise)

This covers lowercase-only passwords up to 4 characters — enough for simple passwords
an oligarch's assistant might use in 1999:

```bash
rtgen md5 loweralpha 1 4 0 2000 5000 0
```

> **Storage note:** Real-world tables covering longer passwords with larger charsets
> can run into hundreds of gigabytes. For this lab, our tables are tiny by design.

While the table generates, take note of what's happening: your CPU is computing
millions of **hash chains** — each one a sequence of alternating hash and reduce
operations. The machine is doing the hard work **now** so that cracking is instant
**later**.

List your generated tables:

```bash
ls -lh ~/lab_zoloto/*.rt
```

---

## Part 4 — Sort the Tables with `rtsort` (5 min)

A rainbow table is useless for cracking until it's **sorted by end point**.
Sorting enables binary search — without it, `rcrack` would have to scan every
chain linearly. With it, lookups are O(log n).

### Step 4.1 — Sort All Tables in the Directory

```bash
cd ~/lab_zoloto
rtsort .
```

`rtsort` will process every `.rt` file in the current directory.

Watch the output — you'll see memory usage and progress for each table.

Verify the tables are sorted:

```bash
ls -lh *.rt
```

> The file size won't change, but the internal order of chains is now sorted
> by end point. Think of it as the difference between a shuffled phone directory
> and an alphabetized one. Same data, radically different search speed.

> *"Порядок бьёт класс,"* Spektr muttered — *"Discipline beats talent."* His old
> institute professor used to say that. Tonight it meant: sort your tables.

---

## Part 5 — Crack Hashes with `rcrack` (10 min)

### The `rcrack` Syntax

```
rcrack <table_path> [table_path ...] -h <single_hash>
rcrack <table_path> [table_path ...] -l <hash_list_file>
rcrack <table_path> [table_path ...] -ntlm <pwdump_file>
```

### Step 5.1 — Crack a Single Hash

Let's start with one hash from the target file:

```bash
cd ~/lab_zoloto
rcrack . -h cc03e747a6afbbcbf8be7668acfebee5
```

Observe the output. If the hash is in the table's coverage, you'll see:

```
plaintext found: <password>
```

If not found, the table doesn't cover that plaintext — the password might use
characters outside your charset, or be longer than your `max_len`. This is a
**coverage** problem, not a tool failure.

### Step 5.2 — Crack the Full Hash List

Now crack all hashes from the target file at once:

```bash
rcrack . -l target_hashes.txt
```

Observe the output format:

```
<hash>  <plaintext>
```

Record which hashes were cracked and which were not. The ones not cracked are
outside your current table's coverage.

### Step 5.3 — Expand Coverage (Optional Challenge)

Generate a second table with `table_index 1` to improve coverage without
re-scanning the same chains:

```bash
rtgen md5 loweralpha 1 4 1 2000 5000 0
rtsort .
rcrack . -l target_hashes.txt
```

Then try cracking with the combined numeric + loweralpha tables:

```bash
rcrack . -l target_hashes.txt
```

> *Babushka had said two of the passwords were the assistant's cat's name and one
> was her birth year. Spektr didn't know the cat's name. But he had tables.*

---

## Part 6 — Verify Your Results (3 min)

Cross-check any cracked passwords by generating the hash yourself and comparing:

```bash
echo -n "your_cracked_password" | md5sum
```

Compare the output to the original hash in `target_hashes.txt`. They should match
exactly. This is your **proof of work** — the same process a penetration tester
uses to validate findings in a report.

---

## Part 7 — Defenses Discussion (5 min)

*Spektr got three of the four hashes. The fourth one was different — he could tell
from the length pattern. It was salted. Viktor's IT contractor had, accidentally,
done one thing right.*

### Why Rainbow Tables Fail Against Salted Hashes

A **salt** is a random string appended to the password before hashing:

```
MD5("password" + "x7k9q2") → completely different hash
MD5("password" + "m3n8p1") → completely different hash
```

Every hash is unique even if users share the same password. A rainbow table built
for `MD5("plaintext")` is **completely useless** against `MD5("plaintext" + salt)`
because the attacker would need a separate table for every possible salt value.

```
Without salt:  MD5("abc") → 900150983cd24fb0d6963f7d28e17f72  (same every time)
With salt:     MD5("abcXR7k9") → a3c7... (unique per user)
```

### Modern Best Practices

| Mechanism   | Description                                                    | Defeats Rainbow Tables? |
|-------------|----------------------------------------------------------------|-------------------------|
| `bcrypt`    | Slow hash with built-in salt + configurable cost factor        | Yes                     |
| `scrypt`    | Memory-hard, resistant to GPU acceleration                     | Yes                     |
| `Argon2`    | NIST-recommended; memory + CPU hard                            | Yes                     |
| `PBKDF2`    | Key derivation with iterations; used in WPA2, Django           | Yes                     |
| Plain MD5   | Fast, no salt, no cost factor — **do not use for passwords**   | No — vulnerable         |
| Salted MD5  | Defeats rainbow tables, but still fast (GPU crackable)         | Partial                 |

### Quick Lab Check — See the Difference

Generate a "salted" hash manually and try to crack it:

```bash
echo -n "abc" | md5sum              # unsalted — probably in your table
echo -n "abcR4nd0mS4lt" | md5sum   # salted — not in your table
```

Try cracking the salted hash with `rcrack`. You won't find it.

---

## Reference Card

### Full Workflow Cheat Sheet

```
# 1. Benchmark first
rtgen md5 <charset> <min> <max> 0 -bench

# 2. Generate table
rtgen md5 <charset> <min> <max> <table_index> <chain_len> <chain_num> 0

# 3. Sort table
rtsort <directory>

# 4. Crack
rcrack <directory> -h <single_hash>
rcrack <directory> -l <hash_list_file>
rcrack <directory> -ntlm <pwdump_file>      # for NTLM hashes (Windows)

# 5. Verify
echo -n "<cracked_password>" | md5sum
echo -n "<cracked_password>" | sha1sum
```

### Supported Hash Algorithms

| Algorithm | Hash Length | Max Plaintext |
|-----------|-------------|---------------|
| `md5`     | 16 bytes    | 15 chars      |
| `sha1`    | 20 bytes    | 20 chars      |
| `sha256`  | 32 bytes    | 20 chars      |
| `ntlm`    | 16 bytes    | 15 chars      |
| `lm`      | 8 bytes     | 7 chars       |

### Common Character Sets

| Charset              | Characters                                    |
|----------------------|-----------------------------------------------|
| `numeric`            | `0–9`                                         |
| `loweralpha`         | `a–z`                                         |
| `upperalpha`         | `A–Z`                                         |
| `mixalpha`           | `a–z` + `A–Z`                                 |
| `loweralpha-numeric` | `a–z` + `0–9`                                 |
| `mixalpha-numeric`   | `a–z` + `A–Z` + `0–9`                         |
| `ascii-32-95`        | All printable ASCII characters                |

---

## Epilogue

*Spektr sent the three recovered plaintexts to Babushka at 04:17 AM. She forwarded
them to her contact at Novaya Gazeta. The fourth hash never cracked — bcrypt, it
turned out later. Someone at that office had read an RFC.*

*Yuri closed his terminals, drank the cold tea anyway, and watched the Moscow dawn
come up over the broken streetlight. The fish had been caught. The dark water was
a little less dark.*

*Two weeks later, Viktor Chernov's accountant quietly resigned.*

---

## Resources

- [RainbowCrack Official Project](http://project-rainbowcrack.com/)
- [RainbowCrack Documentation](http://project-rainbowcrack.com/documentation.htm)
- [Rainbow Table Generation Guide](http://project-rainbowcrack.com/generate.htm)
- [Kali Linux — RainbowCrack Tool Page](https://www.kali.org/tools/rainbowcrack/)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)

---

*"Hackers are not magicians. They read the manual — and then they pre-compute it."*
*— Unknown, every DEFCON since forever*
