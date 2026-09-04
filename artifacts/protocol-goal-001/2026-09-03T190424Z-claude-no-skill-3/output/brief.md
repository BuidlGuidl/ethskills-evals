# Ethereum State Growth: Technical & Capacity Brief

**Date:** 2026-09-03
**Audience:** Infrastructure team + Finance
**Planning window:** Sep 2026 → Sep 2028 (24 months)
**Status of protocol facts:** current as of 2026-09-03. Glamsterdam scope is frozen but not shipped; see §5 for what could still move.

---

## 0. Executive summary (read this if you read nothing else)

1. **Two different things are growing, and conflating them is the single most common
   planning error.** *State* (the current balances/nonces/code/storage the EVM needs to
   execute the next block) is ~250–400 GiB and grows ~120 GiB/year. *History* (blocks,
   receipts, logs, and — for archive nodes — historical state) is the multi-terabyte part
   of your bill. Protocol work on "state growth" mostly addresses the first. Your archive
   disk pain is mostly the second.

2. **Real relief is coming to Ethereum, and it is landing inside our window — but it is
   rate-limiting, not shrinking.** Glamsterdam (targeting Q4 2026) contains the first
   serious state-growth repricing since 2016 (EIP-8037 / EIP-8038). Its explicit design
   target is to hold state growth at ~120 GiB/year *while the block gas limit rises from
   60M toward 150–200M*. Without it, the same gas limit increase would produce ~387
   GiB/year of state.

3. **Net effect on our budget: our disk bill still goes up substantially.** The repricing
   caps *state*; it does not cap *history*, and the gas limit increase it unlocks
   directly multiplies history. Glamsterdam also *adds* two new per-block data streams
   (Block-Level Access Lists ≈ +110 GB/year; EIP-7708 ETH-transfer logs). **Plan for
   archive nodes at roughly 2.5× today's footprint by Q3 2028, not 1.5×.**

4. **The things that would genuinely shrink our footprint — binary state trees,
   statelessness, state expiry — are NOT in our planning window.** None is scheduled for
   Glamsterdam or Hegotá. Treat them as 2028+ and give them **zero** weight in hardware
   budgeting.

5. **The largest single lever we control is client and storage-mode selection, and it is
   worth ~10× on archive disk.** A legacy hash-based Geth archive is >20 TB. A modern
   path-based/flat-state archive (Geth v1.16+, Erigon 3, Reth) is 2–4 TB for the same
   data. If any of our fleet is still on hash-based archive, migrating it is the highest
   ROI action available to us and dwarfs anything the protocol will do for us in 24
   months.

6. **One decision needs an answer before we buy hardware:** do we need historical
   `eth_getProof` (Merkle proofs against old blocks)? On Geth that is the difference
   between a ~2 TB archive and a ~6.5 TB archive. See §6.2.

---

## 1. What is actually driving this at the protocol level

### 1.1 State vs. history — the distinction that drives the budget

| | **State** | **History** |
|---|---|---|
| What it is | Current accounts, nonces, balances, contract code, contract storage slots | Every block header, body, transaction, receipt, log — and for archive nodes, every *past* version of state |
| Needed to | Execute/validate the *next* block | Answer questions about the *past* |
| Size today | ~250–400 GiB depending on representation | ~1 TB (full node, post-Merge) to 2–20 TB (archive) |
| Grows because | New accounts and new storage slots are created and never removed | Every block appends, forever |
| Protocol relief | EIP-8037/8038 repricing (Glamsterdam); binary trees + state expiry (aspirational) | EIP-4444 history expiry (partially shipped 2025) |

**Our archive nodes are dominated by history, not state.** That is why protocol
announcements about "solving state growth" have not translated into smaller bills for us,
and why they largely still won't.

### 1.2 How Ethereum stores state, and why the representation matters so much

Ethereum's canonical state is a **hexary Merkle Patricia Trie (MPT)** keyed by
`keccak256(address)`, with each contract owning a second-level storage trie keyed by
`keccak256(slot)`. Three properties of this design drive everything downstream:

