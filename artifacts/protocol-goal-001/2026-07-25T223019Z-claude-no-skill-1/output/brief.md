# Ethereum State Growth: Technical & Capacity Brief

**Date:** 2026-07-25
**Audience:** Infrastructure team + Finance
**Planning window:** now → mid/late 2028 (24 months)

---

## 0. Executive summary (read this if you read nothing else)

1. **"State growth" is three separate problems with three different curves.** Live state, historical state (what archive nodes keep), and chain history (blocks/receipts) grow for different reasons and are fixed by different things. Most public commentary — and most of the roadmap — is about the first and third. **Archive nodes are hit by the second, and almost nothing on the roadmap addresses it inside our window.**

2. **The one big win already landed and we should confirm we've taken it.** EIP-4444 partial history expiry shipped across all execution clients in July 2025; it frees 300–500 GB *per node* by dropping pre-Merge block bodies and receipts. This helps full nodes. It does nothing for historical state.

3. **The next fork (Glamsterdam, realistic mainnet window Sept–Dec 2026) contains real state work, but it is a brake, not a reversal.** EIP-8037 reprices state creation (~7× more expensive to create a new account) and EIP-8038 reprices state access. Critically, these were engineered to make a **200M gas limit** safe — the explicit design target is holding growth to **~120 GiB/year of live state**. Today's actual rate is ~31–72 GiB/year. **The plan is for state to grow faster in absolute terms, not slower**, in exchange for ~3× throughput. Budget accordingly.

4. **The things that would actually rescue archive economics — state expiry, hot/cold state archive split, partial statelessness, binary tries — have no fork target, no confirmed EIP for the core mechanism, and in one case (EIP-7864 binary tree) have been in Draft since January 2025.** Treat all of it as **2028+ and unbankable**. Note also the asymmetry: state expiry helps full nodes by letting them forget things. An archive node, by definition, forgets nothing. **Even a successful state-expiry rollout does not shrink our archive fleet.**

5. **Plan for archive nodes at roughly 2× today's footprint by mid-2028** (base case ~4–5 TB usable per node, high case 5–7 TB), with the mainnet **gas limit as the single leading indicator** to re-forecast against quarterly.

6. **The highest-leverage moves are ours, not the protocol's:** client choice (12 TB → ~2 TB), workload tiering so we stop paying archive prices for hot-state queries, and range-sharded archive clusters. These are available now and are worth more than anything shipping in the next 18 months.

---

## 1. What's actually driving this at the protocol level

### 1.1 Three datasets, not one

| Dataset | What it is | Who must keep it | Growth driver | Roadmap relief |
|---|---|---|---|---|
| **Live state** | Current accounts, balances, nonces, contract storage slots, bytecode | Every node | Net *new* accounts and storage slots | Yes — repricing now, expiry later |
| **Historical state** | Per-block state diffs / changesets that let you reconstruct state at any past block | Archive nodes only | *Write volume* (state changes per second) | **Essentially none in window** |
| **Chain history** | Blocks, transactions, receipts, logs | Every node (currently) | Bytes per block × blocks | Yes — partially shipped |

Conflating these is the main source of bad capacity forecasts. The public "Ethereum state is 250 GB" number and our multi-TB archive invoices are both correct — they're measuring different things.

### 1.2 Live state: why it's big and why it's slow

Ethereum's state is a **Merkle Patricia Trie** — actually a trie of tries: one account trie keyed by `keccak256(address)`, and a separate storage trie per contract keyed by `keccak256(slot)`. Three consequences fall directly out of that design:

- **Keys are hashes, so there is no locality.** Two storage slots written by the same transaction land in unrelated parts of the trie. Every state access is a random read. This is why archive workloads are IOPS-bound and NVMe-bound rather than throughput-bound, and why they degrade non-linearly as state exceeds page cache.
- **Every write amplifies.** Changing one leaf rewrites every trie node on the path to the root — roughly log₁₆(N) internal nodes for a hexary trie, each of which is a separate key/value pair. The logical delta is 32 bytes; the physical delta is kilobytes.
- **The trie is the encoding, not the payload.** Raw state was measured at roughly **245 GiB on disk**, composed of ~14% accounts, ~4% bytecode, and **~82% contract storage** — with ERC-20 balances (27%) and ERC-721 (22%) the single biggest occupants. Every token balance for every holder is a permanent, separately-stored, unpriced-after-the-fact 32-byte slot.

