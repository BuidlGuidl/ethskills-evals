# Technical Brief: Ethereum State Growth — Drivers, Roadmap, and Infrastructure Planning

**Date:** September 2026
**Audience:** Engineering + Finance
**Scope:** Ethereum mainnet archive and full node fleet; 18–24 month budget horizon (through ~Q3 2028)

---

## 1. Executive summary

- **State growth is structural, not accidental.** Ethereum's consensus protocol requires the *full current state* to be retained by every validating node, and every byte ever written to state is kept forever. Growth is monotonic — nothing in the protocol today deletes state.
- **The only protocol relief that has actually shipped is history-related (EIP-4444 partial history expiry, ~2026), which helps full nodes (~300–500 GB) but does nothing for archive nodes**, whose entire purpose is retaining historical *state*.
- **The next realistic protocol lever is gas repricing in the Glamsterdam fork (targeted Q4 2026): EIP-8037/8038 raise the price of creating and accessing state, explicitly designed to cap state growth at ~120 GiB/year** rather than letting it scale with the block gas limit. This *moderates* growth; it does not reverse or stop it.
- **The big structural fixes your capacity models might be discounting — Verkle trees, state expiry, stateless clients — have been re-scoped again.** As of the Ethereum Foundation's August 2026 "strawmap," Verkle has been supplanted by a unified binary tree (EIP-7864) and then "PBT"; state expiry has been replaced by "new state types." None of these are scheduled for a fork in our 18–24 month window. **Do not bank on them.**
- **The biggest near-term cost reduction for us is client-side, not protocol-side:** modern client storage engines (Geth v1.16+ path-based archive ≈ 2 TB; Erigon ≈ 1.8–2.2 TB) have collapsed the archive footprint from the 12–20+ TB of legacy hash-based Geth. If we still run hash-based Geth archives, migrating pays for itself almost immediately.
- **Planning recommendation: provision for continued growth at roughly 1.5–2× today's inbound rate, treat the Glamsterdam repricing as the ceiling on acceleration (if it lands), and treat any state-schema migration as a 2028+ event.** Details and numbers below.

---

## 2. What actually drives state growth at the protocol level

### 2.1 What "state" is

Ethereum state is the set of all accounts (balance, nonce, storageRoot, codeHash) and all contract storage slots. Blocks are validated by re-executing transactions and checking that the resulting **state root** matches the proposer's claim. To do that, a validating node needs the full current state locally. State and history are different things:

- **History** = blocks, transactions, receipts. Large but linear, and now partially expirable (EIP-4444).
- **State** = the live key-value dataset. Every node must keep all of it to validate the head of the chain.
- **Archive nodes** additionally keep every historical snapshot of state, which is what enables `eth_getBalance(block=N)`, historical `trace_*` calls, etc. Our archive fleet's pain is overwhelmingly *state*, not history.

### 2.2 The data structure: Merkle Patricia Trie (MPT)

Ethereum stores state in a hexary (16-branch) Keccak **Merkle Patricia Trie**, with a two-level scheme (account trie; per-account storage tries). Implications for operators:

- **Every write is permanent.** A storage slot, once created, is in the trie forever. The state only grows; nothing decrements the size bound.
- **Read/write amplification.** Trie lookups are O(log n) hash-by-hash walks; average depths around ~8 hops are measured in the literature, so each logical access costs many random disk reads. As the trie grows, per-access latency gets measurably worse — this is a scaling limiter, not just a disk issue.
- **Witnesses are large.** MPT proofs for ~1,000 leaves are ~3.5 MB. That's why stateless validation is infeasible on MPT and why tree redesign (Verkle → binary tree) is on the roadmap at all.
- **Client databases pay for trie nodes, not just values.** Legacy Geth archive nodes stored historical trie *nodes*, inflating to 12–20+ TB. Modern clients use flat state layouts that avoid this — see §5.

### 2.3 Why growth is accelerating, not just continuing

Measured baseline (EF research, mid-2025): at a 36M block gas limit, the network adds ~**205 MiB of new state per day** (~75 GiB/yr). When the gas limit roughly doubled (30M→36M), median daily state creation approximately **doubled** (102→205 MiB/day). State creation is therefore roughly **proportional to available block gas**, and the roadmap actively plans gas-limit increases (a 200M floor is targeted after Glamsterdam).

