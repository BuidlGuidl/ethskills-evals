# Ethereum State Growth: Technical & Capacity-Planning Brief

**Date:** 23 September 2026
**Audience:** infrastructure team + finance
**Planning window:** Q4 2026 – Q3 2028 (~18–24 months)

---

## 0. Executive summary

**The headline for finance is counter-intuitive: the protocol changes that are actually
landing in our planning window will make our disk growth *faster*, not slower.**

Ethereum's state-growth fixes (the EIP-8037 repricing cluster in the Glamsterdam upgrade,
expected Q4 2026) are not being built to shrink node storage. They are being built to put a
*ceiling* on state growth so that the gas limit can be raised from today's 60M toward
100–200M. A bounded growth rate at 3x the throughput is still more bytes per year than an
unbounded growth rate at 1x throughput.

The changes that genuinely *reduce* footprint — statelessness, binary trees (EIP-7864),
state expiry — are research-phase with no fork assignment and will **not** land inside 24
months. Anyone telling you otherwise is reading marketing copy, not All Core Devs notes.

**Planning guidance:**

| Item | Guidance |
|---|---|
| Per-archive-node disk growth, today (60M gas) | Budget **0.6–0.9 TB/node/year** |
| Per-archive-node disk growth, if gas limit reaches 150M in window | Budget **1.5–2.2 TB/node/year** |
| Live state growth (protocol-level) | ~30–120 GiB/yr today; EIP-8037 targets a **120 GiB/yr ceiling** at 150M gas |
| Procurement horizon | **12–18 month increments**, not 3–5 year. Buy expandable chassis, not maxed drives |
| Relief from protocol changes inside window | **Assume zero.** Any relief is upside, not a line item |
| Biggest single budget variable | **The gas limit**, not state-growth research |
| Sleeper cost | **Blob archival** — 4.5 TiB/yr today, potentially ~10 TiB/yr if blob targets rise as planned |

---

## 1. What is actually driving this at the protocol level

### 1.1 Four distinct growth vectors — do not conflate them

Most "state growth" discussion mixes up things with very different cost curves. Our budget
should track them separately.

| Vector | What it is | Growth shape | Can protocol relieve it? |
|---|---|---|---|
| **(a) Live state** | Current account balances/nonces/code + contract storage slots | Monotonic, cumulative | Yes — repricing (now), expiry (someday) |
| **(b) Chain history** | Blocks, transactions, receipts | Linear with throughput | Yes — EIP-4444 (partial done, rolling pending) |
| **(c) State history** | The per-block diffs / historical tries that make a node an *archive* node | Linear with throughput, and this is **our** dominant cost | Only indirectly |
| **(d) Blob sidecars** | EIP-4844 / PeerDAS data | Rolling 18-day window for consensus; **unbounded if we archive it** | No — retention is deliberately capped at 4096 epochs |

For a company running archive nodes, **(c) is the line item that hurts**, and it is the one
the protocol roadmap addresses *least*. State expiry and statelessness target (a). EIP-4444
targets (b). Nothing on the roadmap shrinks (c), because (c) is definitionally the data
nobody else is required to keep — which is also why we can charge for it.

### 1.2 Why live state grows the way it does

Ethereum's world state is a **hexary Merkle Patricia Trie (MPT)**, keccak-hashed, with a
separate storage trie per contract account. Three structural properties drive cost:

1. **Nothing is ever deleted by the protocol.** A storage slot written once persists
   forever unless explicitly zeroed by the contract. `SELFDESTRUCT` was effectively
   neutered in Cancun, so there is no bulk-removal path. Historically, `SSTORE` on a fresh
   slot cost 20,000 gas — a one-time payment for permanent, replicated, forever storage
   across every node on Earth. That price has always been far too low, and that
   mispricing *is* the root cause.

2. **Contract storage dominates.** Current measurements put the split at roughly
   **81.7% contract storage, 14.1% accounts, 4.3% bytecode**. Within that, ERC-20 balance
   mappings (~27% of state) and ERC-721 ownership mappings (~22%) are the largest single
   contributors. L2 bridges are under 2% — the bloat is token contracts, not rollups.

