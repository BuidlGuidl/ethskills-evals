# Ethereum State Growth: Technical Brief for Capacity Planning (2026–2028)

**Prepared:** September 23, 2026
**Audience:** Infra engineering + Finance
**Planning window:** 18–24 months (through ~Q3 2028)
**Bottom line:** Nothing on Ethereum's committed roadmap deletes state. The only shipped relief so far is *history* expiry (pre-merge pruning, already default everywhere). Glamsterdam (~Dec 2026) will slow *state* growth via gas repricing (EIP-8037/8038) while roughly tripling history accrual via a gas-limit ramp. State expiry and stateless validation are research-stage with no fork commitment inside our window. Plan for archive disk footprints to keep growing; the big savings available to us are architectural (client/storage choices), not protocol-level.

---

## 1. What is actually growing, and why

Ethereum nodes store three distinct classes of data. They grow for different reasons and get different protocol treatment — lumping them together is the #1 planning mistake.

### 1.1 State (the "live" dataset: accounts, balances, code, storage slots)

- Protocol data structure is a **Merkle Patricia Trie** keyed by hashes, mirrored into a flat key-value store by every client for fast reads. Every account and storage slot ever touched persists until explicitly cleared.
- Since Cancun (Mar 2024, EIP-6780), **SELFDESTRUCT almost never deletes anything**. State is effectively **append-only**: new accounts, new contracts, new storage slots accumulate forever; dead data is never reclaimed at the protocol level.
- Measured figures: ~**340 GiB** uncompressed Geth state (May 2025), growing ~**205 MiB/day** of new state at the 36M gas limit (this doubled from ~102 MiB/day when gas went 30M→36M — state growth scales with throughput). Call it roughly **70–100 GiB/year net** at current throughput.
- The community-measured performance cliff ("bloatnet" initiative): around **650 GiB of state**, state-access times degrade ~40%, memory consumption rises, sync slows. EF modeling (Nov 2025) projected state hitting **686 GiB–1.08 TiB by mid-2027** under the gas-limit schedules then on the table, *without* repricing. Repricing (EIP-8037, §3) is the protocol's answer to exactly this.

**Key fact for finance: no protocol mechanism — shipped or scheduled — shrinks the state dataset. Everything committed only slows its rate of growth.**

### 1.2 History (block bodies, transactions, receipts)

- Grows linearly with throughput. This is the class that *is* being addressed:
  - **Pre-merge history expiry is live.** Per EIP-4444 (which, note, remains a Draft networking EIP — it shipped as coordinated *client behavior*, not a consensus change), all execution clients now prune pre-merge block bodies/receipts by default (completed 2025–2026). This saved full nodes **300–500 GB**. Headers are retained so chain validity from genesis is still verifiable.
  - **Rolling history expiry is in progress.** At ACDE #243 (Aug 2026) developers agreed to tighten defaults to a rolling **~5–6 month (~33,000 epoch)** retention window, explicitly because the upcoming gas-limit increase is expected to **more than triple the history growth rate**. At ACDE #244 (Aug 27, 2026) this was made a **Glamsterdam readiness requirement**: all EL clients aligned on the CL block-retention window; Nethermind, Nimbus, Reth ready; Geth, Erigon, ethrex in progress. Related: EIP-8252 (Informational; no fork needed) defines a 262,144-block (~36.4-day) minimum EL reorg/state retention window; Erigon v3.5 already implements it.