- **Keys are hashes, so access is uniformly random.** There is no locality. Every state
  read is effectively a random read against a multi-hundred-gigabyte dataset. This is why
  NVMe (not SATA SSD, and never spinning disk) is non-negotiable, and why *state size*
  translates directly into *latency*, not just into *disk cost*.

- **The trie is deep and node-heavy.** A hexary trie over ~10⁹ keys is roughly 7–8 levels
  deep. Naively, one logical state read costs 7–8 physical reads, and one logical state
  *write* dirties every node on the path to the root — classic write amplification. This
  is the mechanism behind "sync times get worse every year": the cost is superlinear in
  state size, not linear.

- **The historical representation is a choice, and clients made different ones.** This is
  where the 10× spread in archive sizes comes from:

  - **Hash-based (legacy Geth):** trie nodes are keyed by their own hash, so every
    historical version of every trie node is retained as a distinct object. Complete,
    proof-capable, and enormous — **>20 TB on mainnet**, months to sync from genesis.
  - **Flat state + diffs / path-based (Erigon 3, Reth, Geth v1.16+):** store the *current*
    state flat (one key → one value, no trie overhead) plus compact per-block change sets,
    and reconstruct historical state by replaying diffs. Same query answers, a fraction of
    the bytes — **~2–4 TB**, ~2 weeks to sync.

  The tradeoff is that flat/diff archives reconstruct historical *values* cheaply but do
  not automatically retain historical *trie nodes*, so historical Merkle proofs
  (`eth_getProof` at an old block) require explicitly opting back into storing them.

### 1.3 What state is actually made of

Measured composition of Ethereum state:

- **Contract storage: ~81.7%** of state. Accounts ~14.1%, contract bytecode ~4.3%.
- Average on-disk cost: **~133.6 bytes per account**, **~191.3 bytes per storage slot**
  (i.e. a 32-byte key + 32-byte value costs ~3× its logical size once trie/index overhead
  is included).
- The dominant single category is token bookkeeping — ERC-20 balances (~27%) and ERC-721
  ownership (~22%) — i.e. `mapping(address => uint256)` writes.

**The economic root cause:** creating a storage slot has cost **20,000 gas** since 2016 and
creating an account **25,000 gas** since 2016 — a one-time payment for a *perpetual*
obligation on every node operator on Earth. That price has never been adjusted for the
fact that state is now ~1000× larger and that our marginal cost of serving it has risen
accordingly. Every discussion below is downstream of this mispricing.

### 1.4 The gas limit is the multiplier — and it is being deliberately raised

This is the part most capacity plans miss. State growth is not autonomous; it is
proportional to gas throughput.

- Mainnet gas limit went **30M → 60M during 2025** — the first significant raise since
  2021.
- Measured effect: average new state created per day went from **~105 MiB to ~326 MiB**
  (a >3× jump, i.e. more than proportional). That is an annualized **~116 GiB/year**.
- Core devs have an explicit, stated goal to "**continue to raise the gas limit toward and
  beyond 100M**," and Glamsterdam devnets are being tested with a **200M** target.
- Extrapolated *without* repricing, a 200M gas limit implies **~387 GiB/year** of state
  growth — a level core devs themselves describe as breaching node performance thresholds
  within about a year.

**Read that as: the protocol is intentionally increasing the load on our fleet, and the
state-growth EIPs exist to make that increase survivable — not to make our current load
smaller.**

---

## 2. What is coming to Ethereum: Glamsterdam (the one that counts)

**Status as of 2026-09-03:** scope frozen, multi-client devnets running, **Sepolia fork
provisionally set for 2026-09-28**, Hoodi to follow, **mainnet targeted Q4 2026 with no
confirmed date**. The upgrade meta-EIP (EIP-7773) is still formally in peer review. Client
teams hit issues with the new builder functionality during recent testing and inserted an
extra devnet, so slip risk into Q1 2027 is real but the fork itself is not in doubt.

### 2.1 The state-growth EIPs (the good news)

**EIP-8037 — State Creation Gas Cost Increase.** Introduces a *cost per state byte*
(`CPSB = 1530 gas`) and reprices all state creation against the actual bytes created:

| Operation | Today | Under EIP-8037 |
|---|---|---|
| New account | 25,000 | 120 bytes × 1530 = **183,600** |
| New storage slot (`SSTORE`) | 20,000 | 64 bytes × 1530 = **97,920** |
| Code deposit (`CREATE`/`CREATE2`) | 200 /byte | **1530** /byte |

These are ~5–8× increases. Critically, state creation is metered against a **separate gas
reservoir** from execution, so state growth is capped independently of throughput.
**Stated target: ~120 GiB/year of state growth at a 150M gas limit.**

**EIP-8038 — State-Access Gas Cost Update.** First repricing of state *reads/writes* since
EIP-2929 (2021), justified explicitly by "Ethereum's state has grown significantly, thus
deteriorating the performance of these operations":

| Parameter | Old | New |
|---|---|---|
| Cold account access | 2,600 | 3,000 |
| Storage write | 2,800 | **10,000** |
| Account write | 6,700 | 9,000 |
| Contract-creation access | 7,000 | 12,000 |

Targets sustained **100 Mgas/s** execution, up from ~20 Mgas/s today.

**What this means for us:** these are the first protocol changes in a decade that
structurally attack the problem, and they are the reason Glamsterdam is the most
important fork on our calendar. They convert an exponential problem into a bounded
~120 GiB/year one. They do **not** reduce anything we already store.

### 2.2 The EIPs that make our storage *worse*

**EIP-7928 — Block-Level Access Lists.** Every block gains a list of all accounts and
storage slots touched, so validators can execute transactions in parallel. Measured sizes:
**~28.9–54.6 KB compressed for typical blocks, ~70 KiB average, <73.7 KB at p95.** Adding
read tracking costs a further ~13.4 KB/block. Network-wide that is **~300 MB/day ≈ 110
GB/year of new permanent block data** that archive nodes must store and serve.

**EIP-7708 — ETH transfers emit a log.** Every value-bearing transaction, `CALL`,
`CREATE`, `CREATE2` and `SELFDESTRUCT` emits an ERC-20-shaped `Transfer` log from
`0xff…fe`. The EIP correctly notes this does not raise the *worst-case* block, but it
explicitly "will somewhat increase the average number of logs." For us that means a
materially larger receipts/logs dataset and bloom index.

*But this one is also a product opportunity — see §6.5.*

**EIP-7954 — max contract size 24 KiB → 32 KiB.** Raises the ceiling on per-contract code
in state by 33%.

**EIP-2780 — reduce intrinsic transaction gas** (21,000 → lower). Makes cheap
transactions cheaper, which increases transaction count per block.

**And the gas limit itself**, which Glamsterdam's repricing is specifically designed to
unlock. History volume — the dominant term in our archive bill — scales roughly with gas
consumed, and is only partially offset by **EIP-7976** (calldata floor cost 10/40 → 64/64
gas per byte, which shrinks a worst-case full block by ~37%).

### 2.3 History expiry (EIP-4444): partially shipped, the rest unscheduled

- **Shipped.** "Drop Day" was 2025-05-01; by July 2025 all execution clients supported
  partial history expiry, letting nodes discard pre-Merge blocks and receipts and
  recovering **300–500 GB per node**. If we have not taken this on every node in the
  fleet, that is free money sitting on the table today.
- **Not shipped.** The full *rolling* window (retain ~1 year, prune the rest —
  `HISTORY_PRUNE_EPOCHS = 82125`) is **not in Glamsterdam and not in Hegotá**. It is
  described as targeting "an unknown 2026 hardfork," which at this point means 2027+.
- **Note the strategic implication:** if rolling history expiry ever does ship, public
  nodes stop serving old history over devp2p. That makes our archive fleet *more*
  valuable, not less — we become one of the few places the data still exists. Our archive
  footprint is a moat, not purely a cost.

### 2.4 Hegotá — the next fork, and why it doesn't help us

