# Ethereum State Growth: Technical & Capacity Planning Brief

**Prepared:** 2026-09-23
**Planning window:** Q4 2026 – Q3 2028
**Audience:** Infrastructure team + Finance

---

## Executive summary (read this if nothing else)

1. **No protocol change landing in your planning window will shrink your archive nodes.** The
   structural fixes people cite — state expiry, binary state trees, statelessness — are all
   research- or draft-stage with no fork assignment. Budget as if they do not exist.

2. **The dominant variable in your window is not a storage fix — it is the gas limit.**
   Glamsterdam (targeting Q4 2026) clears the path to a **200M gas limit floor, up from today's
   60M**. That is a ~3.3x increase in execution throughput. Archive growth tracks execution
   throughput.

3. **There is one genuine piece of protocol relief, and it is real:** EIP-8037 (finalized, SFI for
   Glamsterdam) puts state creation on its own gas meter priced at a fixed 1,530 gas per state
   byte, explicitly calibrated to hold **net new state growth to ~120 GiB/year even at the higher
   gas limit**. This protects your *full* nodes. It only partially protects your *archive* nodes.

4. **Net planning posture:** assume full-node state growth stays roughly flat at ~100–120 GiB/yr.
   Assume archive growth **increases materially** — plan for a step change when the gas limit
   rises, not a continuation of the current curve. Instrument now so you can replace our estimate
   with your own measurement before the money is committed.

---

## Part 1 — What is actually driving this at the protocol level

### 1.1 The data structure

Ethereum's state — every account balance, nonce, contract code, and storage slot — lives in a
**hexary Merkle Patricia Trie (MPT)**. Two properties of that design drive your costs:

- **It is a "tree of trees."** One account trie, plus a separate storage trie per contract. Every
  storage write walks two tries.
- **It is 16-ary and Keccak-hashed.** Each level of the trie stores up to 16 child hashes, so a
  proof or an update touches a wide, hash-heavy node at every level. Node overhead, not leaf data,
  is the bulk of what you store.

The practical consequence: the *logical* state (the actual balances and slots) is a fraction of the
*physical* bytes on disk. You are mostly paying to store trie internal nodes.

### 1.2 Why it only grows

There is no protocol mechanism that removes state. An account created in 2016 and never touched
since is still in the trie, still hashed into the state root, still on your disk, forever. Ethereum
Foundation researchers put the figure at roughly **80% of state untouched for more than a year**.

Gas costs are a one-time charge for a permanent, perpetual storage obligation on every node
operator in the world. That pricing mismatch is the root cause, and until Glamsterdam it was never
directly corrected.

### 1.3 Why archive nodes are a different problem from full nodes

This distinction matters more than anything else in this brief, and it is routinely conflated in
public writeups.

| | Full node | Archive node |
|---|---|---|
| Stores | Current state + recent history | Current state + **every historical state** |
| Growth driven by | **Net new** state (creations minus nothing) | **Every state write**, including overwrites |
| Helped by state expiry? | Yes | No — by definition it retains |
| Helped by history expiry? | Yes (already: 300–500 GB freed) | No |
| Helped by binary trees? | Yes, eventually | Marginally |
| Helped by EIP-8037 repricing? | Yes, directly | **Only partially** |

The reason EIP-8037 only partially helps you: it prices **state creation** — new accounts, new
storage slots. But an archive node records a diff for every *write*, including repeated writes to
slots that already exist. A high-volume DEX pool updating the same reserve slots a thousand times a
day creates near-zero new state and a thousand archive diffs. EIP-8037's ~120 GiB/yr ceiling is a
ceiling on the *former*, not the latter.

So: the protocol is about to do a good job of capping the thing that hurts full nodes, while the
thing that hurts you scales with raw transaction throughput — which is going up 3.3x.

### 1.4 Where you are today (baseline figures)

| Metric | Value | Confidence |
|---|---|---|
| Current mainnet gas limit | 60M | High |
| Geth archive (path-based, since Jan 2026) | ~1.9–2.0 TB | High |
| Erigon 3.x archive | ~1.8–2.2 TB | High |
| Reth archive | ~2.8 TB | Medium |
| Full node (EL) | ~0.9–1.3 TB | High |
| + CL | ~80–200 GB | High |
| + blobs | ~100–150 GB | High |
| Net new state growth | ~100–120 GiB/yr (~326 MiB/week at current limits) | Medium-High |

Note the Geth path-based archive mode (stores historical state as reverse diffs) cut archive from
12+ TB to ~2 TB. **If any of your fleet is still on legacy hash-based Geth archive, that migration
is the single largest cost lever available to you today and it requires no protocol change.** Caveat:
path-based archive does not yet support historical Merkle proofs (`eth_getProof` against old
blocks). If you sell proof access, that is a blocker — check it before migrating.

