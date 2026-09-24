# Ethereum State Growth: Technical & Capacity-Planning Brief

**Prepared:** 2026-09-23
**Audience:** infrastructure team + finance
**Planning window:** Q4 2026 → Q3 2028 (~24 months)

**Bottom line up front.** Protocol-level relief for state growth is real but is *not*
arriving inside your planning window. The one change that lands in the window —
Glamsterdam's state-creation repricing (EIP-8037) — bends the growth *rate*, it does not
shrink anything you already store. The structural fix (replacing the state tree) is
explicitly scheduled to *begin* in the fork after next-next, i.e. at or past the edge of
this window. Meanwhile the block gas limit is on a path from 60M toward 100M–200M, which
pushes growth the other way. **Plan for continued growth; harvest the savings that are
available today at the client/storage layer, not from the protocol.**

The largest single lever available to you right now is not a protocol change at all: it is
migrating archive nodes to the path-based/diff-based archive schemes shipped by Geth (Jan
2026), Erigon 3, and Reth, which take a mainnet archive from the old ~12–20 TB hash-based
footprint to roughly **2 TB**. If any of your archive fleet is still on legacy hash-based
Geth archive, that is a ~10x reduction available this quarter with no protocol dependency.

---

## 1. What is actually driving this at the protocol level

### 1.1 The state, and why its shape is the problem

Ethereum's "state" is the current set of account balances, nonces, contract code, and
contract storage slots. It is committed to in a **hexary Merkle Patricia Trie (MPT)**,
actually two nested tries:

- an **account trie**, keyed by `keccak256(address)`, and
- a **separate storage trie per contract**, keyed by `keccak256(slot)`.

Four properties of that design are what you are paying for:

1. **Hexary branching + keccak hashing.** Each trie node has up to 16 children, so a proof
   or a path to a leaf touches many intermediate nodes. Node count and proof size are both
   much larger than a binary tree would give.
2. **Hashed keys destroy locality.** Because keys are `keccak` of the address/slot,
   logically related data (one contract's slots, one user's accounts) is scattered
   uniformly across the keyspace. Every state read is close to a random read against a
   multi-hundred-GB working set. This is why state access — not raw capacity — is what
   actually caps your throughput and why NVMe with high random IOPS is non-negotiable.
3. **Per-contract storage tries.** Each contract with storage carries its own trie and its
   own root, which multiplies node overhead for state-heavy contracts.
4. **State is append-mostly and never expires.** A storage slot written in 2017 by a dead
   contract is still in the trie today, still on your disks, still costing you IOPS on
   every reorg/range query that touches its neighbourhood. There is no protocol mechanism
   that removes it.

On top of that, the gas schedule has historically **underpriced state creation relative to
its permanent cost**: 20,000 gas to create a storage slot and 32,000 to deploy a contract
were set when the state was tiny and have never been raised to reflect the fact that the
cost is borne forever by every node operator. That mispricing is the economic root cause,
and it is the thing Glamsterdam finally addresses (§2.1).

### 1.2 Why *archive* nodes are a different and worse problem

A full node stores one state — the current one — plus recent history. An archive node must
answer "what was the state at block N" for all N. The naive implementation (legacy
hash-based Geth archive) keeps **every trie node ever produced**, keyed by hash, forever.
That grows superlinearly in the worst way: every block that touches an account rewrites the
whole path from leaf to root, so you persist ~8–10 new nodes per touched account per block,
permanently.

This is the single biggest reason archive disk has been growing faster than the state
itself, and it is also why the fix (§3.1) is a storage-layer fix rather than a protocol one:
the *protocol* does not require you to store history that way.

### 1.3 Current numbers (treat as order-of-magnitude, verify against your own fleet)

Public figures in 2026 are inconsistent because different sources measure different things
(raw state trie vs. flat state vs. total execution-client disk). The ones I'd anchor on:

| Quantity | Figure | Note |
|---|---|---|
| Live state size | ~360–390 GiB (mid-2026) | The state trie/DB itself |
| State growth rate | ~326 MiB/week at 60M gas limit | Up from ~105 MiB/week pre-gas-limit-raise — note the ~3x |
| Total execution full-node disk | ~0.9–1.3 TB (Jan 2026 baseline) | Includes history and indices |
| Total full-node disk growth | ~7–8 GiB/week | Dominated by history/receipts, not state |
| Archive node, modern clients | ~1.8–2.2 TB | Geth path-based (from Jan 2026), Erigon 3, Reth |
| Archive node, legacy Geth hash-based | 12–20 TB | The thing to get off of |

