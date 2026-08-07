# Ethereum State Growth: Technical & Capacity Planning Brief

**Prepared:** 2026-07-25
**Planning window:** H2 2026 → H2 2028 (24 months)
**Audience:** infrastructure team + finance
**Verified against:** mainnet block 25,613,017 (2026-07-25T23:16Z), forkcast.org dataset, ethereum/EIPs, ethereum/pm ACD call record, Eth R&D archive

---

## Bottom line up front

1. **Nothing scheduled to ship inside the planning window reduces the state you already store.** The one directly relevant protocol change that is actually scheduled (EIP-8037) is a *rate cap*, not a reduction. Budget for continued linear growth.

2. **Plan on ~110–130 GiB/year of live-state growth per node, in every realistic scenario.** At that rate a Geth-family full node crosses the ~650 GiB point at which the EIP-8037 authors say nodes "begin experiencing performance degradation" around **mid-2028** — right at the edge of this planning window.

3. **The structural fixes — binary state tree, statelessness, state expiry — are not scheduled for any fork.** Verkle is dead. The replacement design was still being re-specced *last month* (EIP-8297, created 2026-06-11, hash function not yet chosen). Assign these **zero weight** in an 18–24 month plan. Anyone telling you Verkle or binary trees are coming in the next upgrade is reading stale material.

4. **The largest variable in your capacity model is not a protocol upgrade — it's the gas limit**, which validators can raise at any time with no hard fork. This is the number to instrument and forecast.

5. **There is real upside for a data company specifically.** Two Glamsterdam EIPs (7928 Block-Level Access Lists, 7708 ETH-transfers-emit-a-log) could let you retire a meaningful share of your trace/archive query load. That is a cost lever you control, and it is more actionable than waiting for state relief. See §5.3.

---

## 1. What actually drives this at the protocol level

### 1.1 The data structure

Ethereum's live state — every account balance, nonce, contract code, and storage slot — is held in a **Merkle Patricia Trie (MPT)**: a hexary (16-way) radix tree keyed by `keccak256` of the address or slot. Two properties of that choice drive your bill:

- **Every state item is also a set of interior trie nodes.** A single storage slot is not 64 bytes on disk; it is 64 bytes plus its share of the branch nodes above it. Measured on a real Geth node at block 19,999,256, the trie held **1.9 billion nodes**. Trie overhead, not leaf data, is the dominant term.
- **Hexary branching means wide, shallow-ish proofs.** Each branch node has 16 children, so proving one leaf means hashing ~15 siblings per level. This is why MPT proofs are kilobytes, and it is the reason statelessness has been blocked for years.

Because keys are hashes, **state is written in random order**. There is no locality: two slots in the same contract land in unrelated parts of the tree. Every write is a random read-modify-write across a multi-hundred-GB database. This is what makes state growth hurt disproportionately — it degrades IOPS and cache hit rate, not just capacity.

### 1.2 Why it grows monotonically

State only grows. There is no mechanism that removes an unused account or storage slot from the tree. `SELFDESTRUCT` was neutered (EIP-6780) and storage-clearing refunds are capped, so in aggregate the tree is append-only. **Anything ever written is stored forever, by every full node, at consensus-critical latency.**

Critically, **the price of creating state is set by gas costs that were calibrated in 2015 and never revisited for the size of the resulting database.** From the EIP-8037 motivation:

> "while contract deployment only costs ~200 gas units per new byte created, new storage slots cost ~313 gas units per new byte created. Also, deploying duplicated bytecode costs the same as deploying new bytecode, even though clients don't store duplicated code in the database."

State creation is underpriced and inconsistently priced. That is the root cause.

### 1.3 The measured numbers

From the EIP-8037 specification (authored by researchers across EF, Nethermind, Besu, Reth — this is the number core devs are planning against):