3. **Write amplification.** Every logical 32-byte slot write dirties a path of internal
   trie nodes from leaf to root. At ~64 nibbles of depth in a hexary trie, one slot write
   can touch a dozen-plus internal nodes. The average *on-disk* cost has been measured at
   ~191 bytes per storage slot and ~134 bytes per account — well above the logical size.

**Current size — with an honest caveat.** Published figures disagree because they measure
different things. Paradigm's analysis put live state at **245.5 GiB** (flat/logical
encoding) growing at **2.62 GiB/month**, annualising to **31–72 GiB/yr** depending on the
window chosen. Other 2026 measurements report **~390 GiB**, almost certainly including
trie-node overhead and DB slack. EIP-8037's own rationale projects **~387 GiB/yr** of state
growth at a 200M gas limit under *current* pricing. Treat any single number as
measurement-convention-dependent; the useful fact is that **growth scales roughly linearly
with the gas limit**, and the gas limit is about to move a lot.

### 1.3 Why sync times get worse every year, specifically

Sync degradation is **not** primarily a bandwidth or capacity problem — it is a **random-read
IOPS and write-amplification** problem:

- Trie traversal is keccak-keyed, so access is uniformly random across the keyspace. There
  is no locality to exploit. As state grows, the working set exceeds page cache and every
  lookup becomes a device round-trip.
- Snap sync must heal a *moving* state root — the longer the download takes, the more
  the state has moved, which lengthens the heal phase. This is superlinear in state size.
- LSM-tree compaction (Pebble/MDBX) amplifies every logical write into multiple physical
  writes, so sync throughput is gated by sustained write IOPS and SSD endurance.

Practical consequence: **sync time tracks drive IOPS and state size, not drive capacity.**
Buying bigger, slower drives makes syncs worse. This matters for our hardware spec.

### 1.4 Why our archive nodes are big specifically

An archive node stores the state *at every historical block*, not just the tip. Modern
clients no longer do this by retaining every historical trie node (the old Geth hash-based
scheme, which is why those nodes hit 12–20 TB). Instead they store a **flat current state
plus a log of reverse diffs**, reconstructing historical state on demand. That is the single
biggest efficiency win of the last two years and it has already been banked (see §2.1).

The residual cost is that the diff log grows **linearly with transaction throughput
forever**. Raise the gas limit 3x and the diff log grows 3x faster. There is no proposal on
the roadmap to change this.

---

## 2. What is coming — and what we can bank on

Confidence ratings below are mine, based on fork scoping status as of today.

### 2.1 Already landed (bank it — much of it we may not have fully exploited)

| Change | Status | Effect on us |
|---|---|---|
| **Partial history expiry (EIP-4444 phase 1)** | Live. "Drop day" 1 May 2025; all EL clients shipped support by July 2025 | **−300 to −500 GB per node.** Pre-Merge block bodies and receipts can be dropped. Headers still served over devp2p. **Action: confirm every node in our fleet has this enabled — this is free money if any haven't.** |
| **Geth path-based archive (v1.16, Jan 2026; v1.17)** | Live | Archive footprint **~2 TB** (from 12–20 TB hash-based). Sync ~2 weeks. `--history.state=0` + `--gcmode=archive`. State history can go on cheap/HDD tier via `--datadir.ancient`. |
| **Geth v1.17 historical proofs** | Live | `--history.trienode=N` restores historical `eth_getProof`. **But** retaining trie nodes takes the node from ~2 TB to ~**6.5 TB**. This is a ~4.5 TB/node premium — see recommendation R2. |
| **Erigon 3 archive** | Live | **1.8–2.2 TB** archive footprint. Currently the smallest. |
| **Reth archive** | Live | **~2.8 TB** archive footprint. |
| **Fusaka (3 Dec 2025)** | Live | PeerDAS + gas limit raised to **60M** (EIP-7935). Blob capacity stepped up via BPO forks: 15 max (17 Dec 2025), then **21 max / 14 target (7 Jan 2026)**. |

### 2.2 Glamsterdam — high confidence, lands inside the window

**Status: devnet testing. Sepolia fork scheduled 6 October 2026. Mainnet "expected Q4 2026,
date not yet confirmed." Hoodi and mainnet timestamps still pending client-team decision.**

Note the slip history: this was originally targeted H1 2026, then "end of August 2026"
internally, and has repeatedly moved because **ePBS (EIP-7732) is harder than anticipated**
— the EF's own April 2026 checkpoint said progress was "slower than hoped." **Plan for Q4
2026 with meaningful probability of Q1 2027.**

