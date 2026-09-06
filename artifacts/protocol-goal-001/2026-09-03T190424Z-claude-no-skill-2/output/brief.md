# Ethereum State & History Growth: Technical and Capacity Brief

**Prepared:** 3 September 2026
**Audience:** infrastructure engineering + finance
**Planning window:** Q4 2026 – Q3 2028 (18–24 months)
**Subject:** what drives node storage growth, what protocol relief is actually landing, and how to plan capital given the uncertainty

---

## 0. Executive summary (read this if you read nothing else)

1. **Three different things grow, and they are governed by different rules.** "State" (the live account/storage set), "history" (blocks, receipts, logs), and "state history" (the per-block diffs that make a node an *archive* node) are separate budget lines with separate protocol trajectories. Conflating them is the most common capacity-planning error. Your archive pain is mostly lines 2 and 3, not line 1.

2. **The dominant driver right now is not a protocol defect — it is the gas limit.** When mainnet went from 30M to 60M gas, average daily new state went from ~105 MiB/day to ~326 MiB/day — it roughly **tripled**, more than the 2× the limit change implies. Ethereum is deliberately buying throughput with state growth, and it intends to keep buying.

3. **Real relief is arriving, and it is closer than most of the roadmap chatter suggests — but it is a *rate cap*, not a *shrink*.** Glamsterdam (expected Q4 2026) includes EIP-8037 and EIP-8038, the first repricing of state operations since Berlin in 2021. EIP-8037 introduces a fixed cost-per-state-byte and a separate state-gas dimension explicitly engineered to hold state DB growth to **~120 GiB/year at a 150M gas limit**. This is bankable-ish: it is Scheduled for Inclusion in the fork meta EIP, running on devnets, and heading to public testnets this month.

4. **The things that would actually shrink your archive nodes are not in the window.** Binary state tree (EIP-7864) is not scheduled in Glamsterdam *or* Hegotá. State expiry is at the "experimental directions, no timelines" stage per the Ethereum Foundation itself. Rolling-window history expiry (full EIP-4444) has no scheduled fork. **Budget zero relief from all three before 2028.**

5. **Net effect on your fleet: plan for archive footprint to keep growing, and for the growth rate to go up before the cap bites.** Repricing caps *state* growth, but receipts, logs and traces scale with *execution* gas — and execution gas is the number heading toward 200M. For a data company that serves logs, this is the line item that gets worse, not better.

6. **The single highest-leverage operational change is not hardware — it is decoupling.** Stop treating "archive node" as one indivisible artifact. Split it into (a) a small canonical archive fleet, (b) range-sharded history, (c) your own extracted columnar store for the queries you actually sell. This converts a runaway 6.5 TB-per-box problem into a linear, tierable storage problem you can put on cheap media.