---

## Part 2 — What is coming to Ethereum, and how much to bank on it

Assessed against primary sources (forkcast, the EIPs repo, ACD call agendas, ethereum.org roadmap)
as of 2026-09-23. Statuses below use the EIP-7723 vocabulary: **SFI** = Scheduled for Inclusion
(barring disaster, it ships), **CFI** = Considered (not confirmed), **Draft** = written down,
means nothing about likelihood.

### 2.1 Glamsterdam — target Q4 2026, date NOT confirmed

Status: testing on devnets. **Sepolia fork scheduled 2026-10-06 13:53:36 UTC** (epoch 353024);
Hoodi provisionally 2026-10-27. Mainnet target Q4 2026, no epoch announced.

Relevant to you:

| EIP | What it does | Status | Effect on your fleet |
|---|---|---|---|
| **8037** | State creation gas cost increase. Separate "state gas" meter, CPSB = 1,530 gas/state byte. New storage slot 20k → ~97,920 gas (~5x). New account 25k → ~183,600 gas (~7x). Calibrated for ~120 GiB/yr. | **SFI**, finalized May 2026 | **Positive.** Caps full-node state growth. Partial help for archive. |
| **8038** | State-access gas cost update | **SFI** | Positive — discourages wide state reads |
| **7928** | Block-Level Access Lists — every account/slot touched per block, with post-execution values | **SFI** | **Mixed.** ~70 KiB/block added block data (~180 GB/yr if retained indefinitely). But BALs enable state reconstruction without proofs — a genuine sync-time win. Retention policy still being decided (open issues in Nethermind and alloy to tie BAL retention to the history expiry window). |
| **7732** | Enshrined PBS (headliner) | **SFI** | Neutral for storage; changes block propagation |
| **7954** | Increase max contract size | SFI | Slightly negative for state |
| **8246** | Remove SELFDESTRUCT burn | SFI | Neutral |
| **—** | **Gas limit floor 200M post-Glamsterdam** | Core dev consensus, not an EIP | **The big one.** See Part 3. |

Note Glamsterdam has already slipped once (Q3 → Q4). Devnet-6 was the last round discussed. Treat
Q4 2026 as optimistic and **Q1 2027 as the realistic planning date**.

### 2.2 Hegotá — 2027, scope still being decided

Headliners settled: **FOCIL (EIP-7805)** and **Frame Transactions (EIP-8141)**, both SFI. Scoping
is live — ACDE #245 (2026-09-10) ran the first Hegotá scoping pass against forkcast client
rankings, out of ~62 candidate EIPs, with 14 already moved to DFI.

**Nothing in the Hegotá headliner set addresses state growth.** One thing to watch:

| EIP | What | Status | Read |
|---|---|---|---|
| **8368** | CPSB recalibration for a new gas limit reference (EIP-8037 was derived against a 150M reference; a move toward 600M would need re-derivation) | **Draft — explicitly a placeholder**, values TBD | Signals core devs intend to keep re-tightening state pricing as the limit rises. Directionally good for you. Do not bank on specific numbers. |

### 2.3 The structural fixes — do NOT budget for these

| Thing | Real status | Verdict for your window |
|---|---|---|
| **Verkle trees** | **Dead as the plan.** Deprioritized 2024–25: the elliptic-curve crypto is not post-quantum secure, and ZK-compatibility concerns. Superseded. | Ignore. Any source still telling you Verkle is coming is stale. |
| **Binary state tree (EIP-7864)** | **Draft**, created Jan 2025, still Draft as of today. Unified binary tree, merges account+storage tries, code in-tree as 31-byte chunks, ~4x shorter proofs. Not a headliner for Glamsterdam or Hegotá. Not SFI or CFI anywhere. | **Not in your window.** Earliest conceivable mainnet is 2028+, and that assumes it gets picked as a headliner for a fork that has not been named. Even then, it helps proof size and full nodes — not archive retention. |
| **State expiry** | Research stage. Two competing designs ("mark, expire, revive" vs. "multi-era expiry"). No EIP with a fork assignment. | Not in your window. And **irrelevant to archive nodes regardless** — you retain by definition. |
| **Partial statelessness** | Research stage, EF Stateless Consensus team. | Not in your window. |
| **History expiry (EIP-4444)** | **Partially shipped and real.** Partial history expiry rolled out across all EL clients 2025-07-08 — drops pre-Merge bodies/receipts, frees 300–500 GB. The meta-EIP (7927) is marked Stagnant because the coordination it described is done. **Rolling** expiry (continuously shedding >1yr data) is the next step; Nethermind supports it at ~1yr/82,125 epochs, Geth's is still experimental. | **Already banked for full nodes — take it now if you have not.** Zero benefit to archive nodes. |

