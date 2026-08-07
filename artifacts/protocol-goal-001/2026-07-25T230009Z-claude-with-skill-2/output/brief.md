# Ethereum State Growth: Technical & Capacity-Planning Brief

**Date:** 2026-07-25
**Audience:** infrastructure engineering + finance
**Planning window:** ~18–24 months (through mid-2028)
**Verified against:** Forkcast (ACD call artifacts, devnet specs, EIP fork-status data), the EIP specs
themselves, the Eth R&D Discord archive, and a live mainnet RPC query. Source list and
re-verification commands in the appendix.

---

## 0. Executive summary

**The one-line answer for finance:** Real relief is coming, it is unusually concrete for an
Ethereum roadmap item, and it is *not* the thing most people think it is. It is a large gas
repricing that lands with the Glamsterdam fork — realistically Q4 2026 to Q1 2027 — not Verkle
trees, not statelessness, and not state expiry. Budget for roughly two more years of unmitigated
growth on archive nodes, and treat the repricing as bending the curve rather than reversing it.

**The five things that matter:**

1. **The driver is economic, not structural.** Creating permanent state on Ethereum has been
   drastically underpriced since 2016. A new storage slot costs 20,000 gas — a few cents — and
   obliges every archive node operator on earth to store it forever. The gas-limit increase from
   30M to 60M more than tripled daily state creation (~105 MiB/day → ~326 MiB/day, per EIP-8037's
   measurements), because it removed the binding constraint on an activity that was never priced
   at cost.

2. **The fix is real and scheduled.** EIP-8037 (State Creation Gas Cost Increase) and EIP-8038
   (State-access gas cost update) were **ratified SFI — Scheduled for Inclusion — on 23 July 2026**,
   two days before this brief, at All Core Devs–Consensus #183. They raise the cost of a new
   storage slot roughly **5x** and a new account roughly **7x**, and — more importantly — introduce a
   *separate gas dimension for state creation* so that future gas-limit increases no longer buy
   proportionally more state growth.

3. **Statelessness is not in your planning window.** Verkle trees are dead (all Verkle EIPs are
   `Stagnant`). The binary-tree successor, EIP-7864, has **no fork relationship at all** — it is not
   scheduled, not confirmed, not even formally proposed for Hegotá (2027). The `state-expiry`
   R&D Discord channel was **archived in May 2026** for 18 months of inactivity. Do not put a line
   in the budget for statelessness before 2029.

4. **History expiry is already usable and is being under-exploited.** It is *not* arriving via a
   fork — EIP-4444 is `Stagnant`. It shipped as **client-level configuration**, and every major
   client now supports some form of it. There is a merged standard archival format (`ere`) for
   cold history. This is available to you *today* and is the single largest near-term saving on
   your bill — but note carefully that it addresses **history**, not **state**. See §1, where we
   decompose your disk usage, because these are different problems with different fixes.

5. **Glamsterdam also adds two new costs for a data company specifically.** Block-Level Access
   Lists (EIP-7928) are a new per-block artifact that archive nodes may need to retain
   indefinitely, and EIP-7708 (ETH transfers emit a log) will meaningfully increase log volume —
   while simultaneously eliminating your need to run tracing for ETH transfer detection. Both are
   in the SFI set. Plan for them. See §5.

**Budget guidance:** Assume no protocol relief before **Q1 2027** and size hardware accordingly.
The two-year exposure without mitigation is roughly **+230–290 GiB of live state per node**, on top
of whatever multiple your archive layout applies. With the repricing landing on schedule, the
post-fork steady state is a stated design target of **~120 GiB/year** even at a 150M gas limit —
i.e. roughly today's absolute growth rate, but purchased at 2.5x today's throughput. That is the
real win: state growth gets decoupled from throughput growth.

---

## 1. What is actually driving this — and a necessary correction to the framing

Before the protocol mechanics, one distinction is worth being pedantic about, because it changes
which fixes apply to you. "Archive node disk keeps climbing" is four separate growth curves in a
trench coat, and they have four different remedies:

| Component | What it is | Grows with | Remedy |
|---|---|---|---|
| **Live state** | Current accounts + storage slots + contract code | Net *new* state creation | Gas repricing (EIP-8037) — **scheduled** |
| **Historical state** | Every past version of state, as diffs/changesets | State *writes* per block (not state size) | Gas repricing (EIP-8038) — **scheduled** |
| **History** | Blocks, transactions, receipts, logs | Calldata + tx volume | History expiry — **available now, client-side** |
| **Indices** | Tx lookup, log/bloom index, trace index | Your own query surface | Your architecture; not a protocol issue |

Most published commentary about "Ethereum state growth" concerns the first row, because that is
what constrains ordinary validators. For an archive fleet, rows two and four are usually the ones
actually eating your budget, and row three is the one with an unclaimed fix sitting on the table.
The protocol changes below help rows one and two; §6 addresses rows three and four, which are
under your control today.