Named and scoped in early 2026, targeted after Glamsterdam (realistically **2027**, since
Glamsterdam itself slipped to Q4 2026). Confirmed headliner: **FOCIL (EIP-7805)**,
fork-choice enforced inclusion lists — a censorship-resistance feature with **no state or
storage benefit to us**. State and history expiry are listed as "areas under discussion,"
which in core-dev language means no spec, no client implementation, no date.

**Plan on Hegotá delivering zero storage relief.**

### 2.5 The real fixes — and why you must not budget for them

| Change | What it would do | Honest status |
|---|---|---|
| **Binary state tree (EIP-7864)** | Replaces the hexary Keccak MPT with a binary tree using a ZK-friendly hash. Shallower, far smaller proofs, prerequisite for statelessness. | **Draft. The hash function is not even chosen** — current spec uses BLAKE3 as a placeholder, with Keccak and Poseidon2 as candidates. Not in Glamsterdam. Not in Hegotá. |
| **Verkle trees (EIP-6800)** | The *previous* plan for the same goal. | **Effectively abandoned**, displaced by binary trees over post-quantum concerns with elliptic-curve commitments. Any vendor or article still citing "Verkle in 2026" is out of date — a useful shibboleth for filtering stale advice. |
| **Statelessness** | Validators verify blocks via proofs without holding state. | Depends on the tree migration above. Not specified for any named fork. |
| **State expiry** | Actually *removes* untouched state — the only thing that would ever make our numbers go **down**. | No accepted spec, no fork assignment, and a decade of unresolved UX problems around resurrection. |

**Bottom line for finance: the ideas that would shrink our footprint are real research
with real momentum, but there is no credible path to any of them being live on mainnet
before 2028. Budget as if they do not exist.**

### 2.6 Confidence table — what to bank on

| Item | Target | Confidence it lands by Sep 2028 | Effect on our disk |
|---|---|---|---|
| Glamsterdam fork ships at all | Q4 2026 | **~95%** | — |
| BALs (EIP-7928) | Glamsterdam | **~90%** | **Worse** (+~110 GB/yr) |
| ePBS (EIP-7732) | Glamsterdam | ~85% | Neutral |
| EIP-7708 ETH transfer logs | Glamsterdam | ~80% | **Worse** (bigger receipts) |
| State repricing (EIP-8037/8038) | Glamsterdam | **~75%** | **Better** (caps state growth) |
| Gas limit ≥150M | 2027 | **~80%** | **Much worse** (history scales) |
| Partial history expiry (pre-Merge) | Already live | **100%** | **Better** (−300–500 GB, available now) |
| Rolling history expiry | unscheduled | ~20% | Better if it lands |
| Binary tree / EIP-7864 | unscheduled | **<10%** | Would be much better |
| Statelessness | unscheduled | **<5%** | Would be much better |
| State expiry | unscheduled | **~0%** | Would be transformative |

*Confidences are my engineering judgment from current core-dev signals, not published
figures.*

### 2.7 The scenario finance needs to see

EIP-8037/8038 are **repricings**, and repricings break contracts that hardcode gas
amounts. There is active public concern that the Glamsterdam repricing could break
existing deployed contracts. This creates a genuine downside branch:

> **Risk case: the repricing gets softened or dropped late in the cycle to avoid
> ecosystem breakage, while the gas limit increase proceeds anyway.**

That is the worst outcome for us: history growth accelerates ~3×, *and* state growth goes
to the ~387 GiB/year path instead of the ~120 GiB/year path. I rate this ~20–25% likely.
Our procurement stance should be able to absorb it (§6.6).

---

## 3. Where we are today (baseline numbers)

Published/measured figures as of mid-2026, for sanity-checking our own telemetry:

| Configuration | Disk | Notes |
|---|---|---|
| Geth full node | **~1.2 TiB** | growing ~7–8 GiB/week ≈ ~400 GiB/yr |
| **Geth archive, hash-based (legacy)** | **>20 TB** | months to sync; full historical proof support |
| **Geth archive, path-based** (v1.16+) | **~2 TB** | ~2 week sync; flat state history |
| **Geth archive, path-based + historical trie nodes** | **~6.5 TB** | required for historical `eth_getProof` |
| **Erigon 3 archive** | **4 TB** recommended (docs, 2026-07-19) | fits one 4 TB drive today |
| Erigon 3 full | 2 TB recommended | |
| **Reth archive** | **~2.8 TB** | Reth full ~1.2 TB |
| State portion alone | ~245 GiB (flat) / ~390 GiB (Geth DB, Jan 2026) | ~120 GiB/yr growth at 60M gas |