### 2.4 Honest confidence table

| Claim | Confidence |
|---|---|
| Glamsterdam ships with EIP-8037 and 7928 | **High** — SFI, finalized, on testnets |
| Glamsterdam reaches mainnet by end Q1 2027 | **Medium-High** |
| Glamsterdam reaches mainnet in Q4 2026 as stated | **Medium** — already slipped once |
| Gas limit reaches 200M within 12 months of the fork | **Medium-High** — it is a validator-set choice ramped gradually, not a fork parameter |
| Net new state growth stays ≤~120 GiB/yr post-fork | **Medium** — that is the design target of 8037; real behavior will differ |
| Archive growth rate increases post-gas-limit-raise | **High** (direction) / **Low** (magnitude) |
| Any structural state fix (binary tree / state expiry) on mainnet before Q3 2028 | **Low** |

---

## Part 3 — Capacity model

### The core arithmetic

Two independent effects, pulling opposite directions:

- **Net new state** (full nodes): held near flat by EIP-8037. ~100–120 GiB/yr. Plan flat.
- **Archive historical diffs**: driven by write volume per block, which scales with gas consumed.

For archive, the naive projection is "3.3x gas limit → 3.3x archive growth." That is almost
certainly too pessimistic, for three reasons: (a) the gas limit is a *ceiling*, and blocks will not
be consistently full at 200M for some time; (b) EIP-8037 makes state-creating operations 5–8x more
expensive, so the *mix* of what fills those blocks shifts away from state-heavy work; (c) much added
throughput will be calldata and compute, which produce no state diff.

**Planning recommendation — three scenarios for archive growth, from a ~600 GB/yr current run-rate
assumption (validate this against your own fleet before use):**

| Scenario | Assumption | Archive growth | 24-mo delta per node |
|---|---|---|---|
| **Low** | Gas limit ramps slowly; repricing bites hard; L2s absorb demand | 1.3x → ~780 GB/yr | +1.6 TB |
| **Base** | 200M reached H2 2027, blocks ~50% full, mix shifts off state | 2.0x → ~1.2 TB/yr | +2.4 TB |
| **High** | Fast ramp, sustained demand, write-heavy workloads | 3.0x → ~1.8 TB/yr | +3.6 TB |

**Budget the Base case; provision headroom to the High case.** The asymmetry matters: running out
of disk on an archive node mid-quarter is a resync, and a resync at 200M gas is far worse than a
resync today.

⚠️ **The run-rate figure above is an assumption, not a measurement.** It is the single input that
most affects the number you hand finance. See action A1.

### Sync time

Sync time gets worse on two axes simultaneously — more historical data to replay, and more
expensive replay per block. Partially offset by BALs (EIP-7928), which allow state reconstruction
during sync without per-item proofs. Expect the net to be roughly neutral-to-worse for archive
resync. **Plan to avoid resyncs rather than plan to absorb them.**

---

## Part 4 — Recommendations

### Immediate (this quarter, before the fork)

**A1. Instrument archive bytes-per-million-gas on your own fleet. Highest priority.**
Record daily archive DB growth against daily gas consumed. Two to four weeks of this replaces the
weakest assumption in this brief with a measured coefficient, and lets you re-run Part 3's model
with real numbers. Everything else in your budget depends on it.

**A2. Audit for legacy hash-based Geth archive nodes and migrate to path-based.**
12+ TB → ~2 TB. Largest available cost reduction, no protocol dependency, available today.
**Blocker check:** path-based archive does not yet support historical `eth_getProof`. Confirm no
customer depends on that before migrating.

**A3. Apply history expiry to every full node in the fleet.**
Shipped since July 2025 across all EL clients. 300–500 GB per node, free. If you have not done
this, it is the easiest win on the list. Archive nodes: no benefit, skip.

**A4. Right-size the archive-to-full ratio.**
Most "archive" demand is actually recent-history demand. Every workload you can move from an
archive node to a full node removes it from the 3.3x-exposed side of your fleet. Audit which
queries genuinely need pre-2024 state. This is likely your best structural hedge, because it
reduces exposure to the one variable you cannot control.

### Near-term (next 2 quarters)

**A5. Procure for the Base case with High-case headroom.**
Prefer configurations that scale storage without a full node rebuild. Rank a design that can absorb
+4 TB/node above one that is cheaper per TB but requires a resync to expand.