| Metric | Value | As of |
|---|---|---|
| Geth database dedicated to state | **~390 GiB** | Jan 2026 |
| Daily new state, 30M gas limit | ~105 MiB/day | pre-increase |
| Daily new state, 60M gas limit | **~326 MiB/day** | post-increase |
| Implied annual growth at 60M | **~116 GiB/year** | current regime |
| Point of performance degradation | **~650 GiB** | authors' threshold |
| Projected annual growth at 200M gas limit | ~387 GiB/year | modeled |

Note the non-linearity, which matters for forecasting: **a 2× gas limit increase (30M→60M) produced roughly a 3× jump in daily state creation.** The EIP authors read this as a one-off behavioral shift rather than a steady-state ratio, and extrapolate proportionally from the new baseline. Treat any gas limit increase as producing *at least* proportional state growth, possibly worse on first impact.

**Current mainnet gas limit: 60,000,000** (verified directly against a mainnet node at block 25,613,017, 2026-07-25).

### 1.4 Archive nodes are a different problem — don't conflate them

This distinction matters for your budget, because the two halves respond to entirely different levers.

| | **Live state** | **Historical state (archive)** |
|---|---|---|
| What it is | Current trie: ~390+ GiB | Every historical state diff / changeset |
| Grows with | Net *new* state created | Total *write volume* (all writes, incl. overwrites) |
| Drives | Full-node disk, RAM, IOPS, sync time | Archive disk, almost linearly with activity |
| Helped by EIP-8037? | **Yes** — that's its purpose | **Only indirectly** |
| Helped by history expiry? | No | **No** — that's block/receipt history, not state |

Your archive growth tracks *how much gets written*, including repeated overwrites of the same hot slots — which EIP-8037 does **not** price up (it charges for state *creation*, not updates). A DEX pool updating the same slots a million times creates almost no new state but a million archive changesets.

**Consequence for finance: EIP-8037 will not slow your archive fleet's growth much. It is aimed at the full-node/live-state problem.** Nothing currently scheduled targets archive growth directly.