Two observations:

1. **The client/mode spread (2 TB vs 20 TB) is larger than the entire 24-month growth we
   are worried about.** Configuration choice dominates protocol trajectory over our
   planning horizon.
2. **Erigon's own docs moved from "fits comfortably" to "4 TB recommended" during 2026.**
   Anyone still provisioning archive nodes on 4 TB drives will be out of headroom inside
   this planning window.

---

## 4. 24-month capacity projection

**Model assumptions** (state these to finance; they are the levers, and they are
estimates, not published forecasts):

- Baseline archive footprint today: **~3 TB** on a modern flat-state client.
- Archive growth is dominated by history + state diffs, which scale roughly with gas
  consumed per unit time.
- Glamsterdam activates around Dec 2026; gas limit ramps 60M → ~120M through H1 2027 and
  reaches ~150M average from mid-2027.
- EIP-8037 holds state creation near its ~120 GiB/yr target.
- BALs add ~110 GB/yr from activation; EIP-7708 adds a further single-digit-percent to
  receipts.
- EIP-7976's calldata repricing partially offsets history growth (worst-case block −37%).

| Period | Gas limit (avg) | Est. archive growth rate | Δ | Cumulative |
|---|---|---|---|---|
| Today (Sep 2026) | 60M | ~1.0–1.2 TB/yr | — | **~3.0 TB** |
| Sep–Dec 2026 | 60M | ~1.0–1.2 TB/yr | +0.3 TB | ~3.3 TB |
| Jan–Jun 2027 | 60M → 120M ramp | ~1.5–1.9 TB/yr | +0.9 TB | ~4.2 TB |
| Jul 2027–Sep 2028 | ~150M | ~2.2–2.8 TB/yr | +3.0 TB | **~7.2 TB** |

**Headline for budget: ~2.5× today's archive footprint by Q3 2028 (range 2.0×–3.0×).**

Scenario spread on a 3 TB baseline node at Sep 2028:

- **Best case** (repricing lands, gas limit ramps slowly to ~100M): **~5.5 TB**
- **Base case** (as modeled above): **~7–7.5 TB**
- **Risk case** (§2.7 — repricing softened, gas limit to 200M anyway): **~9–11 TB**

**Full nodes** are far less exposed: ~1.2 TiB today, ~400 GiB/yr now, scaling to perhaps
~1 TB/yr at 150M gas → **~3–3.5 TB by Sep 2028**. A 4 TB NVMe still covers a full node
through the window; it does not cover an archive node.

**On sync times:** these get worse superlinearly (§1.2), and the gas limit increase makes
that worse faster than disk does. Assume **archive sync-from-genesis becomes operationally
impractical during 2027**. Plan around this now (§6.3) rather than discovering it during
an incident.

---

## 5. What could invalidate this brief

Re-check these; each materially moves the numbers:

1. **Glamsterdam mainnet date** — Q4 2026 is a target, not a commitment; no date is
   confirmed as of today. Watch the Sepolia fork (provisionally 2026-09-28) as the first
   real signal.
2. **Whether EIP-8037/8038 survive to mainnet intact** — the single biggest swing factor
   in the model (§2.7).
3. **Actual gas limit trajectory post-fork** — this is validator-set behavior, not
   protocol-enforced. It could move faster or slower than modeled.
4. **Hegotá's non-headliner scope**, still open. Rolling history expiry appearing there
   would be a genuine positive surprise.
5. **The binary-tree hash function decision** (BLAKE3 vs Keccak vs Poseidon2). Not a
   window-relevant event, but the first hard signal on 2028+ direction.

---

## 6. Recommendations