The most important number in that table is the growth-rate jump from ~105 to ~326 MiB/week
when the gas limit went 30M → 60M. **State growth scales roughly with the gas limit**, and
the gas limit is going up (§2.4). That is the dominant term in your 24-month forecast — far
more than any protocol relief.

---

## 2. What is coming to Ethereum itself, and how much to bank on it

Methodology note: statuses below are from the EIP repository, the Glamsterdam meta EIP
(EIP-7773), and the Ethereum Foundation's September 2026 protocol-priorities post. Roadmap
diagrams and older blog posts are aspirational and routinely go stale — e.g. **Verkle trees,
which were the state-tree plan for years, were dropped** in favour of binary trees over
ZK-compatibility and post-quantum concerns. Anything below that is not marked "Scheduled for
Inclusion" should not appear in a budget.

### 2.1 In the window, high confidence: Glamsterdam (~Dec 2026)

Glamsterdam is in late-stage testing: Sepolia fork targeted **6 October 2026**, Hoodi to
follow, mainnet discussed for **December 2026**. Mainnet slot is not yet fixed. Scope is
frozen at 18 SFI EIPs (EIP-7773). Realistically: high confidence it lands in the window;
moderate confidence on December specifically; Q1 2027 slip is unremarkable and would not
change your plan.

Relevant to you:

- **EIP-8037 — State Creation Gas Cost Increase (SFI).** *This is the state-growth EIP.*
  It introduces a two-dimensional execution/state gas model with a fixed cost per state
  byte (`CPSB = 1,530`) and a separate "reservoir" for state gas above `TX_MAX_GAS_LIMIT`.
  Headline repricings:
  - `GAS_CREATE`: 32,000 → 183,600 state gas (~5.7x; ~10x on full contract deployment)
  - `GAS_NEW_ACCOUNT`: 25,000 → 183,600 state gas (~8.5x)
  - `GAS_STORAGE_SET` (0→non-zero): 20,000 → 97,920 state gas (~4.9x)

  **What this does for you:** it makes state creation materially more expensive, which is
  what allows the gas limit to rise without state growth rising proportionally. **What it
  does not do:** shrink existing state, or reduce it at all. Model it as *rate suppression
  that partly offsets the gas limit increase* — not as a saving.

- **EIP-7928 — Block-Level Access Lists (SFI, EL headliner).** Blocks declare the state
  they touch, enabling parallel disk prefetch and parallel execution. Good for your
  *access* pain (sync speed, execution latency) and a prerequisite for raising the gas
  limit further. Neutral-to-negative on disk.

- **EIP-2780 / EIP-8038 — intrinsic-cost decomposition and state-access repricing (SFI).**
  Broader gas harmonisation; secondary effects on your workload mix.

- **EIP-7708 — ETH transfers emit a log (SFI). Direct impact on an Ethereum data company,
  and it cuts both ways.** Value-transferring `CALL`s and `SELFDESTRUCT` will emit logs.
  Upside: you can stop re-executing transactions / pulling call traces just to reconstruct
  ETH flows — a significant reduction in trace workload and potentially in what you need
  archive nodes *for*. Downside: log and receipt volume goes up materially, and receipts
  are already the dominant term in full-node disk growth. **Budget for a step change in
  log/receipt storage and index size at Glamsterdam, and plan a project to retire
  trace-based ETH-flow extraction in favour of logs.**

- **EIP-7745 — trustless log index.** Reworks in-protocol log indexing (`eth_getLogs`
  efficiency + provability). Was pursued as a non-headliner for Glamsterdam but is **not**
  in the final 18-EIP SFI set, and client assessments flagged undefined syncing and
  non-standard SSZ usage. Treat as not landing in this window.

- **EIP-8246 — remove SELFDESTRUCT ETH burn; EIP-8024 — SWAPN/DUPN/EXCHANGE.** Minor for
  you; note only if you have accounting code keying off the burn edge case.

### 2.2 In the window, medium confidence: Hegotá (~2027)

Next fork after Glamsterdam. Confirmed headliners: **EIP-7805 (FOCIL)** on consensus and
**EIP-8141 (Frame Transaction)** on execution. Neither is a state-growth measure. History
and state expiry work has been floated for Hegotá but is not scheduled. **Do not bank on
Hegotá for storage relief.**

