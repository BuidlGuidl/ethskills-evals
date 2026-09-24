# Ethereum State Growth: Technical & Capacity Planning Brief

**Prepared:** 23 September 2026
**Planning window:** Q4 2026 – Q2 2028 (18–24 months)
**Audience:** infrastructure team + finance

---

## 1. Bottom line

1. **Do not budget for protocol-level relief inside this window.** The changes that would
   structurally shrink an archive node — binary state trees, statelessness, state expiry —
   are not scheduled into any fork with a date on it. The next two forks (Glamsterdam,
   Nov 2026; Hegotá, targeted May 2027) contain *no* change that reduces archive disk.
2. **The protocol is moving in the opposite direction on throughput.** Gas limit is 60M today
   and the Ethereum Foundation's stated 2026 goal is "toward and beyond 100M," with 200M
   discussed post-Glamsterdam. More gas per block means more state written per block. This is
   the dominant term in your 24-month forecast, and it is a deliberate choice by the protocol,
   not an accident.
3. **There is one large, real, available-today saving, and it is client-side, not protocol-side.**
   Legacy hash-based archive nodes (Geth `--gcmode=archive` on the old hash scheme) sit at
   ~18–20 TB. Path-based archive storage, in Geth since v1.16 and usable now, stores historical
   state as reverse diffs and lands at **~2 TB** for flat state history (~6.5 TB if you also
   retain historical trie nodes for `eth_getProof`). That is a one-time **5–10x** reduction on
   your largest line item. If any of your fleet is still on hash-based archive, this is the
   single highest-value action in this brief.
4. **Glamsterdam does add a state-growth brake, but treat it as a ceiling, not a cut.**
   EIP-8037 (scheduled for inclusion) charges new accounts and storage slots ~5–7x more gas and
   meters them in a separate "state gas" dimension, explicitly targeting ~120 GiB/yr of new
   state at a 150M gas limit. That caps the *rate*; it removes nothing already on disk.
5. **Budget headline:** with a client migration to path-based/flat archive, a 4 TB NVMe per
   archive node carries you through the window with headroom. Without that migration, you are
   buying 20–30 TB per archive node and the trend line gets worse each gas-limit bump.

---

## 2. What is actually driving this at the protocol level

Three different things get called "state growth." They have different growth rates, different
fixes, and different timelines. Separating them is most of the work.

### 2.1 Live state — the current world

Ethereum's canonical state is a **Merkle Patricia Trie (MPT)**: a 16-way (hexary) radix tree
keyed by `keccak256` of the account address, with each contract owning a second, nested storage
trie keyed by `keccak256` of the slot. Every account and every non-zero storage slot is a leaf.

Three consequences drive your costs:

- **Nothing is ever deleted.** A storage slot set to zero is removed from the live trie, but
  there is no mechanism by which an account or a contract's state ages out. `SELFDESTRUCT` was
  neutered in Cancun and Glamsterdam's EIP-8246 removes its remaining burn behaviour. The live
  set is monotonically non-decreasing in practice.
- **Per-entry overhead dominates.** Measured averages are ~134 bytes per account and ~191 bytes
  per storage slot on disk — for a nominal 32-byte value. You are paying 6x overhead on the
  actual data because of hashing, node encoding, and trie structure.
- **The keccak keyspace destroys locality.** Adjacent slots in a contract land at random points
  in the trie, so state access is effectively random I/O across the whole dataset. This is why
  sync and execution are IOPS-bound, not bandwidth-bound, and why the working set must be on
  NVMe. (Binary trees, §3.4, fix exactly this via slot "pages" — but not in this window.)