An EF scenario analysis (ethresear.ch, Nov 2025) projected total state size by mid-2027 of **686 GiB (conservative gas schedule), 859 GiB (base), 1.08 TiB (aggressive)** — versus ~340 GiB total state DB in mid-2025. A separate "bloatnet" benchmarking effort identified **~650 GiB as a critical threshold** where state-access latency blows out (~40% slower), sync times lengthen, and memory use becomes super-linear. So this isn't only an infra-cost problem for data companies — it's the core developers' stated reason for the repricing work below.

---

## 3. Current footprint numbers (for finance reference)

These are 2026 measurements from client docs/ecosystem reports; always add 1.5–2× headroom:

| Node type | Footprint | Notes |
|---|---|---|
| Geth full (snap-synced, pruned) | ~650–700 GiB steady-state | Grows ~14 GB/week between offline prunes; prune before 80% disk |
| Erigon full | ~920 GiB | Flat storage |
| **Geth archive — legacy hash-based** | **12–20+ TB** (genesis sync takes months) | Only client path that still supports **historical Merkle proofs** (`eth_getProof`) |
| **Geth archive — path-based (v1.16+)** | **~2 TB** full history | Stores history as reverse diffs; **no historical `eth_getProof` (yet)** |
| **Erigon / Reth archive** | **~1.8–2.2 TB** (provision ~4 TB) | Flat layout; the price point that makes archive RPC economical |
| Post-EIP-4444 full node | comfortably under 2 TB | Clients can drop ~300–500 GB of pre-Merge blocks |

Takeaway: **archive-class usage has fallen from "tens of TB" to ~2 TB purely via client engineering.** If our fleet still includes legacy hash-based archives, that is the single largest avoidable cost we carry.

---

## 4. What's coming from the protocol, and how much to bank on it

### 4.1 Shipped and usable now

- **EIP-4444 (partial history expiry).** All execution clients support pruning pre-Merge block history (~300–500 GB saved on full nodes). Full nodes fit comfortably in 2 TB. Rolling full-history expiry is still in research. For our archive fleet this is nil (history ≠ historical state), but it reduces full-node cluster cost.
- **Client-level storage improvements** (Geth path-based archive GA in 2026; Erigon/Reth flat storage). These are the *only* fully bankable reliefs in our horizon.

### 4.2 In flight: Glamsterdam (targeted Q4 2026; already slipped once)

Glamsterdam's scope is roughly frozen and includes two headliners (ePBS — EIP-7732, and Block-Level Access Lists) plus the state-economics work relevant to us:

- **EIP-8037 (state creation gas cost increase):** introduces a fixed cost-per-state-byte (CPSB ≈ 1,530 gas/byte) and meters state creation in a separate "state gas" dimension. Target: hold state growth to roughly **120 GiB/year** even as the block gas limit ramps toward a 200M floor. Consequences: contract deployments ≈10× pricier, new accounts ≈8.5× pricier, new storage slots ≈5× (20,000 → 97,920 gas). Devnets are live; Sepolia activation slated Oct 6, 2026; some ACD-level fixes (cross-frame state-gas accounting) are still being shaken out.
- **EIP-8038 (state access cost update):** raises SLOAD/SSTORE/cold-access costs to match measured current hardware performance at today's state size.

**Bankable scope:** *slower growth*, not smaller state. Even with repricing, forecast +~120 GiB/yr of state, and if the fork slips, worse. Also watch for downstream breakage: the EF has already flagged a small set of contracts that rely on hardcoded gas stipends and will need updates — relevant if we index/trace those contracts.

### 4.3 Not bankable within 18–24 months

| Item | 2023-era framing | Status as of Aug/Sep 2026 | What to plan for |
|---|---|---|---|
| **Verkle trees** | The path to small witnesses/statelessness | **Dropped/supplanted.** EF strawmap now: **unified binary tree (EIP-7864) → "PBT"** (likely Poseidon binary tree, post-quantum friendly). A Q4-2026 Hegotá framing briefly carried Verkle, but the updated Strawmap (Aug 10, 2026) re-scoped it. | Treat tree migration as **2028+ at the earliest**, and the specific construction may change again. No disk relief until it ships. |
| **State expiry** | Delete cold state after N epochs | **Replaced by "new state types"** — restricted, scalability-friendly state classes (keyed nonces, ring buffers, UTXOs, temp state) that scale far better than today's "dynamic state." | Aspirational; Vitalik frames it as a "Lean Ethereum" (2027–2030) theme. Not in window. |
| **Stateless clients** | Verify blocks without storing state | Still gated on tree redesign + ePBS; EIP-7732 (ePBS) lands in Glamsterdam, but tree migration is the blocker. | Not in window; when it eventually lands it mostly helps *validators*, not archive operators. |
| **Portal Network / history distribution** | Decentralized history delivery for post-4444 nodes | Research-stage; matters for full nodes, not for historical *state* queries. | Not a lever for our archive fleet. |
| **EIP-4444 full rollout** | Drop more history than pre-Merge | Partial (pre-Merge) shipped; rolling expiry still researched. | Minor, and history-only. |