Also worth knowing: modern archive clients (Erigon, Reth, Geth's path-based archive) already abandoned the naive "store every historical trie" approach in favour of flat state plus changesets. That is why archive footprints differ by roughly an order of magnitude across clients (see §5.1). **If any part of your fleet is still on Geth's legacy hash-based archive mode, that is the single largest and most immediately capturable saving available to you — and it requires no protocol change at all.**

---

## 2. What's actually coming — tiered by how much you can bank on it

I have graded everything below by its **formal status in the Ethereum core dev process**, not by roadmap diagrams or announcements. The process uses:

- **SFI** (Scheduled for Inclusion) — it's in. Devnets are testing it. Barring disaster, it ships.
- **CFI** (Considered for Inclusion) — seriously evaluated for a specific fork, not confirmed. Routinely gets cut.
- **DFI** (Declined for Inclusion) — rejected from that fork. May return later.
- **Proposed / no fork relationship** — not scheduled for anything.

### Tier 1 — Already shipped (bank on it, it's live)

| Change | Fork | Effect on you |
|---|---|---|
| **Partial history expiry** (client-coordinated, 2025-07-08) | — | **300–500 GB off full nodes.** Drops pre-Merge block bodies/receipts. Supported across Geth, Nethermind, Besu, Erigon. **No effect on archive state.** |
| **EIP-7642** (`eth/69`: history serving window, simpler receipts) | Pectra + Fusaka | Protocol-level support for serving a bounded history window; removes bloom filters from receipts. |
| **EIP-7594 PeerDAS**, **EIP-7892 BPO forks** | Fusaka (2025-12-03) | Blob capacity scaling. Blobs are pruned (~18 days), so this is a bounded CL disk cost, not state. Relevant to your CL disk sizing, not your state problem. |

⚠️ **Note on EIP-4444:** the EIP itself is formally **Stagnant** with *no fork relationship*. History expiry happened anyway, through client coordination plus `eth/69`. This is a good illustration of why reading EIP status alone misleads — and why "EIP-4444 is coming" statements in vendor material are unreliable in both directions.

### Tier 2 — Scheduled for Glamsterdam (SFI — high confidence it ships; timing is the risk)

Glamsterdam scoping is **complete**; 10 EIPs are SFI. The state-relevant ones:

| EIP | Title | Why it matters to you |
|---|---|---|
| **8037** | **State Creation Gas Cost Increase** | **The main event.** See §3. |
| **7981** | Increase Access List Cost | Reduces max block size / worst-case bandwidth. |
| **7778** | Block Gas Accounting without Refunds | Closes the refund loophole that let blocks pack extra real work than the gas limit implies. Reduces worst-case block size variance. |
| **7976** | Increase Calldata Floor Cost | Bounds calldata-driven growth. |
| **7928** | **Block-Level Access Lists** (headliner) | Enforced per-block state access lists **+ post-transaction state diffs**. Big indexing opportunity — see §5.3. |
| **7708** | **ETH transfers emit a log** | Native ETH transfers become `eth_getLogs`-visible — see §5.3. |
| **7732** | Enshrined Proposer-Builder Separation (headliner) | Restructures block propagation and the engine API. Operational work for you; no state effect. |
| 7954 / 7843 / 8024 | Contract size, `SLOTNUM` opcode, `SWAPN`/`DUPN`/`EXCHANGE` | Minor. |

### Tier 3 — Considered for Glamsterdam (CFI — could easily be cut)

Do **not** put these in a budget. Notably: **EIP-8038 (State-access gas cost update)** — raises the cost of *reading* state to reflect today's larger database. It complements 8037 and 8037's spec depends on constants it defines, but 8038 is only CFI. Also CFI: EIP-2780 (resource-based intrinsic gas), EIP-8246 (remove SELFDESTRUCT burn), EIP-7975 (`eth/70` partial receipt lists), EIP-8159 (`eth/71` BAL exchange).

### Tier 4 — Declined from Glamsterdam (DFI — actively rejected)

Worth knowing what was tried and cut, because vendor decks still cite some of these as upcoming. **40 EIPs were declined from Glamsterdam**, including several aimed squarely at state:

- **EIP-8032: Size-Based Storage Gas Pricing** — declined
- **EIP-7973: Warm Account Write Metering** — declined
- **EIP-8058: Contract Bytecode Deduplication Discount** — declined
- **EIP-2926: Chunk-Based Code Merkleization** — declined
- **EIP-7907: Meter Contract Code Size** — declined from *both* Fusaka and Glamsterdam
- **EIP-7745: Trustless log and transaction index** — declined (relevant to your log-indexing roadmap)

### Tier 5 — Hegotá, the fork after Glamsterdam (targeting 2027 — treat as speculative)

Status: **Planning**. Headliner selection concluded — FOCIL (EIP-7805) is SFI, Frame Transactions (EIP-8141) CFI. Neither is state-related. The state-relevant items are only **"Proposed"**, the weakest status there is:

| EIP | Title | Status | Note |
|---|---|---|---|
| **8188** | Last-Written Block for Accounts and Slots | Proposed | **The most interesting one for you** — see §3.2 |
| 7862 | Delayed State Root | Proposed | Decouples state root computation from block validation |
| 8268 | Storage Roots in Block Access Lists | Proposed | Extends 7928 so *partially stateful* nodes can verify the state root. Was pitched for inclusion on ACDE #241 (2026-07-16) — genuinely live, but early. |

### Tier 6 — The structural fixes: NOT SCHEDULED FOR ANY FORK

This is the section to read if anyone asks "won't Ethereum just fix this?"

| Effort | Formal status | Reality |
|---|---|---|
| **Verkle trees** (EIP-6800) | **Stagnant**, no fork relationship | **Dead.** Abandoned over ZK-compatibility and post-quantum concerns. Supporting EIPs 7612, 7736, 7545, 6190 are all Stagnant too. |
| **Verkle state conversion** (EIP-7748) | Draft, no fork relationship | Orphaned with Verkle. |
| **Leaf-level state expiry** (EIP-7736) | **Stagnant**, no fork relationship | Dead in its Verkle form. No live replacement proposal. |
| **Unified binary tree** (EIP-7864) | Draft, **no fork relationship** | Superseded in practice by 8297. |
| **Partitioned binary tree** (EIP-8297) | Draft, **no fork relationship** | **Created 2026-06-11 — six weeks ago.** Authored by Buterin, Ballet, Feist, and the stateless team. Spec explicitly states *"the hash function used in this draft is not final"* (currently BLAKE3, experimental). |
| **Statelessness gas costs** (EIP-4762) | Draft, no fork relationship | Blocked behind the tree decision. |

**How mature is the binary tree work, concretely?** As of 2026-05-15, in the Eth R&D `state-tree-migration` channel, a Besu engineer reported a binary-trie branch reaching consensus with Geth **on simple transfers** — a two-client prototype passing basic cases, with BAL compatibility not yet checked. Stateless Implementers' Calls continue (SIC #50 was 2026-04-20) but at a reduced cadence.

**Assessment:** A state tree migration requires (a) a frozen spec — not yet, the hash function is undecided; (b) all five EL clients implementing it; (c) consensus on a migration procedure for ~390 GiB of live state; (d) an extended, carefully staged conversion on mainnet. Glamsterdam's scope is closed. Hegotá's headliners are chosen and are not this.

> **The earliest plausible fork that could even *scope* a binary tree is the one after Hegotá — i.e. 2028 at the earliest, shipping 2029+. It should carry zero weight in an 18–24 month plan.**

---

## 3. The one change that matters in-window: EIP-8037

**Status: SFI for Glamsterdam. Actively being refined as of last week** (spec cleanup PR #11998 merged 2026-07-22; state-gas tracer APIs proposed in execution-apis PRs #846/#852 on 2026-07-21). This is real, funded, in-devnet work.

### 3.1 What it does

It introduces `CPSB` — **cost per state byte**, set to **1530 gas** — and reprices every state-creating operation against a uniform per-byte model:

| Operation | Old cost | New cost |
|---|---|---|
| New account (`CREATE`/`CREATE2`) | 32,000 | 120 bytes × 1530 = 183,600 |
| Code deposit | 200/byte | 1530/byte |
| New account via `CALL` | 25,000 | 120 × 1530 = 183,600 |
| **`SSTORE` (new slot)** | **20,000** | **64 × 1530 = 97,920** |

That is roughly a **5× increase in the cost of creating a storage slot** and a **7.6× increase in the cost of deploying bytecode.**

It also introduces **two-dimensional gas metering** — `execution-gas` and `state-gas` are tracked separately, with the block deemed full when *either* dimension hits the limit. This is an architectural change to gas accounting, not just a constant tweak.

**The calibration target, stated explicitly in the spec: an average of 120 GiB of state growth per year at a reference block gas limit of 150M.**

### 3.2 What it does NOT do — read this before budgeting

- **It does not shrink existing state.** 390+ GiB stays on disk.
- **It does not reduce the growth rate from today's level.** It holds growth at *approximately today's rate* (~116 GiB/yr) while permitting throughput to rise ~2.5× (60M → 150M). **It buys throughput, not disk.**
- **It prices state *creation*, not state *updates*.** Overwrites of existing slots stay cheap — so your **archive changeset growth is largely unaffected**.
- **It is a Draft EIP.** SFI status means it's scheduled, but the constants are not frozen: `COLD_ACCOUNT_ACCESS`, `ACCOUNT_WRITE` and `CREATE_ACCESS` come from EIP-8038, which is only **CFI**, and the spec notes those values "are not yet final."

The genuinely promising item for your archive problem is **EIP-8188** (hot/cold storage separation), and it is only *Proposed* for Hegotá. Measured results published 2026-06 on a real Geth node at block 19,999,256:

- Baseline **251.75 GB** → **155.89 GB** PebbleDB + **41.58 GB** compressed cold archive
- **−21.6% total on-disk footprint** (−5.1% if you don't compress the cold tier)
- **Trie nodes: 1.9 billion → 788 million (−58%)**

Caveat, stated by the authors: *"The numbers presented should solely serve as references for storage footprint, and not performance."* Adversarial cold-state access patterns and the cost of rebuilding cold subtrees are unquantified. **Watch it; do not budget on it.**

---

## 4. Timing: what to tell finance

### 4.1 Glamsterdam

**Evidence as of 2026-07-25:**
- forkcast lists activation as "2026", status *Upcoming*, "scoping complete, implemented EIPs are being tested on devnets"
- Devnet cadence: devnet-0 (2026-04-24) through **devnet-7, launched 2026-07-14** — eight devnets in three months
- **No public testnet has been scheduled.** ACDT #88 (2026-07-20) agenda item: *"Problems at the fork; more fork-transition testing please."*
- Several Glamsterdam EIPs were still being promoted from Draft to Review status on 2026-07-16

Recent forks have required **2–4 months of public testnet** (Sepolia/Hoodi) after devnets before mainnet.

> **Planning guidance: earliest realistic mainnet activation is Q4 2026; Q1–Q2 2027 is at least as likely. Do not build a budget that assumes Glamsterdam benefits before 2027.** Note also that this is a two-headliner fork (ePBS + BALs), both large and both consensus-critical — historically the profile most prone to slipping.

### 4.2 Hegotá

forkcast target: **2027**, status *Planning*. Headliners just locked; non-headliner scoping deadline is imminent. Given that Glamsterdam is likely to consume late 2026 and Hegotá scoping is still open, **realistic activation is late 2027 to 2028** — i.e. at or beyond the far edge of your window. Any state benefit from Hegotá (EIP-8188 etc.) should be treated as **outside the planning window**.

### 4.3 The variable that actually dominates your model

**The block gas limit is not set by a hard fork.** Validators and operators signal it, and it can move at any time. It went 30M → 60M and drove a ~3× jump in daily state creation. EIP-8037 is explicitly calibrated against a **150M** reference and models a **200M** scenario — meaning core devs are planning for a 2.5–3.3× increase from today.

**If the gas limit rises before EIP-8037 activates, you get the state growth without the mitigation.** That is the single worst case in your plan, and it is entirely possible: the gas limit can move next month; Glamsterdam cannot. **Instrument daily state growth on your own nodes and alert on gas limit changes.** This is your leading indicator, not fork dates.

### 4.4 Capacity model — live state per full node

Baseline 390 GiB (Jan 2026), 650 GiB degradation reference.

| Scenario | Jul 2026 | Jul 2027 | Jul 2028 |
|---|---|---|---|
| **A.** Gas limit stays 60M (116 GiB/yr) | ~448 GiB | ~564 GiB | **~680 GiB** |
| **B.** Gas limit → 150M mid-2027, no EIP-8037 (~290 GiB/yr) | ~448 GiB | ~564 GiB | **~854 GiB** |
| **C.** Gas limit → 150M, EIP-8037 ships (120 GiB/yr target) | ~448 GiB | ~564 GiB | **~684 GiB** |

*Scenario B's 290 GiB/yr is interpolated from the EIP-8037 authors' own 200M → 387 GiB/yr figure (~1.93 GiB/yr per 1M gas). All three are modeled, not measured — validate against your own fleet telemetry.*

**Read across that table: A and C are nearly identical.** That is the whole story of EIP-8037 in one line — it converts a throughput increase into a non-event for disk, rather than delivering relief. **Under every scenario you should provision full nodes for ~700 GiB of live state by mid-2028, plus history, plus headroom.** Archive nodes grow on top of that, tracking transaction volume.

---

## 5. What to do in the meantime

Ordered by value per unit of effort. The first three are entirely within your control and do not depend on any protocol change landing.

### 5.1 Fix client and node-tier mix first — this is the biggest available saving

Published archive footprints vary by roughly an order of magnitude by client and mode:

| Client / mode | Approx. archive footprint | Caveat |
|---|---|---|
| Geth, legacy hash-based archive | ~18–20 TB | The expensive legacy path |
| Geth, path-based archive | ~2 TB | **No historical `eth_getProof`** |
| Erigon | ~2–3.5 TB | |
| Reth | ~2.8 TB | |

*These are secondary-source figures and drift quickly — treat as directional and measure your own fleet before committing hardware.*

**Actions:**
- Audit for any remaining legacy hash-based Geth archive nodes. Migrating those is likely the largest single line-item saving available to you, and it needs no protocol change.
- **Stop running uniform archive.** Segment the fleet by what queries actually need: (a) historical-proof-capable archive — expensive, keep the minimum count; (b) proof-less archive on path-based/flat-state clients; (c) full nodes with history expiry for everything recent. Most workloads at a data company do not need historical `eth_getProof`; the ones that do should be routed, not universally provisioned.
- Maintain client diversity across Geth/Erigon/Reth/Nethermind regardless — Glamsterdam is a large fork and single-client exposure is an availability risk on activation day.

### 5.2 Take the history-expiry savings now, and plan the cold tier

- Partial history expiry is live and supported across clients — **300–500 GB per full node, available today.** Confirm it's enabled fleet-wide.
- **Rolling** (post-Merge) history expiry is progressing at the *client* level, ahead of any EIP: Nimbus-EL shipped a 33,024-epoch retention window (chosen to match CL retention) as of 2026-06. Expect retention windows to become a per-client tunable, not a fork event.
- The **`ere` archival format spec** (execution history, genesis→present) was merged in 2026-05, with `erb` (blobs) and `erc` (consensus) in progress. **Plan to serve deep history from era/ere files on cheap object storage rather than hot NVMe.** This is the architecture the ecosystem is converging on and it maps directly onto a tiered-storage cost reduction you can execute now.
- Watch **EIP-8237 (Independent CL/EL Sync)** — Draft, no fork relationship, depends on ePBS. If it lands it would let CL clients range-sync without downloading execution payloads, which is directly relevant to your sync-time complaint. Not bankable yet.

### 5.3 Exploit Glamsterdam's indexing changes — the real upside for a data company

This is the part of the fork that is specifically valuable to your business, and I'd flag it as the highest-leverage item on this list:

- **EIP-7928 (Block-Level Access Lists), SFI.** Every block will carry a **consensus-enforced** list of state locations accessed *plus post-transaction state diffs*. Today you reconstruct that with `debug_traceBlock` against archive nodes. After Glamsterdam, a large class of state-diff workloads becomes derivable from the block itself. **My assessment, not a claim from the spec:** this could let you serve a meaningful share of current archive/trace traffic from full nodes instead. That would be a direct, structural reduction in archive fleet size — worth scoping properly now, because it changes what hardware you need to buy.
- **EIP-7708 (ETH transfers emit a log), SFI.** Native ETH transfers become visible via `eth_getLogs` rather than requiring traces. Same effect, narrower scope: it removes one of the most common reasons to touch an archive node.
- **EIP-8268** (Hegotá, Proposed) would extend BALs with per-account storage roots so *partially stateful* nodes can verify the state root — the natural continuation. Track it.

**Recommendation: fund a spike this quarter to prototype your indexing pipeline against `glamsterdam-devnet-7`.** If BALs can displace even 30% of your trace-driven archive queries, that is a larger and more certain saving than anything the protocol will hand you in this window — and knowing the answer *before* you place hardware orders is worth the engineering time.

### 5.4 Prepare for the operational changes

- **Two-dimensional gas (EIP-8037).** Your fee estimation, transaction simulation, gas accounting, and any product surfacing gas analytics will need to understand `execution-gas` vs `state-gas`. Blocks become full when *either* dimension fills. Track the state-gas tracer proposals in execution-apis (PRs #846, #852) — you'll want that instrumentation.
- **ePBS (EIP-7732)** materially changes block propagation and the engine API. Budget integration and re-testing time for anything touching block ingestion.
- **`eth/70` and `eth/71`** (EIP-7975, EIP-8159 — both CFI) would change p2p wire behaviour. Not confirmed; monitor.

### 5.5 Hardware and procurement posture

- **Provision full nodes for ~700 GiB live state by mid-2028**, plus history and working headroom. Do not assume protocol relief.
- **Buy NVMe on a 2–3 year replacement cycle and size for the top of the range.** The asymmetry favours over-provisioning: the downside of under-buying is an emergency migration under load; the downside of over-buying is idle capacity. Given that Scenario B (gas limit up, mitigation late) is entirely plausible, plan headroom against B, not A.
- **Optimize for random-write IOPS and endurance (DWPD), not just capacity.** Hash-keyed state means random access; this is where sync time and query latency actually degrade, and it is the failure mode you'll hit before you run out of gigabytes.
- **Do not defer purchases waiting for statelessness or tree changes.** On the evidence above, that wait is measured in years, not quarters.

### 5.6 Track it properly

- **[forkcast.org](https://forkcast.org)** — authoritative CFI/SFI/DFI status and devnet matrices. Check before accepting any claim about what's coming.
- **ACDT calls** (weekly) — devnet health, the real leading indicator for fork timing.
- **ACDE/ACDC** (bi-weekly) — scope changes.
- **Stateless Implementers' Calls** — the binary tree effort. If cadence picks up and a hash function is chosen, that's the signal the structural fix is becoming real.
- **Your own telemetry** — daily state growth per node and the gas limit. These will tell you more about your 2028 bill than any roadmap will.

---

## 6. Explicit caveats on this brief

- **Modeled vs measured:** the §1.3 figures are from the EIP-8037 specification (authored by core researchers, used for real calibration decisions). The §4.4 projections are my extrapolation from those figures. The §5.1 archive footprints are secondary-source and should be validated against your fleet.
- **The 650 GiB threshold** is the EIP-8037 authors' stated point of performance degradation. It is a reference figure, not a hard cliff, and it will vary with your hardware and client mix.
- **Fork dates slip.** Every date here is my assessment of a realistic range, not a commitment by anyone.
- **A note on sourcing, since this drives budget:** general web search on this topic is actively misleading right now. Multiple current articles about the 2026–2027 upgrades still describe **Verkle trees** as the state-growth fix — including in the context of Hegotá. Verkle is Stagnant, has no fork relationship, and was abandoned. Every status claim in this brief is drawn from the forkcast dataset, the EIPs repository, the ethereum/pm ACD call record, or the Eth R&D archive, and is current as of **2026-07-25**. I'd recommend re-verifying against forkcast before any large procurement decision, particularly after Glamsterdam's public testnet is announced.

---

## Appendix: status quick-reference

| Item | EIP | Formal status | In planning window? |
|---|---|---|---|
| State creation repricing | 8037 | **SFI Glamsterdam** | Likely — Q4 2026/2027 |
| Block-Level Access Lists | 7928 | **SFI Glamsterdam** (headliner) | Likely — Q4 2026/2027 |
| ETH transfers emit log | 7708 | **SFI Glamsterdam** | Likely — Q4 2026/2027 |
| Block gas accounting w/o refunds | 7778 | **SFI Glamsterdam** | Likely |
| ePBS | 7732 | **SFI Glamsterdam** (headliner) | Likely |
| State-access gas cost update | 8038 | CFI Glamsterdam | Uncertain |
| Size-based storage gas pricing | 8032 | **DFI Glamsterdam** | No |
| Warm account write metering | 7973 | **DFI Glamsterdam** | No |
| FOCIL | 7805 | SFI Hegotá | Edge — 2027/2028 |
| Hot/cold separation | 8188 | Proposed Hegotá | Unlikely |
| Storage roots in BALs | 8268 | Proposed Hegotá | Unlikely |
| Delayed state root | 7862 | Proposed Hegotá | Unlikely |
| Partitioned binary tree | 8297 | Draft, **no fork** | **No** |
| Unified binary tree | 7864 | Draft, **no fork** | **No** |
| Statelessness gas costs | 4762 | Draft, **no fork** | **No** |
| Verkle trees | 6800 | **Stagnant**, no fork | **No — abandoned** |
| Leaf-level state expiry | 7736 | **Stagnant**, no fork | **No — abandoned** |
| History expiry (rolling) | — | Client-level, ongoing | **Partially available now** |