The state-relevant contents (18 EIPs scheduled for inclusion under meta-EIP-7773; the
state-growth cluster is the part that matters to us):

| EIP | What it does | Relevance |
|---|---|---|
| **EIP-8037 — State Creation Gas Cost Increase** | The big one. Fixed **cost per state byte (CPSB) = 1,530 gas**, with a separate `state_gas_reservoir` dimension alongside execution gas. New account: 25,000 → **183,600** (~7x). New storage slot: 20,000 → **97,920** (~5x). 24 kB contract deploy: ~4.95M → **~37.8M** (~8x). **Targets 120 GiB/yr state growth at a 150M gas reference limit**, vs ~387 GiB/yr at 200M under current pricing. | **This is the state-growth fix.** It is a price ceiling, not a reduction. |
| **EIP-8038 — State-access gas cost update** | Companion repricing of reads | Supports higher gas limit |
| **EIP-7976 — Calldata floor to 64 gas/byte** | Caps worst-case block size | Bounds history growth |
| **EIP-7981 — Access list data-footprint pricing** | Caps worst-case block size | Bounds history growth |
| **EIP-7778 — Block gas accounting without refunds** | Refunds no longer count toward block limit | Makes block size predictable |
| **EIP-7928 — Block-Level Access Lists (BALs)** | Declares state touched by a block up front, enabling parallel execution | **Adds tens of KB per block to block size** → history grows faster. Also a genuinely useful index for our ETL — see R6 |
| **EIP-7732 — ePBS** | Enshrined proposer/builder separation; extends propagation window ~2s → ~9s | The schedule risk for the whole fork |
| **EIP-7708 — ETH transfers emit a log** | Plain ETH transfers now produce logs | **Direct hit on our pipelines**: log/receipt volume increases materially, receipt DB grows, and any indexer that infers ETH flows from traces should be revisited. See R7 |
| **EIP-2780 — Resource-based intrinsic transaction gas** | The 21,000-gas floor assumption changes | Breaks tooling that hardcodes 21,000 |
| **EIP-7954 — Increase max contract size** | Larger contracts permitted | Mild upward pressure on bytecode state |
| **EIP-8246 — Remove SELFDESTRUCT burn** | Cleanup | Minor |

**Confidence: HIGH that Glamsterdam ships in the window. MEDIUM on Q4 2026 specifically.
Scope is frozen but EIP-7773 is still Draft and can move.** One live scope risk:
**EIP-8372 (Normalized state gas limit)** is a Draft that *modifies* EIP-8037 — it retunes
CPSB and rebalances the state-gas share of the block so state-gas and execution-gas fill at
similar rates. It was updated as recently as this month. If it lands, the effective CPSB and
therefore the real-world growth ceiling will differ from the numbers above.

**What Glamsterdam does NOT do: it does not reduce anyone's disk usage.** It caps the
*rate* of future live-state growth so the gas limit can rise.

### 2.3 The gas limit — the actual budget driver

- Today: **60M** (raised from 30M during 2025).
- EF's stated 2026 priority: raise "toward and beyond **100M**."
- Glamsterdam's repricing cluster is explicitly framed as clearing the path to a **200M**
  gas limit floor, with EIP-8037 providing the "sustainability ceiling" that makes 200M
  safe from a database-growth perspective.

The gas limit is set by **validator signalling**, not by a hard fork. It can move at any
time, in either direction, without an upgrade. It is the single most important input to our
capacity model and the one with the least schedule certainty.

**Model it explicitly.** Our archive disk growth is approximately linear in average gas
limit. A move from 60M to 150M is a ~2.5x increase in our per-node annual disk burn — far
larger in absolute TB than anything EIP-8037 saves us.

### 2.4 Aspirational — do NOT budget on any of this