### 4.4 Honest confidence assessment for our planning window (through ~Q3 2028)

- **Will land:** client-side storage optimizations (ongoing); EIP-8037/8038 repricings assuming Glamsterdam doesn't derail (devnets already running; scope frozen-ish; fork already slipped from H1 → Q4 2026, so treat "Q4 2026" as ~50–70% confidence and Q1 2027 as the fallback).
- **Might land, don't bank on it:** post-Glamsterdam gas-limit ramp to 200M (would *increase* state pressure within repriced bounds — plan for the 120 GiB/yr target, not today's lower rate).
- **Do not bank on:** any state-tree migration (binary tree/PBT), state expiry/new-state-types, statelessness, or anything that reduces absolute state size. If one lands early, it's upside — do not put it in the base case.

---

## 5. What we should do in the meantime

**Immediate (next 1–2 quarters):**

1. **Audit the archive fleet.** Move any remaining legacy hash-based Geth archives to Geth path-based (v1.16+, ~2 TB) or Erigon (~2 TB), unless a specific product requires historical `eth_getProof` on arbitrary blocks — that capability only exists in hash-based mode today, so route only the proof-dependent workload to (sharded) legacy nodes and migrate everything else.
2. **Standardize full nodes on EIP-4444-pruned configurations** (drop pre-Merge history) and schedule prune cycles before 80% disk usage.
3. **Track Forkcast / ACD outcomes for Glamsterdam**; update the capacity model the moment mainnet activates, using the ~120 GiB/year EIP-8037 target rather than the current higher run-rate.

**Budget planning (through Q3 2028):**

4. **Base case:** state grows ~120–180 GiB/year; archive footprint per node grows accordingly from the ~2 TB client floor; size disks at 1.5–2× current usage as client vendors recommend. No protocol-driven reduction in absolute size.
5. **Bear case:** Glamsterdam slips, or post-fork gas-limit ramp to 200M+ proceeds with repricing less effective than modeled → growth toward the aggressive EF scenarios (~1 TiB state by mid-2027 in the worst published case). Keep the bloatnet ~650 GiB critical threshold on our risk radar — beyond it, *sync times and query latencies* degrade, which is an SLA problem, not just a disk problem.
6. **Optionality:** given that a ~2 TB archive node is now commodity-scale, periodically re-price self-host vs. managed archive-RPC providers; for marginal archive capacity, renting may beat owning. Keep that hybrid flexibility.
7. **Engineering abstraction:** do not hard-code assumptions about the state-tree format in our data pipelines/indexers. When the binary-tree (or whatever survives re-scoping) migration eventually happens, clients will run dual-format transition periods; being able to re-snapshot/re-derive from our own archived data avoids long re-sync windows.

**Posture on the roadmap:** the "Lean Ethereum" agenda (quantum safety, recursive STARKs, new state types) is a multi-year program with ~7 forks planned through 2029. Our planning posture should be: *protocol relief is possible but chronically re-scoped; client engineering is the reliable lever; repricing is the realistic near-term protocol lever; plan capacity as if state grows forever, because today it does.*

---

## 6. Key sources

- Ethereum.org roadmap pages: Glamsterdam, Verkle trees, statelessness/state expiry/history expiry (content updated through Aug 2026)
- EF "strawmap" (strawmap.org) + V. Buterin thread of 2026-08-10 (re-scoping: Verkle→EIP-7864 binary tree→PBT; state expiry→new state types)
- EIP-8037 / EIP-8038 / EIP-8007 (Glamsterdam repricing meta), EIP-7773 (Glamsterdam meta), EIP-4444 (partial history expiry), EIP-7864 (unified binary tree), EIP-7732 (ePBS)
- EF research: "State growth scenarios and the impact of repricings" (ethresear.ch, Nov 2025); bloatnet initiative threshold findings (~650 GiB)
- Geth docs: path-based archive (v1.16+) vs. hash-based archive; Erigon docs (Caplin storage footprint)
- Forkcast / ACD call records for fork scheduling (Sepolia Oct 6, 2026 target for Glamsterdam)

*Caveat: fork scope and dates change in ACD calls; this brief is a snapshot as of late September 2026. Re-validate the numbers at each budget review.*