Growth rate has actually *decelerated*: about **2.62 GiB/month** currently (≈31 GiB/yr), down from a peak of 5.99 GiB/month, with annualized figures cited in the 31–72 GiB/yr range depending on measurement window. That deceleration is a function of the 30M-era gas limit and L2 migration, and it is not structural — the Ethereum Foundation is explicit that nothing in the current pricing model prevents a renewed surge.

**The economic root cause:** state creation is a one-time gas charge for an unbounded-duration storage obligation imposed on every node operator, forever. Creating a new account has cost 25,000 gas since 2016; storing a new slot 20,000 gas since Frontier-era pricing. Those numbers were never recalibrated against the actual multi-decade cost of holding the byte. We are, literally, the counterparty subsidizing that mispricing.

The Ethereum Foundation's own framing (Dec 2025): **roughly 80% of Ethereum state has not been touched in over a year**, yet every node stores all of it.

### 1.3 Historical state: our actual problem

This is the part that gets underdiscussed, and it's the part that drives our bill.

An archive node does not store "a bigger state." It stores **every state change ever made**, so it can answer `eth_call`, `debug_traceTransaction`, and `eth_getBalance` at arbitrary historical blocks. Modern clients (Erigon 3.x, Reth) store this as flat state plus append-only changesets/static files rather than as retained historical trie nodes — which is exactly why they're ~2 TB instead of 12+ TB.

The critical property: **historical state grows with write throughput, not with live state size.** A contract that writes the same storage slot every block adds zero live state and adds a changeset entry every block, forever. Consequences:

- **EIP-8037 barely helps us.** It reprices *state creation* — new accounts, new slots, code deposits. Repeated writes to existing slots are the bulk of archive changeset volume and are not the target of that EIP. (EIP-8038 raising `STORAGE_WRITE` costs is the more relevant one for us, and it's a modest constant-factor adjustment.)
- **Gas limit increases hit archive nodes hardest and most directly.** More gas per block ⇒ more state writes per block ⇒ proportionally more changeset bytes per day. This is close to linear and it has no pruning mechanism.
- **Archive growth never decelerates for the reasons live-state growth did.** L2 migration reduced *new account* creation; it did not reduce mainnet write volume in the same proportion, and rollup batch-posting plus L1 DeFi activity keeps write rates up.

### 1.4 Chain history: the solved-ish one

Blocks and receipts. Under **EIP-4444**, all execution clients since July 2025 support dropping pre-Merge block bodies and receipts — **300–500 GB saved per node**. Pre-Merge *headers* must still be served over devp2p. Fusaka's `eth/69` further trimmed receipt data on the wire.

**Rolling** history expiry (a continuously-advancing retention window, e.g. one year) is the actual endgame and is **not in Glamsterdam**. It's referenced as targeting "an unspecified 2026 hardfork," which given Glamsterdam's scope lock means realistically Hegotá or later. Distribution of expired history is still unsettled: Geth is oriented toward Portal Network (planning stage), Reth toward ERA files and torrents.

### 1.5 The multiplier over everything: the gas limit

- 2025: raised 30M → 60M by validator signaling; Fusaka's EIP-7935 standardized 60M as the client default.
- Today (July 2026): **~60M**.
- Design target unblocked by Glamsterdam: **200M** — roughly 3.3× current L1 capacity.

The gas limit is set by validator signaling, not by the fork, so 200M will be approached in steps as clients demonstrate they can handle it. But the direction is unambiguous, it is the stated #1 priority of the EF's 2026 "Scale" track ("toward and beyond 100M"), and **it is the dominant term in our 24-month forecast** — larger than any efficiency gain on the roadmap.

---

## 2. What's coming, and how much to bank on it

Graded by what I'd actually put in a budget.

### Tier A — Shipped. Bank it. (Confidence: certain)

| Change | Status | Effect on us |
|---|---|---|
| **EIP-4444 partial history expiry** | Live in all EL clients since July 2025 | −300–500 GB per node. **Verify every node in the fleet has this enabled.** |
| **Fusaka** (Dec 3, 2025) — PeerDAS, `eth/69`, EIP-7935 60M default | Live | Blob data now column-custodied; full nodes can custody a subset. Gas default 60M. |
| **BPO forks** (Dec 17 2025: 10/15 blobs; Jan 7 2026: 14/21) | Live | Blob working set **up**, and continuing — see §3.3. |
| **Path-based Geth archive / Erigon 3.x / Reth static files** | Shipped, production | 12+ TB → ~2 TB. If any legacy hash-based archive nodes remain, this is our single biggest available win. |

### Tier B — High confidence inside the window (Confidence: high on landing, medium on date)

**Glamsterdam.** Currently scheduled: Sepolia 2026-08-03, Hoodi 2026-08-17, **mainnet 2026-09-16**. Devnets went final-stage in June 2026. The honest read: **ePBS (EIP-7732) is the schedule risk** — EF contributors have repeatedly flagged it as harder than anticipated, and Glamsterdam has already slipped from its original H1 2026 target. Given recent forks needed 2–4 months of public testnet seasoning, **plan on Sept–Dec 2026, with Q1 2027 as a live downside.**

Locked bundle (10 EIPs) includes EIP-7732, EIP-7928, EIP-7708, EIP-7778, EIP-7843, EIP-7954, EIP-7975, EIP-8024, EIP-8037, EIP-8159.

What matters to us:

- **EIP-8037 — State Creation Gas Cost Increase.** Introduces a cost-per-state-byte (`CPSB = 1530`) and a *separate gas reservoir* for state-growth operations, so state creation can't crowd out ordinary execution. New account: **25,000 → 183,600 gas (~7×)**. New storage slot: `64 × CPSB`. Code deposit: `CPSB` per byte (up from 200). Target: **120 GiB/year at a 150M reference gas limit**.
  *Caveat for the team:* still formally **Draft**, with final repricing numbers being settled on BAL devnets as recently as May 2026 — the constants can still move before mainnet.
- **EIP-8038 — State-access gas cost update.** Raises `STORAGE_WRITE`, `COLD_STORAGE_ACCESS`, `COLD_ACCOUNT_ACCESS`, `EXTCODESIZE`/`EXTCODECOPY`. First real recalibration since EIP-2929 (Berlin, March 2021). Modestly slows archive changeset growth per unit gas and materially improves worst-case block DoS resistance.
- **EIP-7928 — Block-Level Access Lists** (+ EIP-8159 for the wire protocol). Every block ships an enforced list of accounts/slots touched with post-execution values. Enables parallel disk reads, parallel validation, parallel state-root computation, and — most interesting for us — **"executionless state updates"**: a lagging node can apply state transitions from the BAL without running the EVM. **This is the most likely near-term improvement to our sync times.** Don't over-model it yet; there's no reliable mainnet sync-time figure to quote.
- **EIP-2780** — cheaper intrinsic transaction cost (simple transfers ~71% cheaper). Increases transaction volume; marginally increases our data volume.

**The honest net assessment of Glamsterdam for us:** it reprices state so that a 3× throughput increase doesn't produce a 3× state-growth increase. **It is a rate ceiling deliberately set above today's rate.** Nothing in it shrinks an existing archive node. Its real gift to us is BAL-driven parallelism and sync improvements, plus better DoS resistance.

### Tier C — Real, planned, but at or beyond the window edge (Confidence: medium)

- **Hegotá.** Projected mainnet **April 2027** (Sepolia Feb 2027, Hoodi Mar 2027), currently in planning with 0/12 milestones done. Headliner: **FOCIL (EIP-7805)** — censorship resistance, consensus-layer. EIP-8141 (Frame Transactions) is CFI, not headliner. **Nothing state-size-relevant is currently headlining.** Non-headliner scope opens later in 2026; that's the window where rolling history expiry or further repricing *could* appear. Given historical slippage, treat any April 2027 date as ±2 quarters.
- **Rolling history expiry (full EIP-4444).** Ongoing work, no scoped fork. Would eventually bound full-node history at a rolling window (~1 year discussed). **Doesn't touch historical state — no archive relief.** Realistic: 2027–2028.
- **Gas limit 100M → 200M.** Not a fork event; validator-signaled, stepwise. Highly likely to begin moving up within the window. **This is a cost increase for us, not a relief.**

### Tier D — Aspirational. Do not put a dollar against it. (Confidence: low / no date)

The EF's Stateless Consensus team laid out three directions in December 2025 ("The Future of Ethereum's State"):

- **State expiry** — mark rarely-touched state inactive, revivable by proof. Two competing designs (mark-expire-revive vs. multi-era). **No EIP for the mechanism, no fork target.** Even if shipped: it reduces what *full nodes* must hold. **Archive nodes still hold everything. This does not help our fleet.**
- **State archive** — formal hot/cold state separation, potentially with a distributed "archive cluster" where different nodes own different historical segments. Conceptually the most relevant idea to us, and the **least developed**. No spec.
- **Partial statelessness** — nodes hold subsets of state, plus RPC/light-client enhancements. Research.

- **EIP-7864 — unified binary state tree.** Merges account + storage tries into one binary tree with 32-byte keys, ~4× shorter proofs; combined with a Poseidon/Blake3 hash swap, 3–100× better proving efficiency. **Draft since January 2025**, no fork assignment. Buterin has flagged Poseidon as needing more security review.
- **Verkle trees — effectively dead.** Deprioritized around mid-2025 in favor of binary trees, partly on post-quantum concerns with the underlying elliptic-curve commitments. **If any of our internal planning docs still reference Verkle, they're stale.**

Useful calibration on how far off this is: **BloatNet**, the EF's state stress-test network, has only recently reached **1.5× mainnet state** with all clients syncing, and is now targeting 2×. The research is still establishing *when* state size breaks clients — that is a long way upstream of shipping a fix.

**Bottom line for finance: there is no protocol change with a credible date inside our 24-month window that reduces archive node storage. Plan as if none is coming, and treat any arrival as upside.**

---

## 3. Planning numbers

### 3.1 Current per-node footprints (July 2026, mainnet)

| Configuration | Disk | Notes |
|---|---|---|
| **Erigon 3.x archive** | ~1.8–2.2 TB | Most space-efficient archive implementation. |
| **Reth archive** | ~2.4–2.8 TB | DB + static files (~1.34 TB compressed static files). |
| **Geth path-based archive** | ~2 TB | ⚠️ **Does not support historical `eth_getProof`.** |
| **Geth hash-based archive (legacy)** | 12+ TB, some report tens of TB | Sync from genesis can take months. Migrate off. |
| **Full node (EL, snap-synced + history-expired)** | ~0.9–1.3 TB | ~650 GB steady state for Geth, +~14 GB/week between prunes. |
| **Consensus client** | ~80–200 GB | |
| **Blobs** | ~100–150 GB | At current blob targets, full custody. Scales — see §3.3. |

### 3.2 Archive growth scenarios, 24 months

**Method and honesty note:** published archive footprints are point-in-time and vary by client version, compaction state, and index configuration, so I've derived the per-year delta rather than quoting a measured figure. Erigon archive moved from ~1.77 TB (Sept 2025) to ~1.8–2.2 TB (2026) at a 45–60M gas limit, implying roughly **0.4–0.6 TB/year at today's throughput**. **Instrument our own fleet's daily delta before committing to a number** — see §4.6. Everything below scales that baseline by expected gas-limit trajectory.

| Scenario | Gas limit path | Implied archive delta | Per-node by mid-2028 (Erigon-class) |
|---|---|---|---|
| **Low** — Glamsterdam slips to 2027, validators stay conservative | stays ~60M | ~0.5 TB/yr | **~3.0–3.2 TB** |
| **Base** — Glamsterdam lands Q4 2026, gas steps to ~100–120M through 2027 | 60M → ~120M | ~0.9–1.2 TB/yr | **~4.0–4.6 TB** |
| **High** — smooth rollout, gas reaches 200M during 2027 | 60M → 200M | ~1.5–2.0 TB/yr | **~5.0–6.2 TB** |

Add ~30% operational headroom for compaction, snapshots, and re-sync staging. **Provision 6–8 TB usable per archive node for anything purchased in the next 12 months**, and prefer configurations that can grow without a chassis swap.

For Reth-class archives, shift the whole table up by roughly 0.6 TB.

**Full nodes are the good news:** history expiry plus repricing means full nodes should stay roughly flat-to-mildly-growing (1.0–1.6 TB) across the window, even at higher gas limits. If a workload can be served by a full node, it should be.

### 3.3 The line item that's easy to miss: blob storage

Blobs prune after ~18 days, so this is a **fixed working set that scales linearly with the blob target**, not an accumulating cost. At 12s slots and 128 KiB per blob, full custody:

| Blob target/block | Per day | 18-day working set |
|---|---|---|
| 14 (today, post-BPO2) | ~12.6 GiB | **~227 GiB** |
| 48 | ~43 GiB | **~780 GiB** |
| 128 (stated BPO3/4 ambition) | ~115 GiB | **~2.0 TiB** |

Two mitigations: **PeerDAS custody is a knob** — a non-supernode custodies only a subset of columns, so full custody is a choice, not a requirement. And if slot times are ever shortened, halve the denominator and double these figures. **Decide deliberately which of our nodes are supernodes**; defaulting everything to full custody could quietly add ~2 TB/node.

---

## 4. What to do in the meantime

Ordered by leverage. Items 1–3 are worth more than everything shipping in the next 18 months combined.

### 4.1 Stop treating "archive" as one SKU — tier the fleet

The dominant waste in most archive fleets is serving hot queries from archive hardware. Split into three tiers behind a routing layer:

- **Tier 1 — Hot/recent state.** Full nodes with shallow history. Serves the large majority of `eth_call`, `eth_getBalance`, `eth_getLogs` on recent blocks. ~1.0–1.6 TB, flat growth, cheap, horizontally scalable.
- **Tier 2 — Deep historical state.** True archive. Serves historical `eth_call`, `debug_trace*`, `eth_getProof`. Expensive, scales per §3.2, should be the *minority* of the fleet.
- **Tier 3 — History/logs/receipts.** Blocks, receipts, and log indexes served from ERA files / object storage / a dedicated index (ClickHouse-class), **not from NVMe archive nodes.** Most "archive" log queries are really history queries and don't need historical state at all.

Route by request shape. Measure the actual split first — in most fleets Tier 2's true share of traffic is under 10%, which changes the budget dramatically.

### 4.2 Range-shard the archive tier

Historical state is trivially partitionable by block range and is **immutable below the head**. Run N archive nodes each responsible for a block range, front them with a range-aware router, and the per-node footprint becomes `total / N` rather than `total`. Old ranges never change, so those nodes become read-only, cacheable, snapshot-restorable, and can sit on cheaper storage tiers. This is the same "archive cluster" shape the EF is gesturing at for the protocol — **we can build it now, at our scale, without waiting.** It also positions us to adopt a protocol-level hot/cold split later with minimal re-architecture.

This is the single highest-value internal engineering project on this list.

### 4.3 Standardize the client fleet

- **Migrate any remaining hash-based Geth archive nodes immediately.** 12+ TB → ~2 TB is a >5× reduction available today.
- **Erigon 3.x** for minimum footprint; **Reth** where the Rust stack, modularity, or Reth 2.0's static-file architecture fits better.
- ⚠️ **Client-choice constraint:** Geth's path-based archive does **not** serve historical `eth_getProof`. If we sell or depend on historical Merkle proofs, those nodes must be Erigon or Reth. Audit this against our product surface before consolidating.
- Run at least two client implementations across the fleet. Consensus-bug insurance, and it hedges per-client regressions in a period of heavy execution-layer change.

### 4.4 Confirm history expiry is actually enabled

300–500 GB per node, already available, zero risk. Easy to have missed on nodes provisioned before mid-2025 or restored from old snapshots. **Audit the whole fleet this week.**

### 4.5 Buy for a growth rate, not a size

- Provision **2× projected 24-month need**, and prefer chassis with free NVMe bays or JBOF expansion over forklift replacement.
- Use expandable volume management (LVM/ZFS) so growth doesn't force a re-sync.
- **Assume re-sync, not grow-in-place**, as the recovery path: maintain a warm snapshot pipeline, and always keep enough spare capacity to stage a fresh sync alongside a live node. Snapshot-restore is hours; genesis sync for archive is days-to-months.
- Budget in **$/TB-month with a trajectory**, not as a one-time purchase. Re-forecast quarterly.

### 4.6 Instrument now — this is the input to every future number

We should not be re-deriving growth from blog posts. Start recording, per node, per client version, daily:

- on-disk delta (db, static files, freezer, blobs, separately)
- changeset/static-file bytes per block
- IOPS and read latency percentiles under production query mix
- sync-from-snapshot and sync-from-scratch wall-clock

Within a quarter that gives us our own regression of **bytes-per-gas**, which turns the gas limit — a publicly observable number — into a direct forecast of our storage bill. **Track the mainnet gas limit as the primary leading indicator for capacity re-forecasting.**

### 4.7 Prepare for Glamsterdam operationally

- **Test on Sepolia (from ~Aug 3) and Hoodi (from ~Aug 17).** ePBS changes block production and propagation; BALs change block structure on the wire (EIP-8159) and how state updates can be applied. Both touch anything we've built around block ingestion.
- **EIP-8037/8038 break gas assumptions.** Any product of ours that estimates gas, simulates transactions, or has hardcoded cost constants needs review — a new account going 25,000 → ~183,600 gas is a 7× change that will surface in customer-facing estimates.
- **Do not upgrade the whole fleet on day one.** Stage it.

### 4.8 Don't build the plan around rescue, but keep the option open

Concretely: don't defer purchases waiting for state expiry, and don't let anyone build a financial model with a step-down in it. But *do* keep the Tier 1/2/3 separation (§4.1) and range sharding (§4.2) clean, because those are exactly the seams along which any future protocol-level hot/cold split will land. That's how we get the upside if it arrives without paying for it if it doesn't.

---

## 5. Watchlist

Check quarterly; each of these would move the forecast:

| Signal | Where | Why it matters |
|---|---|---|
| **Mainnet gas limit** | Any block explorer | The dominant term in our storage forecast. Every step up is a proportional archive cost increase. |
| **Glamsterdam mainnet date** (target 2026-09-16) | ethereum/pm, EF blog Checkpoints | Slip risk is ePBS. A slip past Q1 2027 pushes the gas-limit ramp right and lowers our near-term costs. |
| **EIP-8037 final `CPSB`** | eips.ethereum.org, BAL devnets | Still Draft. The constant sets the state-growth ceiling. |
| **Hegotá non-headliner scope** (proposals ~Aug 2026) | ethereum/pm | Watch for rolling history expiry or further state repricing appearing here. |
| **BPO3/BPO4 blob targets** | EF blog, ACD calls | Directly sizes our blob working set (§3.3). |
| **BloatNet results at 2× mainnet state** | bloatnet.info | Early warning on client degradation thresholds. Also the best proxy for how far off statelessness really is. |
| **EIP-7864 leaving Draft / getting a fork assignment** | eips.ethereum.org | First genuine signal that a state-tree overhaul is real. Not there yet. |
| **Erigon / Reth release notes** | GitHub | Client-side efficiency gains have historically outdelivered protocol changes for archive operators. |

---

## 6. Caveats on this brief

- Archive per-year growth in §3.2 is **derived from published point-in-time footprints, not measured**. Treat the scenario table as a planning frame to be replaced by our own telemetry within a quarter (§4.6).
- Fork dates are **projections, not commitments** — the schedule source explicitly labels them as such; only AllCoreDevs decisions are binding. Glamsterdam has already slipped once (H1 → H2 2026).
- EIP-8037 and EIP-8038 constants are **not final**.
- Some client footprint figures come from secondary aggregators and vary with version and compaction state; validate against our own nodes before purchasing.
- Blob math in §3.3 assumes 12-second slots and 128 KiB blobs. Slot-time changes under discussion for future forks would change it proportionally.

---

## Sources

- [The Future of Ethereum's State — Ethereum Foundation, Dec 16 2025](https://blog.ethereum.org/2025/12/16/future-of-state)
- [Protocol Priorities Update for 2026 — Ethereum Foundation, Feb 18 2026](https://blog.ethereum.org/2026/02/18/protocol-priorities-update-2026)
- [Checkpoint #9: Apr 2026 — Ethereum Foundation](https://blog.ethereum.org/2026/04/10/checkpoint-9)
- [Protocol Cluster Updates: May 2026 — Ethereum Foundation](https://blog.ethereum.org/2026/05/11/protocol-update-may-26)
- [Partial history expiry announcement — Ethereum Foundation, Jul 8 2025](https://blog.ethereum.org/2025/07/08/partial-history-exp)
- [Fusaka Mainnet Announcement — Ethereum Foundation](https://blog.ethereum.org/2025/11/06/fusaka-mainnet-announcement)
- [Hegotá Upgrade EIP Proposal Timelines — Ethereum Foundation, Dec 22 2025](https://blog.ethereum.org/2025/12/22/hegota-timeline)
- [EIP-8037: State Creation Gas Cost Increase](https://eips.ethereum.org/EIPS/eip-8037)
- [EIP-8038: State-access gas cost update](https://eips.ethereum.org/EIPS/eip-8038)
- [EIP-7928: Block-Level Access Lists](https://eips.ethereum.org/EIPS/eip-7928)
- [EIP-7864: Ethereum state using a unified binary tree](https://eips.ethereum.org/EIPS/eip-7864)
- [EIP-4444: Bound Historical Data in Execution Clients](https://eips.ethereum.org/EIPS/eip-4444)
- [Glamsterdam — ethereum.org roadmap](https://ethereum.org/roadmap/glamsterdam/)
- [Statelessness, state expiry and history expiry — ethereum.org](https://ethereum.org/roadmap/statelessness/)
- [Upgrade Schedule — EIPs Insight](https://eipsinsight.com/upgrade/schedule)
- [How to Raise the Gas Limit, Part 1: State Growth — Paradigm](https://www.paradigm.xyz/writing/how-to-raise-the-gas-limit-1)
- [Releasing Reth 2.0 — Paradigm](https://www.paradigm.xyz/writing/releasing-reth-2-0)
- [Ethereum's Glamsterdam Upgrade Enters Final Devnet Phase With 200M Gas-Limit Target — The Defiant](https://thedefiant.io/news/blockchains/ethereum-glamsterdam-final-devnet-200m-gas-limit-target)
- [EF researchers warn of storage burden from 'state bloat' — The Block](https://www.theblock.co/post/383156/ethereum-foundation-researchers-warn-of-storage-burden-from-state-bloat)
- [Ethereum execution clients implement history pruning under EIP-4444 — The Block](https://www.theblock.co/post/361722/ethereum-execution-clients-history-pruning)
- [Vitalik Buterin lays out a two-part plan to overhaul Ethereum's execution layer — The Block](https://www.theblock.co/post/391681/vitalik-buterin-lays-out-a-two-part-plan-to-overhaul-ethereums-execution-layer-from-the-ground-up)
- [Bloatnet Initiative — Road to Statelessness](https://cperezz.github.io/bloatnet-website/index.html)
- [Archive mode — go-ethereum docs](https://geth.ethereum.org/docs/fundamentals/archive)
- [Erigon FAQ — docs.erigon.tech](https://docs.erigon.tech/help-center/frequently-asked-questions-faqs)
- [Comparing Disk Sizes: Ethereum Archive Node vs Erigon vs Geth Full Node (2026) — 7BlockLabs](https://www.7blocklabs.com/blog/ethereum-archive-node-disk-size-2026-vs-erigon-archive-node-disk-size-2026-vs-geth-full-node-disk-size-2026)
- [2026 Ethereum Full Node Disk Size and Storage Requirements — 7BlockLabs](https://www.7blocklabs.com/blog/ethereum-full-node-disk-size-2026-ethereum-full-node-storage-requirements-2026-and-ethereum-full-node-size-2026)
- [Ethereum's Glamsterdam upgrade: what changes for infrastructure — Chainstack](https://chainstack.com/ethereum-glamsterdam-upgrade/)
- [Glamsterdam Repricings #3 — ethereum/pm issue #1959](https://github.com/ethereum/pm/issues/1959)