| Item | Real status | Verdict |
|---|---|---|
| **Rolling history expiry (full EIP-4444)** | "Work continues." Not scoped to Glamsterdam. No fork assignment. Depends on Portal Network / distributed history maturity | **MEDIUM-LOW** in window. Would be a meaningful win for full nodes; **near-zero win for us**, since we are the ones who keep history |
| **Binary state tree (EIP-7864)** | Displaced Verkle as the plan of record during 2026, redesigned around quantum-safe binary hash trees. EF says "final approach yet to be confirmed." Research phase | **~ZERO** chance inside 24 months. Also note: a tree migration would be a *massive* one-off operational event for us when it does come |
| **Statelessness** | Depends on the tree change. EF language: "research phase… expected to ship several years from now, with no guarantee" | **ZERO** in window |
| **State expiry** | EF researchers published three directions in 2026 — mark-expire-revive, multi-era expiry, "state archive," partial statelessness. EF explicitly prioritising "practical efforts that can deliver benefits today" over shipping expiry | **ZERO** in window |
| **Hegotá (fork after Glamsterdam, H2 2026 → realistically 2027)** | Headliner is **FOCIL** (censorship resistance) with account abstraction as minor scope. **Not a scaling or state fork.** | **Correct several secondary sources here:** multiple outlets claim Hegotá ships state expiry and/or Verkle trees. It does not. Its only CFI item was FOCIL |

The one genuinely encouraging signal for us: the EF's state-bloat work explicitly names
**"state archive" — separating hot state from historical data so node performance stays
stable as history grows** — and frames archive tooling and RPC improvements as
"immediately useful and forward-compatible." That is aimed at our exact workload, but it is
exploratory work with no deployment dates.

Grounding fact worth keeping in mind: **~80% of Ethereum state has not been accessed in over
a year.** That is the prize state expiry is chasing, and it is why the idea will not die —
but it is also why it is hard, because revival semantics have to be designed and every
contract in existence has to keep working.

---

## 3. The capacity model

### 3.1 Recommended planning formula

```
archive_disk(t) = current_measured
                + (annual_increment_at_60M × gas_limit_multiplier × years)
```

Where `annual_increment_at_60M` should be **measured on our own fleet**, not taken from this
document. Instrument `dB/dt` per node per client and feed the real number in. Published
numbers vary by client, config, and measurement convention by more than 2x.

As a starting prior until we have our own numbers:

| Scenario | Avg gas limit over window | Per-node archive growth | 24-month delta/node |
|---|---|---|---|
| **Low** — gas limit stays 60M, Glamsterdam slips to 2027 | 60M | 0.6–0.9 TB/yr | **1.2–1.8 TB** |
| **Base** — Glamsterdam Q4 2026, limit ramps to ~100M | ~85M | 0.9–1.3 TB/yr | **1.8–2.6 TB** |
| **High** — aggressive ramp toward 200M post-Glamsterdam | ~150M | 1.5–2.2 TB/yr | **3.0–4.4 TB** |

Starting footprints for sizing: Erigon 3 ≈ 1.8–2.2 TB, Geth path-archive ≈ 2 TB
(≈ 6.5 TB with trie nodes retained), Reth ≈ 2.8 TB. A full (non-archive) node is
0.9–1.3 TB EL + 80–200 GB CL + 100–150 GB blobs.

**Plan to the High scenario for chassis/expansion capability, and to the Base scenario for
drive purchases.** Being wrong upward costs us an emergency migration; being wrong downward
costs us idle capital.

### 3.2 Blobs — the line item most likely to surprise us

Consensus clients retain blobs for **4096 epochs (~18 days)** and then prune. That is a
bounded rolling cost, and PeerDAS means a normal node custodies only a subset of columns
(full-custody "supernodes" carry everything).

**But if we are selling historical blob data, we have to archive it ourselves, and that cost
is unbounded and large:**

- At today's **target of 14 blobs/block**: 14 × 128 KiB × 7200 blocks/day ≈ **12.3 GiB/day
  ≈ 4.5 TiB/year**.
- At the **max of 21**: ≈ 6.7 TiB/year.
- Blob capacity is planned to keep rising via BPO forks — figures around **48 blobs** have
  been discussed for mid-2026 onward. At a 32-blob target that is **~10 TiB/year**.

**This can exceed our entire archive-node storage growth.** It needs an explicit
product decision (§4, R5) and it belongs on cheap object storage, not NVMe.

---

## 4. Recommendations

### R1 — Treat the gas limit as the budget's primary input, and instrument it
Rebuild the capacity model as `$/TB × TB/node/month`, with **average gas limit as an
explicit, stated input assumption**. Put a dashboard on the network gas limit and re-forecast
whenever the 30-day average moves more than 15%. Tell finance the forecast is a function of
a variable that can change without a hard fork.