**A6. Test against Glamsterdam on Sepolia from 2026-10-06 and Hoodi from ~2026-10-27.**
You get roughly two months of real fork behavior before mainnet. Use it to measure actual archive
growth per gas under the new pricing. That converts A1's coefficient into a post-fork coefficient.

**A7. Track BAL retention policy.**
EIP-7928 adds ~70 KiB/block. Whether clients retain BALs indefinitely or tie them to the history
expiry window is an open decision with active issues in Nethermind and alloy. Indefinite retention
is ~180 GB/yr per node that is not in most published estimates. Worth a watch item.

### Ongoing

**A8. Do not architect around binary trees, state expiry, or statelessness.**
None have a fork assignment. If you build a cost model that assumes relief in 2027, you will be
wrong. If any of them do land, it is upside.

**A9. Re-review at each fork scoping milestone.**
Concretely: when Glamsterdam's mainnet epoch is announced; when Hegotá scoping concludes; and if
EIP-8368 gets real numbers. Check **forkcast.org** for status rather than news coverage — press
routinely conflates "proposed" with "planned."

---

## Bottom line for finance

The protocol is not going to rescue archive storage costs inside this budget cycle. What it *is*
going to do is triple execution throughput, and archive storage scales with throughput. Ethereum
core developers are aware of the state problem and have shipped their first real correction
(EIP-8037) — but that correction is aimed at keeping ordinary validators viable, not at keeping
archive operators cheap.

**Plan for archive storage cost per node to roughly double over 24 months, with a credible path to
tripling.** The controllable levers are not protocol-side: they are the path-based archive
migration (A2), history expiry on full nodes (A3), and shrinking how much of the fleet needs to be
archive at all (A4). Those three are where the money is.

---

## Sources

Protocol status verified 2026-09-23 against:

- [forkcast.org](https://forkcast.org) — fork status, CFI/SFI tracking
- [Glamsterdam roadmap — ethereum.org](https://ethereum.org/roadmap/glamsterdam/) — official status "Testing on devnets", Q4 2026 target, SFI list
- [EIP-8037: State Creation Gas Cost Increase](https://eips.ethereum.org/EIPS/eip-8037) — CPSB 1,530 gas/byte, repricing figures
- [EIP-8368: CPSB Recalibration for New Gas Limit](https://eips.ethereum.org/EIPS/eip-8368) — Draft/placeholder
- [EIP-7864: Ethereum state using a unified binary tree](https://eips.ethereum.org/EIPS/eip-7864) — Draft, created 2025-01-20
- [EIP-7773: Glamsterdam meta EIP](https://eips.ethereum.org/EIPS/eip-7773) — full scheduled list
- [EIP-7927: History Expiry Meta](https://eips.ethereum.org/EIPS/eip-7927) — Stagnant
- [EIP-7928: Block-Level Access Lists](https://eips.ethereum.org/EIPS/eip-7928) — ~70 KiB/block
- [ACDE #245 agenda, 2026-09-10 (ethereum/pm#2211)](https://github.com/ethereum/pm/issues/2211) — Hegotá scoping pass
- [EF: state bloat warning](https://www.theblock.co/post/383156/ethereum-foundation-researchers-warn-of-storage-burden-from-state-bloat) — 80% state untouched >1yr; expiry/archive/partial-statelessness proposals
- [Partial history expiry announcement — EF blog, 2025-07-08](https://blog.ethereum.org/2025/07/08/partial-history-exp) — 300–500 GB freed
- [Glamsterdam final devnet, 200M gas target — The Defiant](https://thedefiant.io/news/blockchains/ethereum-glamsterdam-final-devnet-200m-gas-limit-target)
- [Sepolia fork date 2026-10-06 — Parameter](https://parameter.io/ethereums-glamsterdam-testnet-launch-set-for-october-6-amid-builder-auction-risk)
- [Hegotá headliners: FOCIL + EIP-8141](https://www.spotedcrypto.com/ethereum-hegota-2027-focil-eip-8141/)
- [Archive node disk sizes 2026 — 7BlockLabs](https://www.7blocklabs.com/blog/ethereum-archive-node-disk-size-2026-vs-erigon-archive-node-disk-size-2026-vs-geth-full-node-disk-size-2026)
- [BAL retention should follow history expiry window — NethermindEth/nethermind#13553](https://github.com/NethermindEth/nethermind/issues/13553)

Figures marked Medium/Low confidence, and all of Part 3's scenario arithmetic, are projections —
not sourced measurements. Replace them with fleet data per A1 before committing budget.