### 1.1 How Ethereum stores state

Ethereum's state is a **Merkle Patricia Trie** (MPT) — a 16-way radix trie, keyed by
`keccak256(address)` for accounts and `keccak256(slot)` for storage, with every node hashed into
a single 32-byte state root committed in each block header.

Three structural properties of this design drive your costs:

**Keys are hashes, so access is random.** Because keys are `keccak256` outputs, logically adjacent
data (a contract and its storage) is scattered uniformly across the keyspace. Every state read is
an independent random seek. This is why state access degrades as state grows — you are walking a
trie whose depth grows with `log₁₆(n)` but whose *working set* long ago stopped fitting in page
cache. This is a database problem disguised as a cryptography problem.

**The trie is wide, so proofs are fat.** With a branching factor of 16, each level of a Merkle
proof must include 15 sibling hashes. This costs ~3–4x more proof data than a binary trie would —
the observation motivating EIP-7864, and the reason proof size, not state size, is what actually
blocks statelessness.

**Every write is a root-to-leaf path rewrite.** Changing one storage slot dirties every trie node
from that leaf to the root. On an archive node these intermediate nodes are the dominant cost —
and this is precisely why archive growth tracks *write volume*, not state *size*. It also explains
why EIP-8038's +257% increase on `STORAGE_WRITE` matters more for your fleet than EIP-8037's
headline state-creation change, even though the latter gets the attention.

### 1.2 The economic root cause, with numbers

The gas schedule for state operations was largely set in 2016 (Frontier/Homestead) and last
seriously revisited in **March 2021** (EIP-2929, Berlin). Ethereum's state has grown enormously
since, and the prices did not move. Three specific mispricings:

- **State creation is priced far below its true cost.** A new storage slot costs 20,000 gas. That
  buys 64 bytes of state that every archive node must retain permanently. There is no recurring
  charge — it is a one-time fee for an unbounded-duration obligation. This is the core defect.
- **Different ways of creating state cost wildly different amounts.** Per EIP-8037's own analysis,
  contract deployment costs ~200 gas per new byte while storage slots cost ~313 gas per new byte —
  a ~56% spread for identical work. Deploying *duplicate* bytecode costs the same as novel
  bytecode, even though clients deduplicate it and store it once.
- **State access is priced for a much smaller state.** EIP-8038's benchmarking finds current
  clients sustain roughly **20 Mgas/s** on state-heavy workloads. The repricing targets **100
  Mgas/s** — meaning the gas schedule currently overstates achievable throughput by ~5x on exactly
  the operations that hurt you.

### 1.3 The measured impact of the gas-limit increase

From EIP-8037's motivation section (its data, our arithmetic where noted):

| Metric | Value |
|---|---|
| Geth state DB size, Jan 2026 | **~390 GiB** |
| Daily new state, 30M gas limit | ~105 MiB/day |
| Daily new state, 60M gas limit | **~326 MiB/day** |
| Implied annual growth, current 60M limit | **~116 GiB/year** |
| Threshold at which nodes degrade | **~650 GiB** |
| Extrapolated growth at a 200M limit | **~387 GiB/year** |
| Time to breach 650 GiB at a 200M limit | **< 1 year** |

Confirmed live for this brief: mainnet gas limit is **60M** as of block 25,612,949 (2026-07-25).

The critical and slightly alarming detail: **the response was non-linear.** Doubling the gas limit
tripled state creation. EIP-8037's authors read this as a one-off behavioural shift rather than a
stable ratio, but either way the naive assumption "state growth scales linearly with gas limit" is
empirically wrong in the pessimistic direction. Any capacity model you have built on that
assumption is under-forecasting.

**Your unmitigated 24-month exposure.** At ~116 GiB/year from a July 2026 base of roughly 448 GiB
(390 GiB in January plus six months of growth), live state reaches **~680 GiB by mid-2028** —
crossing the 650 GiB degradation threshold in roughly Q1–Q2 2028. That is your no-relief scenario,
and note it assumes the gas limit *stays* at 60M, which it will not (§4.3).

---

## 2. What is coming: confidence-tiered

Every claim below is tagged with its actual governance status. The tiers are not editorial
judgement — they map to EIP-7723's formal inclusion states, which is what the core devs
themselves use.

### Tier 1 — Locked in: Glamsterdam (SFI, ratified 23 July 2026)

At ACD-Testing #88 (20 July) the testing team confirmed all devnet-7 EIPs met the four SFI
criteria; at ACD-Consensus #183 (23 July) they were **formally ratified SFI**. Barring a
catastrophic devnet failure, these ship. This is the strongest status a change can have short of
being live on mainnet.

The full SFI set is 23 EIPs. The four that matter for state growth:

#### EIP-8037 — State Creation Gas Cost Increase ★ the headline fix

Introduces `CPSB` ("cost per state byte") **= 1,530 gas**, and prices all state creation uniformly
by bytes created:

| Operation | Today | After EIP-8037 | Multiple |
|---|---|---|---|
| New storage slot (`SSTORE`) | 20,000 | 64 × 1,530 = **97,920** | **4.9x** |
| New account (`CALL` w/ value, `CREATE`) | 25,000 | 120 × 1,530 = **183,600** | **7.3x** |
| Contract code, per byte | 200 | **1,530** | **7.65x** |
| EIP-7702 delegation, per auth | 12,500 | 23 × 1,530 = **35,190** | **2.8x** |

Beyond the price levels, the structurally important change is **multidimensional metering**. State
creation is charged to a *separate gas dimension* ("state-gas") from computation
("execution-gas"). At block level, fullness and base-fee updates are driven by whichever dimension
is the bottleneck, not by a single combined counter.

**Why this is the part that matters for a 24-month capacity model:** it severs the link between
throughput and state growth. Today, every gas-limit increase buys proportionally more state
growth, and you cannot forecast one without forecasting the other. After EIP-8037, compute
throughput can rise while state creation stays governed by its own budget and its own price. The
EIP explicitly targets **~120 GiB/year average state growth at a reference 150M gas limit** — a
2.5x throughput increase over today for roughly *today's* absolute state growth.

For hard-ceiling planning, the theoretical maximum is `gas_limit ÷ CPSB` bytes per block
(7,200 blocks/day at the unchanged 12s slot time — EIP-7782's block-latency reduction was
*declined* for Glamsterdam):

| Gas limit | Max new state/day | Hard ceiling/year | Design target/year |
|---|---|---|---|
| 60M (today) | 282 MB | ~96 GiB | — |
| 150M (EIP-8037 reference) | 706 MB | ~240 GiB | **~120 GiB** |
| 200M | 941 MB | ~320 GiB | — |

Plan to the design target; stress-test the hardware against the ceiling. The gap between the two
columns is the assumption that state-gas is not the binding constraint in every single block — a
reasonable assumption, but it is an assumption, and it is the one to revisit if the post-fork data
surprises you.

#### EIP-8038 — State-access gas cost update ★ the one that matters most for archive nodes

| Parameter | Current | New | Change |
|---|---|---|---|
| `STORAGE_WRITE` | 2,800 | **10,000** | **+257%** |
| `COLD_STORAGE_ACCESS` (`SLOAD`/`SSTORE`) | 2,100 | 3,000 | +43% |
| `CREATE_ACCESS` | 7,000 | 11,000 | +57% |
| `ACCESS_LIST_STORAGE_KEY_COST` | 1,900 | 3,000 | +58% |
| `ACCOUNT_WRITE` | 6,700 | 8,000 | +19% |
| `COLD_ACCOUNT_ACCESS` | 2,600 | 3,000 | +15% |
| `ACCESS_LIST_ADDRESS_COST` | 2,400 | 3,000 | +25% |
| `STORAGE_CLEAR_REFUND` | 4,800 | 12,480 | +160% |
| `WARM_ACCESS` | 100 | 100 | unchanged |

Costs were derived empirically — synthetic blocks stressing individual operations, timed across
all EL clients via the EEST benchmark suite and the Benchmarkoor tool — targeting sustainable
100 Mgas/s.

**Flag this one to your team specifically.** EIP-8037 gets the headlines, but *`STORAGE_WRITE`
+257% is the parameter that governs your archive growth*, because archive nodes store historical
state as diffs and the diff volume tracks writes rather than net new state. A slot written 1,000
times creates state once but generates 1,000 archive entries. EIP-8037 does nothing about that;
EIP-8038 nearly quadruples its price.

The `STORAGE_CLEAR_REFUND` increase to 12,480 also finally makes state *deletion* meaningfully
profitable again, which may produce a modest one-time cleanup wave post-fork as it becomes
economic to clear abandoned storage. Do not budget for it, but do not be surprised by it.

#### EIP-7976 — Increase Calldata Floor Cost

Reduces maximum block size by **~33%**. Directly bounds the growth of your history component.

#### EIP-7928 — Block-Level Access Lists (headliner)

Every block carries a declared list of accounts and storage slots it touches. Primarily enables
parallel execution and prefetching. Two consequences for you, one good and one costing money —
both in §5.

### Tier 2 — Plausible but not committed: Hegotá (2027)

Hegotá is in scoping. FOCIL (EIP-7805) is the confirmed headliner; the non-headliner submission
deadline is **6 August 2026**, so scope will firm up over the next several weeks. Items below are
**PFI ("proposed for inclusion") — the weakest formal status.** Roughly, PFI means "someone
presented it on a call." Historically most PFI items do not ship in the fork they were proposed
for. Treat as upside, not plan.