### R2 — Standardise on flat-state archive; ration trie-node retention
Every archive node should be Erigon 3, Geth ≥ v1.17 path-based, or Reth. If any legacy
hash-based Geth archive nodes remain, migrating them is the single largest one-off saving
available to us (12–20 TB → ~2 TB).

Critically: **`--history.trienode` costs ~4.5 TB/node** (2 TB → 6.5 TB). Historical
`eth_getProof` should be served by a **small dedicated pool**, not by the general archive
fleet. Audit what fraction of our request volume actually needs historical proofs before
provisioning it broadly.

### R3 — Buy in 12–18 month increments, and buy expandability
Given Glamsterdam's date is unconfirmed and the gas-limit ramp is the dominant unknown,
long-horizon capacity purchases are a bet on a variable we cannot forecast. Prefer chassis
with **free NVMe bays / JBOF expansion** over fewer, larger drives. Incremental
expansion is cheaper than a wrong 3-year bet in either direction.

### R4 — Spec for IOPS and endurance, not capacity; use tiered storage
Sync time and query latency track **random-read IOPS**; sync and compaction burn **write
endurance (DWPD)**. Do not solve growth by buying bigger slower drives.

Exploit the tiering the clients now offer: **flat/live state on fast NVMe; state history and
ancients on cheap bulk storage** (Geth `--datadir.ancient`; access there is largely
sequential and Geth explicitly supports HDD for it). This is the cheapest lever we have and
it is available today.

### R5 — Make an explicit decision on blob archival, now
Rolling 18-day custody is bounded and cheap. Permanent blob archival is **4.5 TiB/yr today,
potentially ~10 TiB/yr** as blob targets rise. Decide whether historical blob data is a
product. If yes, budget it separately, on object storage, with a defined retention policy —
do not let it accrete onto archive nodes by accident.

### R6 — Extract once, serve many
Our archive nodes should be **ETL sources feeding our own columnar store**, not
general-purpose query endpoints. Most customer queries hit a recent window; a tiered
architecture (recent-window full nodes + a small deep-archive pool + cold object storage)
decouples our per-query cost from total chain history. This is also the only architecture
that stays sane if a binary-tree migration eventually forces a full re-sync of the fleet.

Opportunistically: **BALs (EIP-7928) give us a per-block map of exactly which state a block
touched, for free.** That is a genuinely useful index for building diff-based pipelines and
for hot/cold tiering decisions. Worth a design spike once Glamsterdam hits Sepolia.

### R7 — Start Glamsterdam compatibility testing on Sepolia from 6 October 2026
This is a dated, actionable commitment. Glamsterdam breaks assumptions our pipelines almost
certainly encode:
- **EIP-7708** — ETH transfers emit logs. **Receipt/log volume rises materially**; storage
  and indexing costs rise with it; any ETH-flow logic derived from traces should be
  revisited. Model the receipt-DB growth before the fork, not after.
- **EIP-2780 / EIP-7778** — the 21,000-gas intrinsic floor and refund-based gas accounting
  both change. Anything that hardcodes these breaks.
- **EIP-8037** — two-dimensional gas. The `GAS` opcode reports only `gas_left`, and
  **observed gas can appear to increase** after a state operation as the reservoir refills.
  Any gas-accounting analytics or simulation tooling we run will produce wrong numbers
  unless updated.
- **EIP-7732 (ePBS)** — block structure and the propagation model change; anything consuming
  blocks at the p2p layer needs review.

### R8 — Prefer snapshot/restore over re-sync, and hold spare capacity
A Geth path-archive sync is **~2 weeks**. At fleet scale, re-syncing is an outage, not a
maintenance task. Maintain a tested datadir snapshot/restore path and keep enough spare
capacity to stand up a replacement node from snapshot rather than from the network.

### R9 — Budget zero relief from the long-term roadmap
Binary trees, statelessness and state expiry should appear in our financial model as
**upside, not as a line item**. If we tell finance that state growth gets solved in this
window, we will be wrong, and the credibility cost is worse than the capex.

---

## 5. Watch list — specific signals that should trigger a re-forecast