### 6.1 Immediate — eliminate legacy archive representations *(highest ROI, do first)*
Audit the fleet for any hash-based Geth archive nodes. Each is >20 TB doing the job a
2–4 TB flat-state archive does. Migrate to Geth path-based (v1.16+), Erigon 3, or Reth.
**This one action is worth more than every protocol change combined over 24 months.**

Also confirm partial history expiry (pre-Merge pruning) is applied everywhere: **300–500
GB per node, available today, no fork required.**

### 6.2 Immediate — settle the historical-proof question *(blocks procurement)*
On Geth, historical `eth_getProof` requires retaining historical trie nodes
(`--history.trienode`), which is the difference between **~2 TB and ~6.5 TB**. That is a
**3× cost multiplier on the archive fleet**.

**Recommendation:** audit actual customer usage of historical `eth_getProof`. If it is a
minority of demand — which it usually is — do not pay 3× fleet-wide. Run a **small
dedicated proof-capable tier** (2–3 nodes) behind a routing rule and keep the bulk fleet
on the cheap representation. Route by method at the load balancer.

### 6.3 Q4 2026 — stop treating sync-from-genesis as a recovery path
Archive sync is ~2 weeks today on the best clients and will get worse. Build and test:
- A **golden snapshot pipeline**: periodic block-level snapshots of a healthy archive
  datadir to object storage, with a *rehearsed and timed* restore.
- **Restore time as a tracked SLO.** If snapshot restore is not meaningfully faster than
  resync, that is a defect to fix now, not during an outage.
- Verify snapshot portability across the client versions we actually run.

### 6.4 Now through Q1 2027 — Glamsterdam readiness
- Track the **Sepolia fork (prov. 2026-09-28)** and Hoodi. Run our full stack — indexers,
  decoders, trace parsers — against forked testnets *before* mainnet.
- **ePBS (EIP-7732) changes block structure and the block-production pipeline.** Anything
  we operate that parses block internals or consumes the engine API needs review. This is
  the most likely source of a silent breakage for a data company.
- **BALs (EIP-7928) are a new per-block object.** Decide now whether we store, index, and
  expose them. They are a plausible product (they are a precomputed dependency graph for
  every block), but they are ~110 GB/year if we retain them.
- Budget engineering time for **EIP-7708** ingestion: our log volume steps up, and any
  fixed-size assumptions in receipt handling or bloom indexing should be checked.

### 6.5 Product opportunity — EIP-7708 is quietly a big deal for us
Today, tracking native ETH movement requires **tracing** (`debug_traceBlock` /
`trace_block`) against an archive node — expensive, slow, and client-dependent. After
EIP-7708, ETH transfers appear as **ordinary logs in ordinary receipts**.

Consequences worth planning for:
- A meaningful class of customer query moves **off the archive tier and onto cheap log
  indexing**. That is an operating-cost reduction *and* a latency improvement.
- Our historical archive becomes the *only* way to get pre-Glamsterdam ETH flow data,
  since new-style logs only exist after activation. **Competitive moat — and a strong
  argument against aggressively pruning our archive tier.**
- Recommend a deliberate plan for the seam: unified ETH-transfer APIs that serve
  trace-derived data before the fork and log-derived data after, so customers never see
  the discontinuity.

### 6.6 Procurement posture
- **Size archive nodes at 2.5–3× current footprint**, i.e. provision for **~8 TB per
  archive node** on the 24-month horizon. Do not buy 4 TB drives for archive workloads.
- **Prefer scale-out over scale-up.** Given ~20–25% probability of the risk case (§2.7),
  favor architectures where we add capacity incrementally — separate NVMe tiers, or
  clients that support splitting history to secondary storage — over monolithic boxes we
  must forklift.
- **Keep hot state on the fastest NVMe available.** State access is uniformly random by
  construction (§1.2); the ~250–400 GiB working set benefits disproportionately from
  low-latency media and generous page cache. Spend on RAM and NVMe latency here rather
  than on capacity.
- **Full nodes: 4 TB is adequate through the window.** Archive is where the money goes.
- **Do not defer purchases waiting for a protocol fix.** Nothing arriving before 2028
  shrinks what we already store. Buy on the base case, with a scale-out path for the risk
  case.