**Composition** (Paradigm's breakdown, March 2024, still directionally correct): contract
storage 81.7%, accounts 14.1%, bytecode 4.3%. By application: ERC-20 ~27%, ERC-721 ~22%,
dormant contracts from dead games/gambling/DEXs ≥7.4%, L2 bridges <2%. Note the implication —
**L2 migration does not help you much**, because the state is not being produced by the things
that moved to L2.

**Sizing:** live state was ~245 GiB in early 2024, growing 2.6 GiB/month at the then-30M gas
limit. The gas limit has since doubled to 60M. Published 2026 rate estimates vary widely
(roughly 50–120 GiB/yr depending on source and measurement method), so **measure your own** —
one Geth `db inspect` across your fleet gives you a better number than anything public. Plan on
live state in the high-300s to mid-400s GiB today.

### 2.2 History — blocks, receipts, and blobs

Separate dataset: the block bodies and receipts chain. This one **already got fixed**, and you
may not have taken the saving.

- All execution clients now implement **partial history expiry (EIP-4444)**: pre-Merge block
  bodies and receipts can be dropped, worth **300–500 GB per full node**.
- **Blobs** are consensus-layer, retained ~18 days, then deleted permanently. Post-Fusaka BPO
  forks put blobs at **target 14 / max 21 per block** (Jan 2026), with further BPOs toward 48
  under discussion. At target, 18 days ≈ 130k slots × 14 × 128 KiB ≈ **230 GiB** of rolling blob
  data if you custody all columns. Under PeerDAS a normal node custodies only a subset; if you
  run **supernodes** to serve full blob data, you carry the whole figure and it scales linearly
  with every future BPO. Budget blob storage as a *growing rolling window*, separately from state.

### 2.3 Archive state — your actual problem

An archive node stores not just current state but **state at every historical block**. This is
where the 20 TB comes from, and the critical point for budgeting is:

> The size of a legacy archive node is a **client storage-design artifact**, not a protocol
> requirement.

The old hash-based scheme keys trie nodes by hash and retains every version of every touched
trie node forever — enormous duplication. The modern approach (Geth's path-based scheme, Erigon's
flat state + staged sync, Reth's design) stores a flat current state plus **reverse diffs**, and
reconstructs historical state on demand. Same queries, an order of magnitude less disk.

Current mainnet footprints (client docs and 2026 operator reports; verify against your own
before purchase):

| Client | Archive footprint | Notes |
|---|---|---|
| Geth, path-based, flat state history | **~2 TB** | v1.16+; `--gcmode archive`, `--history.state=0` |
| Geth, path-based + historical trie nodes | **~6.5 TB** | needed for historical `eth_getProof`; `--history.trienode=N`, v1.17+ |
| Erigon 3 archive | **~1.8–2.2 TB** | lowest reported; verify |
| Reth archive | **~2.8 TB** | |
| Geth, legacy hash-based archive | **~18–20 TB** | the number you are probably living with |

Geth's path-based archive also syncs in roughly **two weeks** rather than months, and supports
`--datadir.ancient` to put cold state history on cheap HDD — directly addressing your sync-time
complaint as well as your disk complaint.

**Caveat worth flagging to the team:** historical Merkle proofs (`eth_getProof` at old blocks)
are unavailable on path-based archive unless you explicitly retain trie nodes, which is what
moves you from 2 TB to ~6.5 TB. If you sell proof-serving as a product feature, size for the
6.5 TB tier — but only on the subset of nodes that need it, not the whole fleet.

---

## 3. What is coming to Ethereum, and how much you can bank on it

Ranked by how much weight I would put on it for a purchase decision.

| Change | Fork / date | Effect on your disk | Bank on it? |
|---|---|---|---|
| Path-based / flat archive storage | **Shipped** (client-side) | **−5 to −10x on archive** | **Yes — today** |
| Partial history expiry (EIP-4444) | **Shipped** | −300–500 GB per full node | **Yes — today** |
| State-creation repricing (EIP-8037/8038) | Glamsterdam, target **4 Nov 2026** | Caps state *growth rate*; no reduction | Yes, with slippage |
| Gas limit 60M → 100M+ → 200M | Continuous, validator-signalled | **Increases** state growth | Yes — plan against it |
| Full rolling history expiry (1-year window) | In progress, no fork date | −GB on full nodes; **archive unaffected** | Partially |
| Binary state tree (EIP-7864) | **No fork assignment** | Smaller proofs/witnesses; disk effect unclear | **No** |
| Statelessness | "groundwork" in Hegotá (May 2027) | None for archive | **No** |
| State expiry | Research only | Would be the real fix | **No** |

### 3.1 Glamsterdam — target 4 November 2026 (Sepolia 21 Sep, Hoodi 5 Oct)

Headliners are ePBS (EIP-7732) and Block-Level Access Lists (EIP-7928). Relevant to you:

- **EIP-8037, State Creation Gas Cost Increase** — the meaningful one. Introduces a second gas
  dimension: transactions get a `state_gas_reservoir` alongside normal `gas_left`, and state
  creation is charged at **CPSB = 1,530 gas per state byte**: ~183,600 gas for a new account
  (~7x today), ~97,920 gas for a new storage slot (~5x today), ~37.7M gas for a 24 KB contract
  (~8x). Stated design target: **≤120 GiB/yr of new state at a 150M gas limit** (80 GiB/yr at
  100M, 240 GiB/yr at 300M). Read that as *the protocol accepting ~100 GiB/yr of state growth as
  the price of scaling* — it is a governor, not a reduction.
- **EIP-8038** raises state-*access* costs (SSTORE first write 2,800 → 10,000; cold account
  access; CREATE to 12,000).
- **EIP-7928 (BALs)** is a throughput change, but it has an ops cost: pre-declared access
  enables prefetching, which reportedly cuts random read IOPS by ~70% but **increases node RAM
  footprint substantially** (one audit claims +75–130%; treat the exact figure as unverified,
  but the direction is real). **Provision RAM headroom on any box you buy before Glamsterdam.**
  This is the most likely way Glamsterdam surprises your fleet.
- **EIP-7708** (ETH transfers emit a log) will change your indexing pipeline's event volume and
  is a data-product concern worth a separate ticket.

Slippage risk: moderate. The EF said "first half of 2026" in February; the current target is
4 November 2026. Devnets and public testnet forks are on schedule as of this writing, so the
fork is real — but **assume a 0–3 month slip** and do not make a hardware decision that only
works if it lands on time.

### 3.2 The counter-trend: gas limit

This is the part finance needs to hear. The gas limit went 30M → 60M during 2025 (standardized
as the Fusaka default by EIP-7935) and is 60M today. The EF's 2026 priorities explicitly target
"toward and beyond 100M," and 200M is the commonly-cited post-Glamsterdam figure once BALs
enable parallel execution.

State growth scales with gas throughput. EIP-8037 exists precisely to stop that scaling from
being linear. **Net expectation: state growth per year stays roughly flat to modestly worse
across the window, rather than improving.** Anyone promising you relief from Glamsterdam is
reading the repricing EIPs without reading the gas-limit roadmap.

### 3.3 History expiry, continued

Full rolling history expiry — a 1-year window (82,125 epochs) after which clients neither store
nor serve older history on the p2p network — is in progress under EIP-7927, with no fork date.
Two implications:

- **Full nodes** get a further saving when it lands.
- **You do not.** As a data company you need that history, so you will be sourcing it from your
  own cold storage, Portal Network, or torrent/IPFS distributions. Budget a **cold history
  archive on object storage** as a deliberate line item, because the p2p network is going to stop
  being a reliable source for it. This is a quiet but real new cost being pushed onto data
  providers.

### 3.4 Binary trees, statelessness, state expiry — the aspirational tier

- **EIP-7864 (unified binary state tree)** replaces the hexary MPT with a binary tree using
  BLAKE3 (Poseidon2 later), merging account and storage tries into one 32-byte keyspace and
  grouping adjacent slots into pages. Benefits: ~75% smaller proofs, ~3–4x fewer branches, big
  proving-cost reduction, better locality. It is genuinely in progress — but **it is not
  scheduled into any fork**, and the EF's own September 2026 Hegotá tier list does not include
  it. Supporting work is visible (EIP-8253, bumping nonces of zero-nonce accounts to simplify
  trie migration, is B-tier; EIP-8188 is deferred "waiting for the trie-migration design"),
  which tells you the migration design is *still being designed*.
- **Note for anyone quoting older material:** Verkle trees are superseded. Several 2026 press
  articles still list "Verkle" as a Hegotá candidate; the work moved to binary trees. If a vendor
  or a board deck cites Verkle, it is out of date.
- **Statelessness** is listed as "groundwork" for Hegotá (target 19 May 2027). Even when it
  lands, it helps *validators* stop holding state. It does nothing for an archive node whose
  entire product is holding state.
- **State expiry** — the only change that would actually shrink what you store — remains
  research. Vitalik's own framing puts it in the long term, after binary trees.

**Realistic earliest date for a binary tree migration on mainnet: 2028.** Outside your window.
And note the migration itself is likely to be a *transient capacity event* (running both trees,
or a re-sync) rather than an immediate saving — when it does approach, budget for a temporary
disk spike, not a windfall.

---

## 4. Planning numbers

Growth of **new** state to add on top of today's footprint, per archive node. Use these as
scenario bounds, not forecasts; replace with your own measured baseline as soon as you have it.

| Scenario | Gas limit path | New state / yr | 24-month state delta |
|---|---|---|---|
| Conservative | stays 60M, Glamsterdam slips | ~50–70 GiB | ~100–140 GiB |
| **Central (plan to this)** | 100M by mid-2027, EIP-8037 active | ~80 GiB | **~160 GiB** |
| Aggressive | 150–200M, repricing under-tuned | ~120–160 GiB | ~240–320 GiB |

Archive nodes carry historical state diffs on top of live state, so scale the delta by your
client's observed diff-to-state ratio (measure over one month; do not assume).

**Per-node sizing recommendation:**

| Tier | Today | +24 months | Buy |
|---|---|---|---|
| Full node (execution) | 0.9–1.3 TB | ~1.5 TB | 2 TB NVMe |
| Archive, flat state history | ~2 TB | ~2.5–3 TB | **4 TB NVMe** |
| Archive + historical trie nodes (proofs) | ~6.5 TB | ~8 TB | 8–10 TB NVMe, or 4 TB NVMe + HDD ancient |
| Blob supernode (rolling) | ~230 GiB | grows with each BPO | 1 TB, re-evaluate per BPO |
| Cold history (object storage) | new line item | grows ~linearly | S3/equivalent, cheap tier |

The comparison that matters for the board: **4 TB NVMe per archive node after client migration,
versus 20–30 TB per node if you stay on legacy hash-based archive.** The protocol is not what
decides which of those two numbers you pay.

---

## 5. What to do in the meantime

Ranked by payoff per unit of effort.

1. **Migrate every legacy hash-based archive node to path-based / flat-state archive.**
   Geth v1.17.x with `--gcmode archive --history.state=0`, or Erigon 3, or Reth. 5–10x disk
   reduction, ~2-week resync instead of months. Do this before any hardware purchase — it likely
   cancels the purchase. *(Validate on one node first: confirm your full RPC surface still
   answers correctly, especially historical `eth_getProof` and any trace methods.)*
2. **Split the fleet by query class instead of running uniform archive nodes.** Most production
   query volume hits recent state. Run a small number of true archive nodes for deep history and
   a larger pool of full nodes (~1.3 TB each) for hot queries. Retain historical trie nodes on
   only the nodes that actually serve proofs. This is usually a bigger saving than any protocol
   change on the roadmap.
3. **Stop resyncing; snapshot and restore.** Maintain your own periodic archive snapshots on
   object storage. Restoring from snapshot is hours; syncing is weeks. This converts your
   sync-time problem from a protocol problem into a bandwidth bill.
4. **Take the history-expiry saving on full nodes now** — 300–500 GB each, already available in
   all clients.
5. **Move cold state history to cheaper media.** `--datadir.ancient` on HDD or network storage;
   keep only the hot working set on NVMe. Archive access patterns tolerate this; validator-facing
   ones do not.
6. **Provision RAM headroom on anything bought before Glamsterdam.** BAL-driven prefetching
   trades IOPS for memory. If you are buying now, buy more RAM than current utilisation suggests.
7. **Plan an owned cold-history tier.** Rolling history expiry will remove the p2p network as a
   dependable source of old blocks and receipts. You want your own copy before that lands, not
   after.
8. **Instrument growth as a monitored metric, not an annual surprise.** Weekly `db inspect` per
   node, broken down by live state / state history / history / blobs, on a dashboard. Everything
   in §4 should be replaced by your own trend line within a quarter — and it gives finance an
   actual model instead of a guess.
9. **Client diversity is a cost lever here, not just a safety one.** Erigon and Reth archive
   footprints differ meaningfully from Geth's. Running a mixed fleet both hedges consensus bugs
   and lets you place each workload on the cheapest client that serves it.

---

## 6. Watch list — what would change this plan

- **Glamsterdam mainnet activation slipping past January 2027**, or EIP-8037 being dropped from
  the final list (it is "scheduled for inclusion," not immutable — confirm against the final
  meta EIP-7773 before the fork).
- **Gas limit signalling above 100M**: each step up moves you toward the aggressive row in §4.
  Watch validator signalling directly, not press coverage.
- **New BPO forks raising blob targets** (48 blobs discussed): re-sizes the blob tier each time.
- **Binary tree (EIP-7864) getting a headliner slot in a named fork.** That is the signal that a
  structural change is real. Until an EIP has a fork and a date, it is a research programme.
- **Post-Glamsterdam RAM incidents** in the wider operator community after ePBS/BALs go live.

---

## Sources

- [Ethereum Foundation — Protocol Priorities Update for 2026](https://blog.ethereum.org/en/2026/02/18/protocol-priorities-update-2026)
- [Ethereum Foundation — The Hegotá EIP Opinion Post and Tier List (Sept 2026)](https://blog.ethereum.org/2026/09/07/protocol-hegota-eips)
- [Ethereum Foundation — Partial history expiry announcement](https://blog.ethereum.org/2025/07/08/partial-history-exp)
- [go-ethereum docs — Archive mode (path-based)](https://geth.ethereum.org/docs/fundamentals/archive)
- [EIP-7773: Glamsterdam Meta](https://eips.ethereum.org/EIPS/eip-7773)
- [EIP-8037: State Creation Gas Cost Increase](https://eips.ethereum.org/EIPS/eip-8037)
- [EIP-8007: Glamsterdam Gas Repricings](https://eips.ethereum.org/EIPS/eip-8007)
- [EIP-7928: Block-Level Access Lists](https://eips.ethereum.org/EIPS/eip-7928)
- [EIP-7864: Ethereum state using a unified binary tree](https://eips.ethereum.org/EIPS/eip-7864)
- [EIP-7927: History Expiry Meta](https://eips.ethereum.org/EIPS/eip-7927)
- [EIP-4444: Bound Historical Data in Execution Clients](https://eips.ethereum.org/EIPS/eip-4444)
- [Paradigm — How to Raise the Gas Limit, Part 1: State Growth](https://www.paradigm.xyz/writing/how-to-raise-the-gas-limit-1)
- [EIPsInsight — Network Upgrades schedule](https://eipsinsight.com/upgrade)
- [ethereum.org — Fulu-Osaka (Fusaka)](https://ethereum.org/roadmap/fusaka/)
- [The Block — Final Fusaka BPO fork](https://www.theblock.co/post/384709/ethereum-rolls-out-final-planned-blob-parameters-only-fork-as-final-step-in-fusaka-upgrade)
- [The Block — Hegotá named as 2026 roadmap takes shape](https://www.theblock.co/post/383275/ethereum-developers-name-post-glamsterdam-upgrade-hegota-as-2026-roadmap-takes-shape)
- [Vitalik Buterin — A Theory of Ethereum State Size Management](https://hackmd.io/@vbuterin/state_size_management)