- **EIP-8188 — Last-Written Block for Accounts and Slots** *(PFI, 21 May 2026)* — the most
  interesting item for you. Adds consensus-visible last-modified timestamps to accounts and slots,
  letting clients physically separate "hot" from "cold" state. Measured on a mainnet Geth node at
  block 19,999,256: **−21.6% total disk footprint (compressed) and −58% trie nodes**
  (1,895.4M → 788.0M). The authors are explicit that this measures *static footprint only* — real
  workload replay "we have not run yet," and cold-state access requires rebuilding subtrees. A
  genuine result with a genuine unknown attached.
- **EIP-7862 — Delayed State Root** *(PFI, 2 July 2026)* — header carries pre-state rather than
  post-state root, cutting builder/prover hashing load. EIP-8341 is a competing alternative; the
  two have not been reconciled.
- **EIP-8268 — Storage Roots in Block Access Lists** *(PFI, 16 July 2026)*.
- **EIP-8146 — BAL Sidecars** *(PFI, 2 July 2026)* — gossip BALs separately from payloads so ELs
  can prefetch state before transactions arrive. A sync-performance win if it lands.

**Timing reality:** Hegotá is 2027 by Forkcast's own labelling, and 2027 currently means *scoping
has not closed*. If Glamsterdam slips into 2027 — a live possibility (§4) — Hegotá slides with it.
Anything in this tier realistically lands **late 2027 at the earliest, more likely 2028**, i.e. at
or past the far edge of your window. **Bank nothing here.**

### Tier 3 — Not in your window: statelessness, tree changes, state expiry

This is where most public commentary is wrong, and where an infrastructure budget could be
seriously mis-set. The evidence:

| Proposal | EIP status | Fork relationship |
|---|---|---|
| Unified **binary tree** | EIP-7864, `Draft` | **None** — not proposed for any fork |
| Partitioned binary tree | EIP-8297, `Draft` | **None** |
| Verkle tree | EIP-6800, **`Stagnant`** | **None** |
| Verkle state conversion | EIP-7748, `Draft` | **None** |
| Verkle gas cost changes | EIP-4762, `Draft` | **None** |
| Verkle overlay transition | EIP-7612, **`Stagnant`** | **None** |
| **Leaf-level state expiry** | EIP-7736, **`Stagnant`** | **None** |
| Stateless witnesses | EIP-4942, `Draft` | **None** |
| Preimage retention | EIP-6873, **`Stagnant`** | **Withdrawn** from Glamsterdam |

Not one of these has a fork relationship of any kind — not scheduled, not considered, not
proposed. To be precise about what that means: these are not "delayed" or "in the queue." In the
governance process that actually decides what ships, they are not in the pipeline at all.

Three further signals worth putting in front of your team:

- **The Verkle line is abandoned.** Verkle was the leading statelessness candidate for years, then
  was dropped in 2024–25 over ZK-compatibility and post-quantum concerns. Every Verkle EIP is now
  `Stagnant` or a fork-less `Draft`. Any planning document, vendor deck, or analyst report still
  citing Verkle is stale and should be discarded.
- **State expiry is dormant.** The `state-expiry` Eth R&D Discord channel was **archived on 4 May
  2026** after ~18 months of no activity, with no objection raised. Research-community silence
  this complete is about as clear a signal as this process produces.
- **There is no working group.** ACD runs standing breakout calls for ePBS, BALs, FOCIL,
  repricings, L1-zkEVM, post-quantum, SSZ, native AA, P2P, and more. **There is no state-tree or
  statelessness call series.** The `state-tree-migration` Discord channel is alive but low-traffic
  and currently discussing EIP-8188 — the incremental hot/cold measure — not tree replacement.

**What *is* actually happening in this space**, so you are not blindsided by the vocabulary: the
**L1-zkEVM** track is active and well-organised (breakout #6, 8 July 2026; spec v0.50 rebased on
Glamsterdam; multiple zkVM implementations; formal EVM semantics reaching 100% test compliance).
But its near-term deliverable is **EIP-8025, Optional Execution Proofs** — opt-in, no consensus
change, currently `Stagnant`/PFI for Hegotá — which lets *validators* verify blocks without
holding state.

Read that carefully, because it is the trap: this reduces the hardware floor for *validators*. It
does nothing for an archive operator, whose entire product is holding and serving state. When
someone tells you "statelessness is coming and will solve your problem," this is usually what they
are pointing at, and it will not solve your problem.

### History expiry — real, shipped, and not via a fork

EIP-4444 is **`Stagnant`**, and the History Expiry Meta EIP (7927) is **`Stagnant`** too. Read
naively from the EIP repo you would conclude history expiry died. **It did not** — it moved out of
the fork process into client releases, which is why the EIPs went quiet. Current client support
(from the Eth R&D `history-expiry` channel, April 2026):