### 6.7 What to tell finance in one paragraph

> Ethereum is deliberately increasing throughput over the next two years, and our storage
> costs scale with it. The protocol changes arriving in Q4 2026 are real and helpful, but
> they are designed to *prevent an exponential blowup*, not to reduce our current
> footprint — the technologies that would actually shrink it are research-stage and will
> not be live before 2028. Plan for archive storage at roughly 2.5× today's by Q3 2028.
> The good news is that the largest cost lever is ours, not the protocol's: modernizing
> our client storage configuration is worth up to 10× on archive disk and is entirely
> within our control.

---

## Sources

Protocol specifications and core-dev output:
- [EIP-7773: Hardfork Meta — Glamsterdam](https://eips.ethereum.org/EIPS/eip-7773)
- [EIP-8037: State Creation Gas Cost Increase](https://eips.ethereum.org/EIPS/eip-8037)
- [EIP-8038: State-Access Gas Cost Update](https://eips.ethereum.org/EIPS/eip-8038)
- [EIP-7928: Block-Level Access Lists](https://eips.ethereum.org/EIPS/eip-7928) and [BAL size analysis](https://eips.ethereum.org/assets/eip-7928/bal_size_analysis)
- [EIP-7708: ETH transfers emit a log](https://eips.ethereum.org/EIPS/eip-7708)
- [EIP-7864: Ethereum state using a unified binary tree](https://eips.ethereum.org/EIPS/eip-7864)
- [EIP-4444 implementation plan](https://hackmd.io/@hBXHLw_9Qq2va4pRtI4bIA/ryzBaf7fJx)
- [EIP-8075: Adaptive state cost to cap growth & scale L1](https://eips.ethereum.org/EIPS/eip-8075)

Ethereum Foundation:
- [Protocol Priorities Update for 2026](https://blog.ethereum.org/2026/02/18/protocol-priorities-update-2026)
- [Checkpoint #9: Apr 2026](https://blog.ethereum.org/2026/04/10/checkpoint-9)
- [Checkpoint #8: Jan 2026](https://blog.ethereum.org/2026/01/20/checkpoint-8)
- [Partial history expiry announcement (Jul 2025)](https://blog.ethereum.org/2025/07/08/partial-history-exp)
- [Glamsterdam roadmap page](https://ethereum.org/roadmap/glamsterdam/)
- [Active areas of Ethereum research](https://ethereum.org/community/research/)

Client documentation (disk sizes):
- [Geth: Archive mode](https://geth.ethereum.org/docs/fundamentals/archive)
- [Erigon: Hardware requirements](https://docs.erigon.tech/get-started/hardware-requirements)
- [Reth: System requirements](https://reth.rs/run/system-requirements/)

Analysis:
- [Paradigm: How to Raise the Gas Limit, Part 1 — State Growth](https://www.paradigm.xyz/2024/03/how-to-raise-the-gas-limit-1)
- [EVM Workloads in the Wild (arXiv 2606.19869)](https://arxiv.org/html/2606.19869)
- [Glamsterdam Prep: 10 Repricing EIPs Take Spotlight — EtherWorld](https://etherworld.co/glamsterdam-prep-begins-10-repricing-eips-take-spotlight/)
- [Glamsterdam enters final devnet phase with 200M gas-limit target — The Defiant](https://thedefiant.io/news/blockchains/ethereum-glamsterdam-final-devnet-200m-gas-limit-target)
- [Repricing risk to deployed contracts — CryptoSlate](https://cryptoslate.com/ethereums-plan-to-triple-network-speed-could-silently-break-millions-of-existing-smart-contracts/)
- [Core devs name post-Glamsterdam upgrade 'Hegota' — The Block](https://www.theblock.co/post/383275/ethereum-developers-name-post-glamsterdam-upgrade-hegota-as-2026-roadmap-takes-shape)
- [Vitalik Buterin's two-part execution-layer overhaul plan — The Block](https://www.theblock.co/news/ecosystems/2026-03-01-vitalik-buterin-lays-out-a-two-part-plan-to-overhaul-ethereums-execution-layer-from-the-ground-up-391681)