7. **A genuinely new planning gift: EIP-8261 makes the gas limit a scheduled, consensus-enforced parameter** with announced step-ups (GPO forks, the same pattern as Fusaka's BPO forks). For the first time, your growth-rate driver becomes something you can read off a calendar instead of guessing from validator gas votes.

---

## 1. What is actually going on at the protocol level

### 1.1 The data structure

Ethereum's state is a **hexary Merkle Patricia Trie (MPT)**, keyed by `keccak256` of the account address, with each contract account pointing at its own second-level storage trie, keyed by `keccak256` of the storage slot.

Four consequences follow directly from that design, and they are the root cause of everything you are experiencing:

**(a) Keys are hashed, so access is uniformly random.**
Hashing the address was a deliberate anti-DoS choice (it stops an attacker from crafting addresses that all collide into one deep trie branch). The cost is that there is no locality whatsoever. Two storage slots written by the same transaction land in unrelated parts of the keyspace. Every state read is a random read; every state write dirties a random page. This is why archive nodes are IOPS-bound rather than throughput-bound, and why they degrade on anything that isn't good NVMe.

**(b) Every leaf write rewrites the whole path to the root.**
Trie depth grows with `log16(N)`. At current state sizes that's roughly 7–8 levels for the account trie plus another few for storage. Writing one 32-byte storage slot means rewriting ~8–10 internal nodes, each ~500 bytes of RLP-encoded 16-way branch. **That's write amplification of two to three orders of magnitude** on the raw payload — and it is why the on-disk state is many times larger than the logical state.

**(c) State is unpriced after the fact.**
Gas is a one-time charge at write time. A storage slot written in 2017 for 20,000 gas (worth cents) has imposed a permanent, perpetual carrying cost on every archive node operator since. There is no rent, no expiry, no deletion incentive beyond a partial refund. **The protocol has, until now, systematically underpriced the one resource that never gets released.** This is the actual protocol-level defect, and it is precisely what Glamsterdam is finally addressing.

**(d) The state is overwhelmingly cold.**
Per the Ethereum Foundation (December 2025), **roughly 80% of state has not been touched in more than a year**, yet every node carries 100% of it, forever, in the hot path.

### 1.2 What's actually in there

From Paradigm's state analysis (measured March 2024, ~245 GiB total state at the time — treat the *proportions* as durable and the *absolute number* as historical):

| Component | Share of state |
|---|---|
| Contract storage | **81.7%** |
| Accounts | 14.1% |
| Contract bytecode | 4.3% |

By application category:

| Category | Share of state |
|---|---|
| ERC-20 tokens | 27.2% |
| ERC-721 tokens | 21.6% |
| L2 bridges | <2% |

Average on-disk cost: **~133.6 bytes per account, ~191.3 bytes per storage slot** — note that a storage slot is logically 64 bytes (key + value) but costs ~191 bytes on disk. That gap is the trie overhead from §1.1(b).

**Two takeaways for your team.** First, half of Ethereum's state is token bookkeeping — ERC-20 balances and NFT ownership records. This is not going to stop. Second, the L2s are *not* the problem: they consume blob space and calldata, both of which are ephemeral or history, not state. Rollup growth does not meaningfully drive your archive disk.

### 1.3 Where the gas limit comes in

This is the number that matters most for your 18–24 month forecast.

| Period | Gas limit | Avg new state/day | Annualized |
|---|---|---|---|
| Through early 2025 | 30M | ~105 MiB | ~37 GiB/yr |
| Current (since 2025 ramp; Fusaka set 60M as default) | **60M** | **~326 MiB** | **~116 GiB/yr** |
| Projected at 200M, *unpriced* | 200M | ~1,085 MiB | **~387 GiB/yr** |

*(Source: EIP-8037 motivation section.)*

The 200M/unpriced row is the one that should worry finance — and it is exactly the projection that motivated the protocol change described in §2. EIP-8037's own text notes that ~387 GiB/yr "would breach performance-degradation thresholds within a year."

### 1.4 Why your archive nodes hurt more than full nodes

An archive node stores not just current state but **state history**: the ability to answer "what was slot X at block N" for all N. Depending on client and mode this is stored either as historical trie nodes (huge) or as flat per-block diffs (much smaller). Plus receipts, logs, and the inputs for `debug_trace*`.

Critically: **state history volume scales with the number of state writes**, and **receipt/log volume scales with execution throughput**. Both scale with the gas limit. So the archive footprint has been growing roughly in proportion to a gas limit that just doubled and is targeted to triple again.

Meanwhile sync time degrades super-linearly, because you are re-executing more history *and* doing it against a larger, deeper, more cache-hostile trie.

### 1.5 Three budget lines, restated clearly

| Line | What it is | Grows with | Bounded by protocol? |
|---|---|---|---|
| **State** | Live accounts + slots | State-creating ops | **Yes, from Glamsterdam** (EIP-8037, ~120 GiB/yr @150M) |
| **History** | Blocks, receipts, logs | Execution throughput | Partially (pre-Merge dropped); rolling window **unscheduled** |
| **State history** | Per-block state diffs / historical tries — *the archive tax* | State writes | Indirectly, via EIP-8037 |
| *(Blobs)* | Sidecars, CL only | Blob count | **Yes** — pruned at ~18 days, never permanent |

---

## 2. What is coming, and how much you can bank on it

I've graded each item on whether you should put money against it inside the window.

### 2.1 Glamsterdam — state and state-access repricing — **BANKABLE (high confidence)**

**Status:** Expected on mainnet **Q4 2026**, date not yet confirmed. Next milestone is the **Sepolia fork on 28 September 2026**. Devnets have run through devnet-7/8; a dedicated public testnet ("Platåberget") is live. The upgrade slipped from H1 2026 to Q4 2026 earlier this year — treat the Q4 target as real but not guaranteed; a slip into Q1 2027 would not be surprising.

**Relevant contents** (from the fork meta, EIP-7773 — 18 EIPs Scheduled for Inclusion):

**EIP-8037 — State Creation Gas Cost Increase.** The centerpiece.
- Introduces a uniform **cost-per-state-byte, `CPSB = 1530` gas**, replacing the ad-hoc pricing where contract bytecode cost ~200 gas/byte and storage cost ~313 gas/byte.
- Introduces a **second gas dimension**: transactions get a `state_gas_reservoir` separate from `gas_left`, so state charges don't eat the execution cap.
- Byte allocations: new account = 120 bytes, new storage slot = 64 bytes, EIP-7702 authorization = 23 bytes.

| Operation | Old | New | Multiple |
|---|---|---|---|
| New account | 25,000 | 183,600 | **~7×** |
| New storage slot | 20,000 | 97,920 | **~5×** |
| 24 kB contract deploy | 4,947,200 | 37,784,880 | **~8×** |

- **Design target: 120 GiB/year state DB growth at a 150M gas limit**, assuming 50% average state-gas utilization. Scales linearly: ~80 GiB/yr at 100M, ~240 GiB/yr at 300M.

**EIP-8038 — State-access gas cost increase.** First state-access repricing since Berlin (2021). Cold account access 2,600 → 3,000; storage write 2,800 → 10,000 (+257%); account write 6,700 → 9,000. This doesn't bound growth directly but it prices the I/O load your nodes actually feel.

**EIP-8261 — Gas Limit Schedule.** Makes the block gas limit a **hard-fork-scheduled, consensus-enforced parameter** rather than a validator-voted one, following the BPO pattern from Fusaka. Config carries e.g. `glamsterdam: 60M, gpo1: 75M, gpo2: 90M` with activation timestamps. **This is the most useful thing in the fork for your planning function** — see §4.1.

**EIP-2780 (reduced intrinsic tx gas), EIP-7976 (calldata floor cost up), EIP-7981 (access list cost up)** round out the repricing.

**What this actually buys you:** *predictability, not shrinkage.* If the gas limit stayed at 60M, EIP-8037 would cut state growth to roughly 48 GiB/yr (120 × 60/150). But the entire point of the repricing is to *unblock* a higher limit. The honest reading: **state growth becomes a governed, roughly-known quantity in the 50–160 GiB/yr band instead of an ungoverned quantity heading for 387 GiB/yr.**

⚠️ **This one carries an engineering cost, not just a benefit.** Two-dimensional gas accounting breaks assumptions across the stack: the 21,000-gas constant, `gasleft()`-based metering, hardcoded gas limits, ERC-4337 bundler accounting, and every gas estimation path. The EF published migration guidance on 24 August 2026 explicitly telling infra builders to update gas estimation. **If you expose `eth_estimateGas` or any gas-aware API, put a testing line item on Platåberget in your Q4 budget.**

### 2.2 History expiry (EIP-4444) — **PARTIALLY DELIVERED, REST UNSCHEDULED**

- **Delivered:** Pre-Merge history expiry ("drop day" 1 May 2025; all execution clients shipped support by 8 July 2025). Saves **300–500 GB on a full node.** If your full nodes aren't running with this enabled, that is free money on the table today.
- **Not delivered:** the **rolling window** — dropping block bodies and receipts past a fixed window near the head. This is the phase that would actually bound history growth. It has **no scheduled fork**, is not in Glamsterdam's or Hegotá's meta EIP, and EIP-4444 itself has been sitting in Stagnant status.
- **Portal Network** is the intended retrieval layer for expired history. It exists and is progressing, but it is explicitly *not* a hardfork dependency and is not production-load-bearing for a commercial data provider.

**Bankable:** the ~300–500 GB one-time full-node saving, now. **Not bankable:** anything further in the window. And note: **history expiry is irrelevant to your archive fleet by definition** — an archive node keeps history because that's what it is.

### 2.3 Binary state tree (EIP-7864) — **NOT IN WINDOW**

Replaces the hexary keccak MPT with a binary tree using a faster hash (currently BLAKE3 in the spec; Poseidon2 and Keccak still under consideration, pending the EF's Poseidon cryptanalysis work). Would cut branch lengths ~4× and proving costs dramatically.

**It is not scheduled in Glamsterdam. It does not appear anywhere in the Hegotá meta EIP (EIP-8081) — not scheduled, not considered, not even proposed.** The hash function isn't final. Vitalik has framed it as a pillar of a longer-term EL overhaul alongside a RISC-V VM.

**Assessment: earliest plausible mainnet is 2028, and that's optimistic.** Also worth noting for expectation management: the tree change is aimed at *proof size and proving cost*, not primarily at *your disk usage*. Even when it lands, do not expect your archive footprint to fall by 4×. **Budget zero.**

*(Note for anyone who reads secondary coverage: several outlets still describe Hegotá as shipping "Verkle Trees." That is out of date — Verkle was abandoned in favour of the binary/quantum-safe hash tree direction, and neither is scheduled.)*

### 2.4 State expiry / partial statelessness — **ASPIRATIONAL**

The EF's December 2025 post "The Future of Ethereum's State" lays out the option space: "mark, expire, revive"; multi-era expiry; hot/cold state archive separation; partial stateless nodes. The EF's stated near-term priority is **"low-risk, high-reward work"** — specifically *out-of-protocol* archive solutions tested before any in-protocol adoption.

**The post gives no timelines and frames everything as experimental directions pending community feedback.** No state expiry EIP appears in either Glamsterdam or Hegotá.

**Budget zero.** But note the strategic signal in §4.4 — the EF is telling operators to solve this out-of-protocol first, which is an endorsement of exactly the architecture recommended below.

### 2.5 Hegotá — **LOW RELEVANCE TO YOU**

Targeted 2027 (some chatter about Q1 2027; ethereum.org places it in 2027). Scheduled for Inclusion so far: **EIP-7805 (FOCIL)** and **EIP-8141 (Frame Transaction)**, with ~47 EIPs merely proposed. Nothing in the scheduled set addresses state or history growth.

### 2.6 Already-landed context: Fusaka (3 December 2025)

PeerDAS shipped; BPO1 (9 Dec 2025) and BPO2 (7 Jan 2026) raised blob target/max to **14/21**. Budget roughly **225–240 GiB of rolling CL blob storage** per consensus node at BPO2 levels, over the ~18-day retention window. **This is a steady-state allocation, not a growth line** — blobs are pruned and never become permanent history. Good news, and a useful thing to be able to tell finance: the L2 scaling story does *not* compound your archive costs.

### 2.7 Confidence ladder

| Change | Effect on your fleet | Lands in window? | Plan on it? |
|---|---|---|---|
| Pre-Merge history expiry | −300–500 GB, full nodes | **Already shipped** | **Yes, today** |
| Blob pruning (post-Fusaka) | Bounded, ~225–240 GiB CL | **Already shipped** | **Yes** |
| EIP-8037 / 8038 repricing | Caps *state* growth ~120 GiB/yr @150M | **Likely Q4 2026**, slip risk to Q1 2027 | **Yes, with slip buffer** |
| EIP-8261 gas schedule | Makes growth rate *knowable* | Same fork | **Yes** |
| Higher gas limit (GPO ramp toward 150–200M) | **Increases** history/receipt growth ~3× | Phased, 2027–2028 | **Yes — as a cost, not a saving** |
| Rolling history expiry (full 4444) | Would cap history | **No scheduled fork** | **No** |
| Binary state tree (EIP-7864) | Proof size; modest disk effect | **No** — not in any meta EIP | **No** |
| State expiry | Would shrink state materially | **No** — pre-spec | **No** |

---

## 3. Capacity model for the window

### 3.1 Where the market is today (Q3 2026)

| Configuration | Disk |
|---|---|
| Full node, EL (post-expiry) | ~0.83–1.3 TiB |
| Full node, CL | ~80–200 GiB |
| Blob sidecars (rolling, post-BPO2) | ~225–240 GiB |
| **Erigon 3 archive** | **~1.8–2.2 TB** *(1.6 TB measured May 2025)* |
| **Geth path-based archive** (flat state history) | **~2 TB** |
| **Geth path-based archive + historical trie nodes** | **~6.5 TB** |
| Reth archive | ~2.1–2.8 TB |
| Legacy Geth hash-based archive | 12–20 TB+ |

*Third-party figures; validate against your own fleet telemetry before committing capital. The spread in published numbers for Reth in particular is wide enough that I would not spend against it unsourced.*

**Immediate finding:** if any archive node in your fleet is still on Geth's legacy hash-based scheme, that is a **6–10× overspend** versus path-based or Erigon 3. Migrating is the largest single storage saving available to you and it requires no protocol change.

### 3.2 The `--history.trienode` decision — the biggest lever you control

Geth's path-based archive is ~2 TB with flat state history but **~6.5 TB if you also retain historical trie nodes**. Historical trie nodes exist for exactly one purpose: serving `eth_getProof` at historical blocks (restored in v1.17.x via `--history.trienode=N`).

**That is a 4.5 TB per node premium for one RPC method.** For a data company, decide deliberately:
- If you sell historical Merkle proofs → keep a **small dedicated sub-fleet** with trienodes, size it to proof demand, not to total archive demand.
- If you don't → run flat-only and take the 3× saving fleet-wide immediately.

I'd rank this above everything else in this brief on a dollars-per-hour-of-work basis.

### 3.3 Projection, 2026–2028

These are **modeled extrapolations**, not measurements. Assumptions stated so you can substitute your own.

**Assumptions:** state DB growth follows EIP-8037's published targets post-Glamsterdam and scales linearly with gas limit pre-Glamsterdam; state-history growth scales with state writes; receipts/logs scale with *execution* gas; GPO ramp follows roughly the EIP-8261 illustrative schedule (60M → 75M → 90M, continuing toward 150M).

| Scenario | Gas limit path | State DB growth | Archive footprint growth (state hist. + receipts) |
|---|---|---|---|
| **A — Glamsterdam slips to Q1 2027, limit held at 60M** | 60M throughout | ~116 GiB/yr | ~0.6–0.9 TB/yr/node |
| **B — Base case: Glamsterdam Q4 2026, cautious GPO ramp** | 60 → 75 → 90M by end-2027 | ~48 → ~72 GiB/yr (capped) | ~0.8–1.2 TB/yr/node |
| **C — Aggressive: fork lands, ramp toward 150M by mid-2028** | 60 → 150M | ~120 GiB/yr (capped) | **~1.5–2.2 TB/yr/node** |

**Read scenario C carefully.** It is the "everything goes well for Ethereum" scenario, and it is the *worst* one for your budget. The repricing cap holds state growth flat-ish while execution throughput triples — so receipts, logs and traces, which are the archive-heavy artifacts a data company actually serves, grow fastest precisely when the protocol's state-growth fix is working as designed.

**Plan against scenario C. Treat A and B as upside.**

### 3.4 Procurement implications

- **Minimum viable archive box: 8 TB NVMe.** A 4 TB box is already marginal for a Geth path-archive with trienodes and will not survive the window under scenario C.
- **Do not buy for 24 months of headroom on a single volume.** Buy for ~12 months and architect for tiering (§4.2). Storage gets cheaper; commitments don't.
- **RAM: 64 GiB floor for archive**, 128 GiB where you're serving concurrent trace/log queries. State access is random; page cache is doing more work every year.
- **Sync time is now a capital planning input.** Geth path-based archive syncs in ~2 weeks and needs ~30 hours of state indexing before historical queries work. Erigon archive can be bootstrapped from snapshot files. **A fleet where node rebuild takes two weeks cannot absorb a hardware failure gracefully** — see §4.3.

---

## 4. Recommendations

### 4.1 Convert capacity planning from guesswork to a calendar

EIP-8261 turns the gas limit into a scheduled consensus parameter with GPO forks. Once Glamsterdam is live:

- **Track the GPO schedule as a first-class input to your capacity model.** Each announced GPO fork is a step change in your growth rate with a known activation timestamp — weeks or months of advance notice.
- Note the distinction that most coverage gets wrong: **200M is a design target that Glamsterdam *unblocks*, not a value the fork enforces.** The limit still steps up through governance/signaling as nodes demonstrate they can handle it. So the ramp is observable, not a cliff.
- **Deliverable:** a growth model keyed on `gas_limit(t)` with the GPO schedule as input, re-run on each ACD announcement. This is the concrete thing that replaces "guessing how bad this gets."

### 4.2 Decouple the archive: three tiers, not one artifact

This is the structural fix, and the EF's own December 2025 guidance — prioritizing *out-of-protocol* archive solutions — points the same direction.

**Tier 1 — Canonical archive (small).** A minimal fleet of true archive nodes, Erigon 3 preferred on footprint. This is your source of truth for backfill and reorg-safe correctness. Size it for correctness, not for query load.

**Tier 2 — Range-sharded history.** Geth's path-based archive supports `--history.state=N` and archive *clusters* where different nodes hold different historical segments. Erigon's snapshot files are immutable and range-partitioned by construction. Shard by block range across cheaper boxes rather than replicating full archives. Immutable historical segments can live on cheaper media — Geth explicitly supports state history on HDD — and can be shared/restored between nodes rather than re-synced.

**Tier 3 — Extracted analytical store.** Almost certainly the biggest win for a data company. Your customers query logs, transfers, balances-at-block, traces — not raw trie nodes. Extract once into a columnar store (Parquet on object storage, ClickHouse, or similar), partitioned by block range. Object storage is roughly an order of magnitude cheaper per TB than the NVMe an archive node demands, historical partitions are **immutable and never need rewriting**, and query performance for your actual access patterns will beat JSON-RPC by a wide margin.

**The framing for finance:** today every terabyte of history sits on the most expensive storage tier you buy, because it's trapped inside a node. Tiering moves the ~90% of it that is cold and immutable onto storage that costs a fraction as much, and it does so with no dependency whatsoever on Ethereum protocol changes.

### 4.3 Fix sync time with restore, not with patience

Sync time will keep degrading — it is a function of accumulated history and there is no protocol fix in the window. Do not wait for one.

- Build a **snapshot/restore pipeline**: filesystem-level snapshots (ZFS/LVM) or Erigon snapshot files staged in object storage, so rebuilding a node is a **restore measured in hours**, not a two-week resync.
- Treat "time to restore a failed archive node" as an SLO with a number attached. Right now it is probably ~14 days and probably nobody owns it.
- This single change does more for your operational risk than any protocol upgrade in this brief.

### 4.4 Do now, this quarter

1. **Audit for legacy Geth hash-based archive nodes.** Migrate to path-based or Erigon 3. Potential 6–10× reduction. Highest ROI item in this document.
2. **Decide the `--history.trienode` question fleet-wide** (§3.2). Confine historical `eth_getProof` to a dedicated sub-fleet. ~4.5 TB/node at stake.
3. **Confirm pre-Merge history expiry is enabled on every full node.** 300–500 GB each, already available, no downside.
4. **Verify blob storage is provisioned as steady-state, not growth** — ~225–240 GiB rolling. If anyone has modeled blobs as unbounded growth, that's an overprovisioning error to reclaim.
5. **Open a Glamsterdam compatibility workstream against the Platåberget testnet.** Two-dimensional gas accounting, the death of the 21,000 constant, and changed `gasleft()` semantics will break gas estimation and any 4337 tooling. Testnets fork from 28 September 2026. **This is a Q4 engineering cost, and it is not optional.**
6. **Instrument your own growth telemetry.** Daily deltas for state DB, state history, and receipts/logs *separately* per client. Every published third-party figure in §3.1 should be replaced with your own measurement within a quarter. Your fleet is the only authoritative source for your own capex.

### 4.5 What to tell finance

- **Storage spend per node keeps rising through the window. There is no protocol change landing that reverses it.** Anyone promising otherwise is quoting a roadmap item that is not scheduled in any fork.
- **What *is* landing (Q4 2026, ~85% confidence) makes growth predictable and bounded rather than open-ended** — a governed ~120 GiB/yr state target instead of an uncapped trajectory toward ~387 GiB/yr. That is genuinely valuable for planning even though it doesn't reduce next year's invoice.
- **The upside case for Ethereum is the downside case for our storage bill.** A successful gas limit ramp to 150–200M means ~3× the receipts and logs we must retain and serve. Budget scenario C.
- **The controllable savings are architectural and available now** — client migration, tiering cold history to object storage, and confining expensive archive features to small sub-fleets. These are engineering-time investments with immediate, protocol-independent returns, and they are where the money is.

---

## 5. What would change this brief

Re-run the model if any of these occur:

- Glamsterdam slips past Q1 2027, or EIP-8037/8038 are descoped from the fork → state growth stays ungoverned; scenario A/C blend worsens.
- A GPO fork schedule is announced targeting >150M faster than ~mid-2028 → pull scenario C forward.
- Rolling-window history expiry (full EIP-4444) gets scheduled into any fork → first real relief for history growth; material to tier-2 sizing.
- EIP-7864 appears in a meta EIP's *Scheduled for Inclusion* list → begin a 2028+ planning track, but expect proving benefits, not disk savings.
- Any state expiry proposal moves from EF blog post to a draft EIP with client implementations → the first genuine signal that the permanent-state assumption is ending.

**Suggested review cadence: quarterly, plus ad-hoc on any All Core Devs scope decision affecting the above.**

---

## Sources

Protocol specifications and Ethereum Foundation:
- [EIP-8037: State Creation Gas Cost Increase](https://eips.ethereum.org/EIPS/eip-8037)
- [EIP-8038: State-access gas cost increase](https://eips.ethereum.org/EIPS/eip-8038)
- [EIP-8261: Gas Limit Schedule](https://eips.ethereum.org/EIPS/eip-8261)
- [EIP-7773: Hardfork Meta — Glamsterdam](https://eips.ethereum.org/EIPS/eip-7773)
- [EIP-8081: Hardfork Meta — Hegotá](https://eips.ethereum.org/EIPS/eip-8081)
- [EIP-7864: Ethereum state using a unified binary tree](https://eips.ethereum.org/EIPS/eip-7864)
- [The Future of Ethereum's State — EF Blog, Dec 2025](https://blog.ethereum.org/2025/12/16/future-of-state)
- [Glamsterdam Repricing Impact for Smart Contract Developers — EF Blog, Aug 2026](https://blog.ethereum.org/2026/08/24/glamsterdam-repricing-testing)
- [Partial history expiry announcement — EF Blog, Jul 2025](https://blog.ethereum.org/2025/07/08/partial-history-exp)
- [Fusaka Mainnet Announcement — EF Blog, Nov 2025](https://blog.ethereum.org/2025/11/06/fusaka-mainnet-announcement)
- [Glamsterdam — ethereum.org roadmap](https://ethereum.org/roadmap/glamsterdam/)

Client documentation:
- [Archive mode — go-ethereum docs](https://geth.ethereum.org/docs/fundamentals/archive)
- [Hardware Requirements — Erigon docs](https://docs.erigon.tech/get-started/hardware-requirements)

Analysis and reporting:
- [How to Raise the Gas Limit, Part 1: State Growth — Paradigm](https://www.paradigm.xyz/2024/03/how-to-raise-the-gas-limit-1)
- [Glamsterdam Hardfork Tracker — ethdaily.io](https://ethdaily.io/glamsterdam)
- [Ethereum's Glamsterdam Upgrade Enters Final Devnet Phase With 200M Gas-Limit Target — The Defiant](https://thedefiant.io/news/blockchains/ethereum-glamsterdam-final-devnet-200m-gas-limit-target)
- [Ethereum raises block gas limit to 60M — The Block](https://www.theblock.co/post/380687/ethereum-block-gas-limit-fusaka)
- [Ethereum execution clients implement history pruning under EIP-4444 — The Block](https://www.theblock.co/post/361722/ethereum-execution-clients-history-pruning)
- [Vitalik Buterin lays out a two-part plan to overhaul Ethereum's execution layer — The Block](https://www.theblock.co/news/ecosystems/2026-03-01-vitalik-buterin-lays-out-a-two-part-plan-to-overhaul-ethereums-execution-layer-from-the-ground-up-391681)
- [Ethereum Glamsterdam: What Changes for Infrastructure — Chainstack](https://chainstack.com/ethereum-glamsterdam-upgrade/)
- [Erigon vs Geth: Which Ethereum client is better in 2026 — Chainstack](https://chainstack.com/ethereum-clients-geth-and-erigon/)
- [Ethereum Archive Node — ethereum.org](https://ethereum.org/developers/docs/nodes-and-clients/archive-nodes/)