Timing: the EF describes an *aggressive* cadence of ~7.2 months per fork (Glamsterdam Dec
2026 → L* Dec 2029) and a *contingency* cadence of 12 months. Under the aggressive case
Hegotá is mid-2027; under the contingency case, Dec 2027. Both are inside your window; the
content still doesn't help your disks.

### 2.3 Outside the window (do not budget for it): the state tree replacement

This is the change that would structurally fix state growth and state access, and it is the
one most likely to be mis-sold to you as imminent.

- **EIP-7864 — unified binary state tree.** Replaces the hexary keccak MPT with a single
  binary tree merging accounts, storage, and code under 32-byte keys; ~75% smaller Merkle
  proofs, 3–4x fewer branches. Hash function still undecided (BLAKE3 in the draft, Poseidon2
  mooted). **Status: Draft. Not CFI or SFI for any fork.** Created January 2025.
- **EIP-7748 — state conversion.** The block-by-block migration of MPT data into the new
  tree. **Status: Draft, with `CONVERSION_START_TIMESTAMP` and `CONVERSION_STRIDE` still
  marked TBD, and the conversion-duration estimate still a TODO in the spec.** An EIP whose
  central parameters are literally "TBD" is not a planning input.
- **EF's own September 2026 statement:** the state arc covers trie migration, sustainable
  state growth, and decentralised state access, and *"the largest design and migration work
  is expected to begin in I\* and continues beyond it."*

I* is two forks past Glamsterdam. Under the aggressive 7.2-month cadence that's roughly
**mid-to-late 2028 to merely begin**; under the 12-month cadence, 2029. Additionally, the EF
has stated that **post-quantum readiness by December 2029 takes priority**, which explicitly
makes state work secondary through the Hegotá→J* sequence.

**Planning guidance: assume the binary-tree migration delivers you nothing before 2029.**
When it does arrive it will also be operationally expensive for you — a live, block-by-block
re-hashing of the entire state, during which archive operators will want to hold both
representations. That is a future capex event, not a future saving.

### 2.4 The counter-pressure: gas limit 60M → 100M+

The mainnet gas limit went 30M → 60M during 2025, and Fusaka (Dec 2025) standardised 60M as
the default via EIP-7935. The stated direction is **beyond 100M**, enabled by BALs and
client benchmarking; commentary around Glamsterdam references a 200M target. Validators
signal the limit, so it can move *between* forks without any fork at all.

This is the single largest uncertainty in your forecast and it points the wrong way. State
growth tracked the gas limit roughly linearly at the last doubling (~105 → ~326 MiB/week).
EIP-8037 is designed to break that linearity, but by how much depends on the actual
transaction mix. **Model gas-limit increases as the primary driver and EIP-8037 as a partial
offset of unknown size.**

### 2.5 History expiry — partly banked already, rest unscheduled

Distinct from state, and worth separating in the budget.

- **Shipped:** partial history expiry (EIP-4444 phase 1, "drop day" from May 2025, mainnet
  shortly after Pectra). All execution clients support dropping pre-merge block bodies and
  receipts — **300–500 GB off a node, available today**. Pre-merge headers must still be
  served. Pre-merge data remains available via e2store archives and the Portal Network.
  Confirm your fleet has actually taken this; it is opt-in, not automatic.
- **Not shipped:** full *rolling-window* history expiry (e.g. a ~1M-block window), which is
  where the ongoing savings would come from. Discussed, ongoing, **not scheduled for
  Glamsterdam and not scheduled for Hegotá**. EIP-7927 (History Expiry Meta) is **Stagnant**.
  Do not budget for it.

### 2.6 State expiry — research only

Reducing *live* state by expiring untouched entries. Research indicates retaining only
state accessed within one year would cut the DB from ~359 GB to ~81 GB (~78% reduction) —
which is exactly why it keeps getting discussed. But it is **not scheduled for any fork**,
it depends on unresolved prerequisites (address-space extension from 20 to 32 bytes, and
arguably the tree migration first), and the official position is that it will likely land
*after* statelessness and history expiry. **Horizon: 2029+ at the earliest. Zero planning
weight.**

### 2.7 Summary table for finance