| Signal | Where to watch | Why it matters |
|---|---|---|
| Glamsterdam mainnet timestamp confirmed | EIP-7773 status; ACD calls | Sets the date for EIP-8037 and the gas-limit ramp |
| Sepolia Glamsterdam fork, **6 Oct 2026** | Testnet | First real data on post-8037 growth; start our compat testing |
| EIP-8372 promoted from Draft | EIPs repo | Would retune CPSB and change the effective growth ceiling |
| Network gas limit 30-day average | Any gas tracker | **The dominant budget variable** |
| Further BPO forks / blob target increases | ACD | Directly scales blob archival cost |
| Rolling history expiry gets a fork assignment | ACD | Would relieve full nodes; changes what data is scarce and therefore what we can charge for |
| EIP-7864 binary tree gets a fork assignment | ACD | Would mean a full fleet re-sync/migration — an event to plan years ahead |
| EF "state archive" work producing shippable tooling | EF blog / research calls | Aimed directly at our workload |

---

## 6. Caveats on the numbers in this brief

- **Live-state size figures genuinely conflict across sources** (245.5 GiB vs ~390 GiB)
  because they measure different things — logical/flat encoding vs on-disk including trie
  overhead. Growth-rate figures vary similarly. Our own fleet telemetry should override
  every number here.
- EIP-8037's repricing values (CPSB 1,530; 120 GiB/yr target at 150M reference) are from the
  EIP text and are **subject to change before mainnet**, particularly via EIP-8372.
- Glamsterdam's mainnet date is **not confirmed**. Its scope is frozen but EIP-7773 remains
  Draft.
- Client archive footprints move with every release; re-measure before any purchase.

---

## Sources

- [Glamsterdam (EIP-7773) — scheduled EIP list](https://eips.ethereum.org/EIPS/eip-7773)
- [EIP-8037: State Creation Gas Cost Increase](https://eips.ethereum.org/EIPS/eip-8037)
- [EIP-8372: Normalized state gas limit](https://eips.ethereum.org/EIPS/eip-8372)
- [Glamsterdam | ethereum.org roadmap](https://ethereum.org/roadmap/glamsterdam/)
- [Protocol Priorities Update for 2026 | Ethereum Foundation](https://blog.ethereum.org/2026/02/18/protocol-priorities-update-2026)
- [Checkpoint #9: Apr 2026 | Ethereum Foundation](https://blog.ethereum.org/2026/04/10/checkpoint-9)
- [Partial history expiry announcement | Ethereum Foundation](https://blog.ethereum.org/2025/07/08/partial-history-exp)
- [Fusaka Mainnet Announcement | Ethereum Foundation](https://blog.ethereum.org/2025/11/06/fusaka-mainnet-announcement)
- [How to Raise the Gas Limit, Part 1: State Growth | Paradigm](https://www.paradigm.xyz/writing/how-to-raise-the-gas-limit-1)
- [Archive mode | go-ethereum docs](https://geth.ethereum.org/docs/fundamentals/archive)
- [Statelessness, state expiry and history expiry | ethereum.org](https://ethereum.org/roadmap/statelessness/)
- [EF researchers warn of storage burden from 'state bloat' | The Block](https://www.theblock.co/post/383156/ethereum-foundation-researchers-warn-of-storage-burden-from-state-bloat)
- [Ethereum execution clients implement history pruning under EIP-4444 | The Block](https://www.theblock.co/post/361722/ethereum-execution-clients-history-pruning)
- [Glamsterdam enters final devnet phase with 200M gas-limit target | The Defiant](https://thedefiant.io/news/blockchains/ethereum-glamsterdam-final-devnet-200m-gas-limit-target)
- [Ethereum core devs pin 'Hegota' upgrade on 2026 roadmap | Bankless](https://www.bankless.com/read/news/ethereum-core-devs-pin-hegota-upgrade-on-2026-roadmap)
- [EIP-7864: Ethereum state using a unified binary tree | Fellowship of Ethereum Magicians](https://ethereum-magicians.org/t/eip-7864-ethereum-state-using-a-unified-binary-tree/22611)
- [Comparing archive node disk sizes 2026 | 7BlockLabs](https://www.7blocklabs.com/blog/ethereum-archive-node-disk-size-2026-vs-erigon-archive-node-disk-size-2026-vs-geth-full-node-disk-size-2026)