- **Consequence for us:** once defaults prune to ~5 months, *the network is no longer a reliable source of older block data*. Nodes that keep it (us — we're a data company) must own it durably. Portal Network (distributed storage of history via DHT; Trin/Fluffy/Ultralight/Shisui clients) is the intended long-run retrieval layer; it is a live-but-immature side network, **not** a committed protocol dependency, and should be treated as a complement, not a recovery plan.

### 1.3 Consensus-layer data (beacon blocks, blob sidecars)

- Beacon blocks are retained on a CL-defined window; EIP-8383 (Proposed for Hegotá) would cut the required window to 8,192 epochs (~36 days) to match the EL window. Blob data is transient by design (PeerDAS since Fusaka, Dec 2025) and mostly does not burden archive disks unless we deliberately retain sidecars for L2 analytics — which we currently don't bill for and shouldn't start without a product decision.

### 1.4 The multiplier we control: client architecture

The same chain occupies wildly different disk space depending on client and mode — this dwarfs anything the protocol will do for us in the window:

| Configuration | Mainnet disk (measured, 2025–26) | Sync time | Notes |
|---|---|---|---|
| Geth archive, legacy hash-based | **12–20+ TB** | months | Full historical tries; historical `eth_getProof` works |
| Geth archive, path-based (v1.16+) | **~2–2.2 TB** (≈6.5 TB if flat states + full trie history retained) | ~2 weeks | Reverse-diff history; `eth_getProof` for old blocks needs v1.17+ with `--history.trienode=N` |
| Erigon v3 archive | **~2.03 TB** (Jun 2026) | ~18 h–days | Highest sustained write volume (~1.9 TB/day) — NVMe endurance cost |
| Reth archive (default) | **~3.1 TB** (observed Nov 2025) | days | |
| Geth/Erigon/Reth full node (pruned) | **0.5–1.4 TB** | hours–days | Post-4444 defaults |

Measured context: Geth full-node state DB ~340 GiB; state creation ~205 MiB/day at 36M gas; 2 TB-disk operators were already at **1.5–1.8 TB** in Aug 2026 (cited by ACD as the motivation for tighter expiry defaults).

---

## 2. Fork status: what is *actually* coming (verified via forkcast.org, Sep 23, 2026)

Status vocabulary: **SFI** = scheduled for a named fork (scope can still shift before mainnet); **CFI/P** = proposed/considered, not committed; **DFI** = declined for that fork; **Live** = active on mainnet; **No fork relationship** = research/client-behavior only. Specification maturity (Draft/Review/Final) is **not** an inclusion signal.

### 2.1 Live today

| Change | What it does to disk |
|---|---|
| Pre-merge history expiry (EIP-4444 behavior) | −300–500 GB on full nodes; archive unaffected (we opt out) |
| EIP-6780 SELFDESTRUCT limits (Cancun) | Sealed the "state is append-only" reality |
| PeerDAS (Fusaka, Dec 3 2025) | Blob burden moved off most node disks |
| Path-based/flat-diff archive storage (Geth 1.16+, Erigon 3) | The 20 TB → 2 TB archive compression — a *client* change, already available |

### 2.2 Glamsterdam — projected mainnet early December 2026

Schedule signals: devnet-9 (non-finality stress test) is the last devnet; **Sepolia proposed for late Sept 2026** (ACDE #244 proposed Sep 28 pending ACDC confirmation; the meta-EIP currently lists Oct 6), Hoodi late Oct, then a ~30-day security window → **mainnet targeted early December**. Forkcast's planning estimate is **Dec 2, 2026**. Treat as a target, not an announcement; the meta-EIP (EIP-7773) is still in Review.

Items relevant to storage (all **SFI** unless noted):

| EIP | Effect on our problem |
|---|---|
| **EIP-8037** — State-creation gas repricing (Scheduled at ACDE #236, May 2026) | The centerpiece for state growth: harmonizes and raises gas costs for creating accounts/contracts/storage so the post-fork gas-limit increase doesn't blow out state. Pricing derived for a ~150M-gas reference block. Does **not shrink** state; slows growth. Already acknowledged as a tuning knob: EIP-8368 (re-derive cost-per-state-byte for the 200M limit) is proposed for Hegotá. A SELFDESTRUCT gas-refill amendment was **DFI'd for Glamsterdam** (too late; deferred to Hegotá). |
| **EIP-8038** — State-access gas cost increase (SFI) | Reprices cold reads/writes for the larger state; mild deterrent to state-heavy patterns. |
| **EIP-2780** — Intrinsic gas repricing (SFI) | +25,000 gas for new-account creation; cheap transfers cheaper. Net: discourages account spam. |
| **EIP-8261** — Gas-limit schedule (Informational; client-adopted) | Mechanism for a post-fork ramp toward a **~200M gas floor** (vs 36M today). This is the throughput event that *triples+ history accrual* and *tests* whether 8037 actually holds state growth near-flat. |
| **EIP-7928** — Block-Level Access Lists (co-headliner) | Per-block read/write manifest. Enables parallel execution and… |
| **EIP-8189** — snap/2 BAL-based state healing (Networking stage) | …much faster post-fork resyncs/state catch-up. Directly relieves our sync-time pain. |
| Rolling ~5-month history expiry defaults | Glamsterdam **readiness requirement** (see §1.2). Caps full-node history; irrelevant to archive tier we opt out of — but it shrinks the pool of peers holding old data. |
| ePBS (EIP-7732, co-headliner), refund accounting (7778), ETH-transfer logs (7708), etc. | No material disk impact. |

**Net effect of Glamsterdam on us:** state growth *should* decelerate (repriced) while history accrual *triples+* (gas ramp) — with the state deceleration being a designed-but-unproven-at-scale outcome. EIP-8368/8372 (Hegotá proposals) existing at all is the tell: expect retuning.

### 2.3 Hegotá — next fork, projected ~mid-2027 (Forkcast planning estimate June 2027; scoping concludes around Devcon, Nov 3 2026)

Headliners already SFI: FOCIL and Frame Transactions (EIP-8141). Storage-relevant candidates — **all Proposed/CFI only, none committed**:

- **EIP-8025 — Optional execution proofs** (Proposed at ACDC #178, May 2026): opt-in zkEVM proof generation/verification on the consensus layer; verification cost decoupled from gas limit and state size. This is *the* on-ramp to "The Verge"-style stateless validation. Crucially: fully opt-in, changes no consensus rules, and **mandatory/stateless validation is explicitly deferred to an unspecified later fork and EIP**. Also note Verkle trees (the pre-2025 plan) were **abandoned** in favor of this ZK approach; EIP-6873 (Verge preimage retention) was DFI'd for Glamsterdam. For us in-window: irrelevant to disk; interesting for direction of travel.
- **EIP-8368 / EIP-8372** — recalibrate state-creation pricing for the 200M limit / rebalance state-gas block share. Likely-ish, but CFI.
- **EIP-8383** — CL block retention cut to 8,192 epochs (~36 days). CFI.
- **EIP-3298** — remove storage-clear refunds (further anti-bloat pricing). CFI.
- **EIP-4758** — neuter SELFDESTRUCT fully. CFI.
- **DFI'd for Hegotá** (Sep 10, 2026): **EIP-8188** (last-written block metadata — the *groundwork for state expiry*) was **declined**. This is the strongest single signal that **state expiry is not landing in our window**: its enabling metadata proposal can't even get into the fork after Glamsterdam.

### 2.4 Explicitly NOT bankable within 18–24 months

| Item | Status |
|---|---|
| **State expiry / state deletion** | No EIP with a fork relationship. Groundwork EIP (8188) DFI'd for Hegotá. Research only. |
| **Mandatory stateless / ZK validation** | EIP-8025's own FAQ defers mandating to "a separate decision for a later fork and EIP." No date. |
| **Verkle-tree state** | Abandoned direction. |
| **Portal Network as an assured retrieval layer** | Live R&D network, not a protocol commitment. Don't build a recovery plan on it. |
| **Any disk shrinkage of existing state** | Nothing on any roadmap reverses accumulated state. Ever, so far as any committed plan shows. |

---

## 3. Capacity model for the planning window (assumptions, to be re-baselined quarterly)

Scenario for one mainnet **archive** node retaining all history (path-based Geth or Erigon-class, ~2–2.5 TB today):

- **History:** currently ~1 TB class of chain data (headers+bodies+receipts). Post-Glamsterdam ramp to ~200M gas → **≥3x current accrual rate** (ACDE #243's own figure). If the ramp completes inside 2027, expect the history component of an archive node to **roughly double or triple by end-2028**. Budget the node at **5–8 TB** total by end of window, i.e., provision **8 TB NVMe** (or tier history onto HDD/object storage — both Geth `--datadir.ancient` and Erigon's file-based layout support it).
- **State:** ~350–450 GiB now. Base case: EIP-8037 holds post-fork state growth near current ~70–100 GiB/yr → **~500–650 GiB by end-2028** (brushing the 650 GiB performance cliff). Bad case: repricing under-delivers at 200M gas (elasticity estimates are short-run ~0.6; spam contracts put a floor under state-heavy demand) → **800 GiB–1 TiB+**, and we're performance-tuning around the cliff. The state scenario determines **RAM and SSD IOPS budgets as much as disk**.
- **Full/serving nodes:** rolling ~5-month expiry defaults keep them ~**1.5–2 TB** through the window even at 3x history rate — this is the tier the protocol change actually protects.
- **Hidden cost line — SSD endurance:** Erigon-class clients sustain ~20+ MB/s continuous writes (~1.9 TB/day). A consumer 1,200-TBW NVMe hits its endurance rating in ~20 months of steady state. Enterprise drives or HDD-tiering for history are the fix; put TBW in the hardware budget, not just capacity.
- **Sync:** post-Glamsterdam snap/2 (EIP-8189) + BAL-based healing should meaningfully cut resync/state-catch-up time; Erigon already rebuilds an archive in under a day. Glamsterdam fork upgrade itself needs a planned maintenance window; sync pain is worst during the post-fork gas ramp (larger blocks).

**Capex headline for finance:** migrating any remaining hash-based Geth archive (12–20 TB) to path-based or Erigon (2–2.5 TB) is a ~10x disk capex reduction *available right now*, independent of any roadmap item. The protocol will not deliver savings of that magnitude in the window; the roadmap mostly determines whether growth *stays* manageable.

---

## 4. Recommended actions

### Do now (Q4 2026)
1. **Segment the fleet explicitly** into (a) serving/full nodes — adopt client rolling-expiry defaults, standardize on 2 TB NVMe; (b) **archive tier — explicitly opt out of all expiry/pruning** in flags and config-as-code, since defaults are about to get more aggressive (this is a config-drift risk: an innocent client upgrade could silently enforce the new 5-month default — pin and audit our flags per upgrade); (c) optional blocks-only tier for cheap redundancy of raw block history.
2. **Finish the archive migration** off hash-based Geth. Standardize archive tier on path-based Geth 1.17+ (`--history.trienode=N` if we serve historical `eth_getProof`) and/or Erigon v3. Target **≤2.5 TB/node**, 8 TB provisioned.
3. **Durability of the data we sell:** with the network pruning to ~5 months, our archive copies become sole-source for older data. Ensure **≥2 geographic copies** of pre-merge + older post-merge history; export canonical **Era/EraE** archives (the client-standard serialized history format) to object storage. This is a business-continuity item, not just infra hygiene.
4. **Set the Glamsterdam upgrade plan:** track Sepolia (late Sept/Oct 2026) and Hoodi (late Oct) as rehearsals; client releases + fork config ready before mainnet (~early Dec). Post-fork, watch the gas-limit ramp (EIP-8261) as the trigger for our "3x history growth" planning assumption.

### Within window (2027)
5. **Re-baseline the capacity model at the ramp:** once gas exceeds ~100M, measure actual history GiB/day and state MiB/day against this brief's assumptions. If state growth exceeds ~150 GiB/yr post-ramp, treat EIP-8037 as under-delivering and pull forward hardware/IOPS spend.
6. **Evaluate EIP-8025 (if it ships in Hegotá ~mid-2027):** opt-in proof verification could eventually let us run cheap verifying nodes for certain checks — experiment, don't budget.
7. **Watch Hegotá scope decisions** (scoping completes ~Nov 3, 2026): EIP-8368/8372 (state pricing retune) and 8383 (CL retention) passing to SFI would confirm the "growth stays bounded" thesis; anything state-expiry-shaped appearing would be a major (positive) surprise.

### Do NOT do
- Do **not** budget on state expiry, mandatory stateless validation, or Portal Network for retrieval.
- Do **not** buy disk for *reduced* future footprints on any promised protocol change; every committed change only bends the growth curve.
- Do **not** let the archive tier inherit client pruning defaults.

---

## 5. Monitoring triggers

| Signal | Source | Action if it fires |
|---|---|---|
| Glamsterdam mainnet date announced | ethereum.org blog, EIP-7773 → Final, client release posts | Lock upgrade window; start gas-ramp watch |
| EIP-8368 or 8372 → SFI for Hegotá | forkcast.org stage changes (RSS/JSON feed available) | Confirms retuning; update state model |
| Any state-expiry-enabling EIP proposed with a fork relationship | forkcast / ACD | Re-open this brief — biggest upside risk to our costs |
| EIP-8025 SFI + mandatory-successor EIP draft | forkcast / ACDC | Begin verifying-node pilot planning |
| Gas limit ≥100M post-fork | chain metrics | Re-baseline growth model (see #5) |
| Our state DB > ~550 GiB | internal dashboards | Pre-emptive IOPS/RAM investment ahead of the 650 GiB cliff |

---

## 6. Sources (checked Sep 23, 2026)

- **Forkcast (EF upgrade tracker)** — EIP fork-relationship records for 8037, 8038, 2780, 7928, 8261, 8189, 8252, 4444, 8025, 8383, 8368, 8372, 3298, 4758, 8188, 6873, 8141; upgrade projections (Glamsterdam est. 2026-12-02, Hegotá est. 2027-06-16): https://forkcast.org
- **Forkcast ACDE #244 call summary (Aug 27, 2026)** — history expiry as Glamsterdam readiness requirement, ~33,000-epoch retention alignment, Sepolia/Hoodi/mainnet schedule, 8037 SELFDESTRUCT-refill deferral, Frames SFI
- **ACDE #243 (Aug 13, 2026, via C. Kim)** — 5–6-month rolling expiry default decision; "history growth expected to more than triple" with gas-limit increase
- **EIP-7773 (Glamsterdam meta, status Review)** — https://eips.ethereum.org/EIPS/eip-7773
- **EF blog — Partial history expiry announcement (Jun 2026)** — all EL clients support EIP-4444 pruning; 300–500 GB savings
- **EF blog — Checkpoint #5 (Jul 2025)** — history expiry delivered; rolling-window as next step
- **ethresear.ch — State growth scenarios and the impact of repricings (Nov 2025)** — 340 GiB Geth state; 205 MiB/day at 36M; 650 GiB bloatnet threshold; mid-2027 projections 686 GiB–1.08 TiB without repricing; elasticity ε_s ≈ 0.6
- **Geth archive docs (Feb 2026)** — path-based archive ≈2 TB (6.5 TB with trie history), legacy 12–20+ TB, `--history.*` retention flags
- **Erigon docs + commit (Jun 2026)** — mainnet archive 2.03 TB, full 1.2 TB; EIP-8252 262,144-block retention alignment in v3.5
- **Stereum Labs hardware census (Jun 2026)** — measured client footprints and Erigon ~1.9 TB/day write endurance analysis
- **EIP-8025 spec/FAQ (forkcast + Ethereum Magicians)** — optional execution proofs; mandatory phase explicitly deferred to a later EIP/fork
- **Portal Network FAQ (notes.ethereum.org)** — history-network client status and scope