| Change | Status | Lands in window? | Effect on your disk |
|---|---|---|---|
| Partial history expiry (EIP-4444 ph.1) | **Shipped** | Already available | **−300–500 GB/node, one-off** |
| Modern archive schemes (Geth path-based, Erigon 3, Reth) | **Shipped** (client-level, not protocol) | Available now | **~12–20 TB → ~2 TB** |
| EIP-8037 state-creation repricing | **SFI, Glamsterdam** | Yes (~Dec 2026) | Slows growth rate; no reduction |
| EIP-7928 Block-Level Access Lists | **SFI, Glamsterdam** | Yes | Faster access/sync; enables higher gas limit |
| EIP-7708 ETH transfer logs | **SFI, Glamsterdam** | Yes | **Increases** log/receipt volume; may retire trace workloads |
| Gas limit 60M → 100M+/200M | Validator-signalled, ongoing | Yes, continuously | **Increases** growth, possibly several-fold |
| EIP-7745 trustless log index | Not in Glamsterdam SFI set | Unlikely | — |
| Rolling-window history expiry | Unscheduled; meta EIP Stagnant | No | Would be large if it landed |
| Binary state tree (EIP-7864/7748) | **Draft**, params TBD; work "begins in I*" | **No** | Large, but 2029+; migration itself is a cost event |
| State expiry | Research only | **No** | Large, but 2029+ |

---

## 3. What to do in the meantime

Ordered by return on effort.

### 3.1 Immediately (this quarter) — the real savings are here

1. **Audit archive-node storage backends and migrate off legacy hash-based archive.** If any
   archive node is still legacy Geth hash-mode, moving it to Geth's path-based archive
   (reverse diffs, shipped January 2026), Erigon 3, or Reth takes ~12–20 TB → ~2 TB. This
   dwarfs every protocol change discussed above. Do it before signing any hardware order.
2. **Confirm pre-merge history expiry is actually applied fleet-wide.** 300–500 GB per node,
   available since 2025, opt-in. Free if you aren't serving pre-merge bodies/receipts from
   your own nodes.
3. **Decide your pre-merge data strategy explicitly.** If any product depends on pre-merge
   bodies/receipts, source them from e2store archives or Portal rather than keeping every
   node fat. Concentrating that obligation in one or two designated nodes lets the rest of
   the fleet slim down.
4. **Right-size archive vs. full.** With EIP-7708 landing, some workloads currently requiring
   trace re-execution against archive may become log queries answerable from a full node.
   Inventory what actually needs archive depth; archive nodes are your most expensive asset
   and the inventory is usually stale.

### 3.2 Before Glamsterdam (Q4 2026)

5. **Run Glamsterdam on Sepolia from ~6 October 2026 and Hoodi thereafter.** Measure two
   things specifically: receipt/log volume delta from EIP-7708, and BAL impact on sync and
   execution.
6. **Prepare for the EIP-7708 log volume step change.** Your log indices and any
   `eth_getLogs`-shaped product surface will grow. Since EIP-7745 is *not* landing, you will
   be absorbing more logs without the improved in-protocol index — plan index capacity
   accordingly.
7. **Scope the "retire trace-based ETH flow extraction" project.** Potentially the largest
   cost reduction available to a data company from this fork, because it reduces archive
   dependence rather than just disk.

### 3.3 Capacity planning posture for 18–24 months

8. **Forecast on gas limit, not on roadmap relief.** Build three scenarios:
   - *Base:* gas limit 60M→100M over the window, EIP-8037 offsets ~half the state-growth
     effect. State ~360–390 GiB today growing at a rate somewhere between 1x and 2x today's
     ~326 MiB/week.
   - *High:* gas limit toward 200M, EIP-8037 less effective than hoped on the real tx mix.
   - *Low:* gas limit stalls near 60M (validator signalling is not guaranteed to move),
     EIP-8037 bites hard on state-creating contracts.

   Note that full-node *total* disk growth (~7–8 GiB/week) is dominated by history and
   receipts, not state — and EIP-7708 pushes that term up while rolling-window history expiry
   (which would push it down) is unscheduled. Size history/receipt capacity separately from
   state capacity; they are on different trajectories with different protocol futures.
9. **Assume zero structural protocol relief before 2029.** Any vendor, consultant, or
   roadmap deck implying the binary tree / statelessness / state expiry will reduce your
   footprint inside this window is reading an aspirational roadmap. The EIPs are Draft with
   TBD parameters and the EF has said the work *begins* two forks out, behind post-quantum.
10. **Buy for IOPS and endurance, not just capacity.** Hashed-key random access is the
    binding constraint (§1.1), and BALs improve it by enabling prefetch/parallelism — which
    rewards drives that can serve deep queues. Prefer scaling out to scaling up: more
    moderate nodes give you a cheaper migration path when the tree conversion eventually
    forces a rebuild.