| Mode | Clients |
|---|---|
| Full history | All except ethrex |
| Post-merge history | All |
| Post-Prague history | Geth, Nethermind, Reth |
| Rolling 1-year history | Reth, Erigon, Nethermind, Besu |
| Minimal history | Reth, Erigon, Besu |

The open question is the network-wide *minimum* retention floor. Candidates under discussion:

| Option | Duration | Rationale |
|---|---|---|
| 3,533 epochs (113,056 slots) | ~2 weeks | Weak subjectivity period (`SAFETY_DECAY=10`) |
| 8,192 epochs | ~1 month | WSP + safety buffer |
| **33,024 epochs (1,056,768 slots)** | **~4–5 months** | Matches long-standing CL block retention |
| 82,125 epochs | 1 year | Original EIP-4444 target |

**Nimbus-EL shipped 33,024 epochs** in a mid-2026 release, deliberately matching CL retention;
Besu has `--Xchain-pruning-blocks-retained` with a 113,056 floor; Erigon's minimal mode keeps 100k
blocks. No network-wide decision yet — see EIP-8237 for the related independent CL/EL sync work.

Also relevant and directly actionable: the **`ere` archival format spec was merged in May 2026**
(`eth-clients/e2store-format-specs` PR #16), covering execution history from genesis with
`noproofs` / `noreceipts` profiles. `erb` (blobs) and `erc` (consensus) are in progress. Geth can
already export and import these files, bootstrap from them, and state-sync on top. This is the
mechanism that lets you move history to cheap object storage while keeping it servable. See §6.

---

## 3. What we can bank on landing inside the window

| Change | Status | Confidence | Effect on your fleet |
|---|---|---|---|
| EIP-8037 state creation repricing | **SFI 23 Jul 2026** | **High** | Caps live-state growth ~120 GiB/yr at 150M gas |
| EIP-8038 state access repricing | **SFI 23 Jul 2026** | **High** | `STORAGE_WRITE` +257% → throttles archive diff volume |
| EIP-7976 calldata floor cost | **SFI 23 Jul 2026** | **High** | ~33% smaller max blocks → slower history growth |
| EIP-7928 BALs | **SFI 23 Jul 2026** | **High** | Parallel execution; **new storage obligation** |
| EIP-7708 ETH transfer logs | **SFI 23 Jul 2026** | **High** | More logs; **removes tracing dependency** |
| Client-side history expiry | Shipped | **High** | Available today; needs your engineering, not theirs |
| EIP-8188 hot/cold separation | PFI Hegotá | **Low** | −21.6% footprint if it ships; late 2027+ |
| Binary tree (EIP-7864) | No fork relationship | **Very low** | Not in window. Do not budget. |
| State expiry | Channel archived | **Very low** | Not in window. Do not budget. |
| Full statelessness | Research | **Very low** | Not in window, and mostly helps validators, not you |

---

## 4. Timing: how much can you trust "Glamsterdam"?

### 4.1 Where it actually stands (as of today)

- **glamsterdam-devnet-7**: live since 14 July 2026, stable, ~80–90% participation. Erigon and
  Grandine onboarding as the final clients.
- **All 23 devnet-7 EIPs ratified SFI** at ACDC #183, 23 July 2026.
- **devnet-8**: targeting **early August 2026** — fork-transition testing, final repricing numbers
  for EIP-8037/8038, discv5-only EL discovery.
- **devnet-9**: non-finality / chaos testing, within ~1 month.
- **First public testnet**: targeted **September 2026**.
- **Mainnet**: **no date announced.**

Devnet cadence has been brisk — devnet-0 launched 24 April 2026, eight devnets in under three
months.

### 4.2 What the precedent implies

Fusaka is the cleanest recent comparison: devnet-0 on 26 May 2025 → first public testnet
(Holešky) on 1 October 2025 → mainnet on 3 December 2025. **Roughly nine weeks from first public
testnet to mainnet**, with three testnets in sequence (Holešky, Sepolia, Hoodi).

Applied naively: September 2026 testnet + 9 weeks → **mainnet around November–December 2026**.

### 4.3 Why we would not plan on that

Four reasons to discount the naive projection:

1. **Glamsterdam is a much larger fork than Fusaka.** Fusaka's headliner was PeerDAS. Glamsterdam
   ships **ePBS (EIP-7732)** — a fundamental restructuring of block production requiring
   coordination between proposer and builder — *plus* BALs *plus* a full gas repricing, across 23
   EIPs. The Ethereum Foundation's April 2026 Checkpoint described ePBS as "trickier than
   anticipated."
2. **Known unresolved performance work.** ACDT #88 flagged SSZ stable containers running **10–20%
   slower** across clients, with an optimisation round explicitly required *before testnet*. ACDC
   #183 noted the measurement is still inconclusive at 3k validators and needs devnet-8 to resolve.
3. **The repricing numbers are not final.** ACDE #240 called EIP-8038/2780 numbers "stable for
   devnet-7" with final confirmation pending full benchmark results; the devnet-8 spec still says
   "benchmark-driven repricing updates may still land before launch." Parameter values in §2 are
   near-final but not frozen — directionally reliable, not yet exact.
4. **Two more devnets stand between here and testnet**, and devnet-9 is specifically a
   chaos/non-finality devnet — the kind that finds expensive problems.

### 4.4 Planning recommendation

| Scenario | Mainnet | Probability | Use for |
|---|---|---|---|
| Optimistic | Q4 2026 | ~25% | Upside only |
| **Base case** | **Q1 2027** | **~45%** | **Plan to this** |
| Slip | Q2–Q3 2027 | ~25% | Contingency |
| Serious slip | H2 2027+ | ~5% | Tail risk |

**Plan hardware assuming no protocol relief before Q1 2027, and assume effects are not visible in
your growth curves until roughly a quarter after activation** — repricings change developer
behaviour gradually, and there may be a pre-fork rush to create state cheaply.

**One risk that cuts the other way, and it is the important one.** The explicit purpose of the
repricing bundle is to make *higher gas limits safe*. EIP-8038 targets 100 Mgas/s against ~20
today; EIP-8037 uses a 150M reference limit; EIP-7975 exists specifically because receipt sync
breaks above ~83M. The clear direction of travel is **gas limits well above 60M soon after
Glamsterdam.**

So the realistic post-fork outcome is not "state growth falls." It is **"state growth stays
roughly where it is while throughput rises 2.5x."** That is a genuine and valuable win, and it is
also *not a reduction in your storage bill.* If your finance model assumes the repricing reduces
absolute growth, correct it now — the model should show growth **holding near ~120 GiB/year**
rather than accelerating toward the ~387 GiB/year that an unrepriced 200M gas limit would produce.
The saving is the avoided acceleration, and it is worth quantifying that way in the budget,
because it is large and it is real.

---

## 5. Glamsterdam's specific effects on an Ethereum data business

Two SFI items change your product surface, not just your disk usage. Both deserve engineering
attention well before the fork.

### EIP-7708 — ETH transfers emit a log (cost, and a significant opportunity)

Every ETH transfer — including contract-internal transfers and `SELFDESTRUCT` — emits an event log.

- **Opportunity:** ETH transfer detection stops requiring `debug_traceTransaction`. Today,
  tracking internal ETH movement means running tracing infrastructure over every block, which is
  expensive, slow, and inconsistent across clients. Post-Glamsterdam it becomes an ordinary
  `eth_getLogs` query. For a data company this is a material simplification of your ingestion
  pipeline and quite possibly a reduction in the compute side of your bill.
- **Cost:** log and receipt volume rises measurably; your log index and bloom filters grow with
  it. Note this partially offsets EIP-7976's history savings.
- **Action:** prototype the new indexing path on devnet-7 (it is running now and has been
  designated the public app-developer testing ground, with a faucet) so the migration is ready at
  fork time rather than after it.

### EIP-7928 / EIP-8159 — Block-Level Access Lists (a new storage obligation)

BALs (EIP-7928) are SFI. EIP-8159 (`eth/71` — BAL exchange over the wire) is in devnet-7/8 and was
ratified in the same SFI batch. Its tradeoffs section states directly:

> "Requires BAL storage during weak subjectivity period (~2 weeks) — **Archive nodes may need to
> store BALs indefinitely for full historical serving.**"

- **Cost:** a genuinely new per-block artifact for archive nodes, with no precedent to size
  against. Sizing is not yet published; get a measurement off devnet-7 rather than waiting.
- **Opportunity:** EIP-8159 explicitly enables "executionless state updates during sync." Since
  archive sync time is dominated by re-execution, BAL-driven sync could be the largest single
  improvement to your sync-time problem in this fork — arguably larger than the repricing. It is
  worth tracking closely, and worth participating in the BAL breakout call given it directly
  affects your operational economics.

### EIP-7975 — `eth/70` partial block receipt lists

Chunked receipt transfer, preventing sync failures above an 83M gas limit. Confirmation that
higher gas limits are actively planned — and a wire-protocol change your tooling must handle.

---

## 6. What to do in the meantime

Ordered by expected value. Items 1–3 are available now and do not depend on any protocol change.

### 1. Harvest history expiry — the largest near-term saving (available today)

Most of an archive node's disk is *history*, not state, and history expiry has shipped in every
major client while EIP-4444's `Stagnant` label led much of the industry to assume otherwise. Tier
your fleet:

- **Serving tier** — rolling recent history (start from the 33,024-epoch / ~4–5 month figure
  Nimbus-EL adopted and CL clients have used for years, or a 1-year window if you want margin).
- **Cold tier** — full history in **`ere`/`era` files** on object storage, imported on demand.
  Geth already supports export, import, bootstrap-then-state-sync from these files. This is the
  cheapest storage tier available to you and it is standardised as of May 2026.
- **Rebuild tier** — the ability to reconstruct any historical range from cold storage on demand,
  rather than keeping every node hot.

If most of your fleet currently runs full history because that is the default, this is likely a
step-change reduction in cost, achievable this quarter with no dependency on the core devs.

### 2. Audit which nodes genuinely need archive state

The most common (and most expensive) mistake in this space is uniform archive provisioning.
Measure what fraction of your query volume actually touches state older than, say, 128 blocks. In
most Ethereum data workloads it is a small minority, served by a handful of nodes, while the
majority of queries are recent-state or log/receipt queries that a full node serves fine. Split
the fleet accordingly and you decouple your largest cost line from total query growth.

### 3. Re-measure client footprints before your next hardware purchase

Archive storage efficiency has changed substantially and unevenly across clients — path-based
state schemes, reverse-diff historical state, and separate archival layouts have produced
order-of-magnitude differences between designs. Published third-party figures in this area are
frequently stale or wrong (we deliberately excluded several from this brief for that reason).

**Benchmark on your own workload before committing capital.** The variable that matters is not the
advertised disk figure but your read pattern against it: reverse-diff archives are compact but
make deep historical queries expensive to reconstruct, which may or may not match how your
customers query. This is a measurement you can complete in weeks and it may be worth more than
every protocol change in this brief combined.

### 4. Instrument state growth as a first-class metric

You cannot manage this without a time series. Track separately, per node:

- live state size and daily *new* state bytes,
- historical state / diff volume (write-driven, the archive-specific curve),
- history size (blocks, receipts, logs),
- index sizes,
- state-access latency percentiles as state grows.

Split this way, you will see EIP-8038's effect on the second line and EIP-8037's on the first,
independently, within weeks of the fork — and you will know months earlier than otherwise whether
the repricing is delivering.

### 5. Buy for the pessimistic curve; treat relief as upside

Concretely, for the next four to six quarters:

- Size for **~116 GiB/year** of live-state growth per node, plus your archive multiplier.
- Do **not** size for post-Glamsterdam relief before **Q1 2027**, and do not assume absolute
  growth *falls* after it — assume it *stops accelerating* (§4.4).
- Assume the **650 GiB degradation threshold** is reached in **Q1–Q2 2028** absent mitigation,
  and ensure your hardware refresh cycle clears it with margin.
- Prefer **shorter depreciation schedules and modular/expandable storage** over large monolithic
  purchases. The dominant uncertainty here is timing, and modularity is how you buy an option on
  timing.

### 6. Do not build any plan around statelessness or state expiry

To restate plainly for the finance-facing version: there is no scheduled protocol change that will
reduce your absolute archive storage requirement inside this planning window. EIP-8188 (−21.6%
footprint) is the only candidate and it is at the weakest formal status, targeting a fork whose
scope is still open. If a vendor, consultant, or analyst tells you Verkle trees or statelessness
will solve this by 2027, that information is stale by roughly two years — check it against §2,
Tier 3.

### 7. Get engaged where it affects your economics

You operate exactly the infrastructure these EIPs are being calibrated for, and core devs
routinely lack operational data from commercial archive operators.

- **Devnet-7 is public right now**, explicitly designated as the app-developer testing ground with
  a faucet. Run a node. Measure BAL sizes, log volume under EIP-7708, and the repricing's effect
  on state creation — before the parameters freeze.
- The **repricing numbers are not final** (§4.3). If your data shows the calibration is wrong for
  real archive workloads, the window to say so is now, not after mainnet.
- Relevant venues: the BAL breakout call, the Glamsterdam Repricings call series, `#history-expiry`
  and `#state-tree-migration` on the Eth R&D Discord.

---

## Appendix A — Key EIP reference

| EIP | Title | Status | Relevance |
|---|---|---|---|
| **8037** | State Creation Gas Cost Increase | **SFI Glamsterdam** | Caps live state growth; CPSB=1530 |
| **8038** | State-access gas cost update | **SFI Glamsterdam** | `STORAGE_WRITE` +257%; archive growth |
| **7976** | Increase Calldata Floor Cost | **SFI Glamsterdam** | −33% max block size |
| **7928** | Block-Level Access Lists | **SFI Glamsterdam** (headliner) | Parallel exec; new storage |
| **8159** | `eth/71` BAL Exchange | **SFI Glamsterdam** | BAL sync; archive retention |
| **7708** | ETH transfers emit a log | **SFI Glamsterdam** | Removes tracing dependency |
| **7975** | `eth/70` partial receipt lists | **SFI Glamsterdam** | Sync above 83M gas |
| **7732** | Enshrined PBS | **SFI Glamsterdam** (headliner) | Main schedule risk |
| **7981** | Increase Access List Cost | **SFI Glamsterdam** | Block size |
| **8188** | Last-Written Block for Accounts/Slots | PFI Hegotá | −21.6% footprint (measured, static) |
| **7862** | Delayed State Root | PFI Hegotá | Prover/builder load |
| **8025** | Optional Execution Proofs | `Stagnant` / PFI Hegotá | Stateless *validation*, not storage |
| **7864** | Unified binary tree | `Draft`, **no fork** | Not in window |
| **6800** | Unified Verkle tree | **`Stagnant`** | Abandoned |
| **7736** | Leaf-level state expiry | **`Stagnant`** | Dormant |
| **4444** | Bound Historical Data | **`Stagnant`** | Superseded by client-level implementation |
| **7642** | `eth/69` history expiry, simpler receipts | **`Final`** | Live since Pectra |

## Appendix B — Sources

Primary, in the order the protocol skill recommends:

1. **Forkcast** (`forkcast.org`) — upgrade data, EIP fork relationships, devnet specs, ACD call
   TLDRs and key decisions. Specifically: ACDE #240 (2 Jul 2026), ACDE #241 (16 Jul 2026), ACDT #88
   (20 Jul 2026), **ACDC #183 (23 Jul 2026 — the SFI ratification)**, L1-zkEVM breakouts #4 and #6;
   `glamsterdam-devnet-7.json` and `glamsterdam-devnet-8.json`; `src/data/eips/*.json`;
   `src/data/upgrades.ts`; `src/data/events.ts`.
2. **EIP specifications** — full text of EIP-8037 and EIP-8038 (all parameter tables and the state
   growth measurements in §1.3 are quoted directly from these).
3. **`ethereum/eth-rnd-archive`** — `#history-expiry` (Apr–Jun 2026: client support matrix,
   retention debate, `ere` format), `#state-expiry` (archival notice, 4 May 2026),
   `#state-tree-migration` (EIP-8188 results, Jun 2026), `#node-requirements`, `#gas-limit-testing`.
4. **ethresear.ch** — "Hot-Cold Storage Separation in Practice" (EIP-8188 measurements).
5. **Ethereum Foundation blog** — Checkpoint #9 (10 Apr 2026), for the ePBS complexity assessment.
6. **Live mainnet RPC** — gas limit confirmed at 60M, block 25,612,949, 2026-07-25.

Web search was used only to orient the initial research. **No claim in this brief rests on a
search result** — every status, parameter, and date was verified against the primary sources above,
because secondary coverage of Ethereum roadmap items is unusually unreliable (most of it still
describes Verkle trees as forthcoming).

## Appendix C — How to re-verify this brief

Protocol status changes. Anything here is worth re-checking quarterly, and the Hegotá scope
specifically after the **6 August 2026** submission deadline.

```bash
# Current fork scope and status, straight from the source data
git clone --depth 1 https://github.com/ethereum/forkcast.git
python3 - <<'EOF'
import json, glob
for f in glob.glob('forkcast/src/data/eips/*.json'):
    d = json.load(open(f))
    for fr in d.get('forkRelationships') or []:
        if fr['forkName'] in ('Glamsterdam', 'Hegota'):
            print(fr['forkName'], (fr['statusHistory'] or [{}])[-1].get('status'), d['title'])
EOF

# Latest ACD call decisions (dates from src/data/protocol-calls.generated.json)
curl -sL https://forkcast.org/artifacts/acde/<YYYY-MM-DD>_<NNN>/key_decisions.json
curl -sL https://forkcast.org/artifacts/acdc/<YYYY-MM-DD>_<NNN>/tldr.json

# Current devnet scope
curl -sL https://raw.githubusercontent.com/ethereum/forkcast/main/src/data/devnets/glamsterdam-devnet-8.json

# Individual EIP specs as markdown
curl -sL https://forkcast.org/eips/8037.md

# Current mainnet gas limit
curl -s -X POST https://ethereum-rpc.publicnode.com -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_getBlockByNumber","params":["latest",false]}'
```

**Two rules for anyone re-checking this.** First, an EIP's `status` field (`Draft`, `Review`,
`Final`) says nothing about whether it ships — `Final` core EIPs can sit unscheduled for years,
and `Draft` EIPs ship every fork. Only the **fork relationship** (SFI/CFI/DFI) matters. Second,
`Stagnant` does not always mean dead: EIP-4444 is `Stagnant` because history expiry *succeeded*
and moved into client releases. Check whether work relocated before concluding it stopped.