11. **Budget a future migration event, not a future saving.** When EIP-7748-style conversion
    lands (2029+, outside this window but inside the life of hardware bought late in it),
    expect a period of elevated disk and CPU while state is re-hashed and both
    representations are held. Hardware purchased in 2028 should have headroom for that.

### 3.4 How to stay current

Protocol plans move, and the Verkle→binary reversal is the cautionary example. For status
that is safe to act on, check in this order: **forkcast.org** (CFI/SFI/DFI per fork, devnet
client matrices, ACD call summaries), the **ethereum/EIPs** repo status field, and
**ethereum/pm** for ACD agendas. Treat ethereum.org, roadmap diagrams, conference talks,
and anything older than six months as background only. Re-check quarterly; the two things
most likely to change your forecast are (a) the gas limit trajectory and (b) whether
rolling-window history expiry gets scheduled for Hegotá.

---

## Sources

- [EF Protocol: Current and Emerging Priorities (Sept 7, 2026)](https://blog.ethereum.org/2026/09/07/protocol-priorities) — fork sequence, cadence, state arc timing, PQ prioritisation
- [EIP-7773: Hardfork Meta — Glamsterdam](https://eips.ethereum.org/EIPS/eip-7773) — SFI list, Sepolia epoch
- [EIP-8007: Glamsterdam Gas Repricings](https://eips.ethereum.org/EIPS/eip-8007)
- [EIP-8037: State Creation Gas Cost Increase](https://eips.ethereum.org/EIPS/eip-8037)
- [EIP-7928: Block-Level Access Lists](https://eips.ethereum.org/EIPS/eip-7928)
- [EIP-7708: ETH transfers emit a log](https://eips.ethereum.org/EIPS/eip-7708)
- [EIP-7864: Ethereum state using a unified binary tree](https://eips.ethereum.org/EIPS/eip-7864)
- [EIP-7748: State conversion](https://eips.ethereum.org/EIPS/eip-7748)
- [EIP-4444: Bound Historical Data in Execution Clients](https://eips.ethereum.org/EIPS/eip-4444)
- [EIP-7927: History Expiry Meta](https://eips.ethereum.org/EIPS/eip-7927) (Stagnant)
- [Partial history expiry announcement](https://blog.ethereum.org/2025/07/08/partial-history-exp)
- [Statelessness, state expiry and history expiry — ethereum.org](https://ethereum.org/roadmap/statelessness/)
- [Glamsterdam — ethereum.org](https://ethereum.org/roadmap/glamsterdam/)
- [Ethereum targets Oct. 6 for Glamsterdam on Sepolia](https://crypto.news/ethereum-targets-oct-6-for-glamsterdam-on-sepolia/)
- [Glamsterdam enters final devnet phase, 200M gas-limit target](https://thedefiant.io/news/blockchains/ethereum-glamsterdam-final-devnet-200m-gas-limit-target)
- [Ethereum validators push gas limit to 60M](https://cointelegraph.com/news/ethereum-validators-push-gas-limit-60m-scaling)
- [Comparing archive node disk sizes, 2026](https://www.7blocklabs.com/blog/ethereum-archive-node-disk-size-2026-vs-erigon-archive-node-disk-size-2026-vs-geth-full-node-disk-size-2026)
- [2026 Ethereum full node disk size and storage requirements](https://www.7blocklabs.com/blog/ethereum-full-node-disk-size-2026-ethereum-full-node-storage-requirements-2026-and-ethereum-full-node-size-2026)
- [Geth Glamsterdam EIP ranking (fjl)](https://notes.ethereum.org/@fjl/geth-glamsterdam-eip-ranking) — EIP-7745/7708 client assessment
- [Ethereum core devs pin 'Hegota' upgrade on 2026 roadmap](https://www.bankless.com/read/news/ethereum-core-devs-pin-hegota-upgrade-on-2026-roadmap)
- [Ethereum Foundation Checkpoint #8 (Jan 2026)](https://blog.ethereum.org/2026/01/20/checkpoint-8)

*Status claims verified against EIP repo status fields and the Glamsterdam meta EIP as of
2026-09-23. Mainnet activation dates are targets, not commitments. Some quantitative
figures come from secondary sources and vary by what is being measured — validate against
your own fleet telemetry before committing capex.*
