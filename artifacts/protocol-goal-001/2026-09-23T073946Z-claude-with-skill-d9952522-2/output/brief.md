# Ethereum State Growth: Technical & Capacity-Planning Brief

**Prepared:** 2026-09-23
**Audience:** infrastructure engineering + finance
**Planning window:** Q4 2026 → Q3 2028 (~24 months)

**Bottom line for finance:** budget as if **no protocol change removes your archive storage problem inside the planning window**. One upgrade (Glamsterdam) does contain real state-growth brakes and is likely to land in the next few months, but it *slows the rate of growth* — it does not shrink anything you already store. The changes that would structurally reduce node storage (state expiry, a new state tree, statelessness) are **not scheduled for any fork** and have no credible mainnet date. Plan on linear-to-superlinear growth and buy accordingly; treat any relief as upside.

---

## 1. What is actually driving this at the protocol level

### 1.1 Two different things are growing, and they have different fixes

Operators usually say "state growth," but an archive node's disk is carrying three distinct datasets with three different growth drivers and three different mitigation paths:

| Dataset | What it is | Roughly | Growth driver | Mitigation path |
|---|---|---|---|---|
| **Active state** | The current account + storage trie: every account, balance, nonce, storage slot, contract code | ~390 GiB in Geth as of Jan 2026 (per EIP-8037) | Net *new* accounts, storage slots, and deployed code | Gas repricing (near term); state expiry / new tree (long term) |
| **History** | Headers, block bodies, receipts for every block ever | 400+ GiB and growing | Block throughput (gas limit, calldata, tx count) | **EIP-4444 — already shipping** |
| **Archive data** | Every historical state *diff* / intermediate trie node, so you can answer `eth_call` at block N | ~2 TB (modern layouts) | Rate of state *mutation*, i.e. writes per block | Client storage engine design only — **no protocol fix planned** |

This distinction matters for your budget: **the archive-specific component is the one with no protocol relief on the roadmap at all.** Every roadmap item below addresses active state or history. Historical-state-at-every-block is, and remains, an application-layer/client-engineering problem — which is exactly the business you're in.

### 1.2 Why active state grows the way it does

Ethereum stores state in a hexary Merkle Patricia Trie (MPT), keyed by `keccak256` of the account address, with each contract's storage in its own sub-trie. Two consequences drive your pain:

1. **Nothing is ever removed.** A storage slot or account, once created, persists forever unless explicitly zeroed by a contract. There is no protocol-level expiry, rent, or garbage collection. `SELFDESTRUCT` was neutered by EIP-6780 (Cancun), so even that escape hatch is gone.
2. **Access cost is uncorrelated with state size.** Gas costs for `SLOAD`/`SSTORE`/`CALL` were last meaningfully repriced by EIP-2929 in **Berlin, March 2021**. The state has grown enormously since; the price of touching it has not moved. Random reads against a larger trie mean deeper paths, more cache misses, and more IOPS per unit of gas — the gas schedule has been silently under-charging for disk work for five years.

Critically, the MPT's hexary branching factor means each proof/read path touches many intermediate nodes. This is what makes state size translate into *sync time* and *IOPS*, not just bytes — which is why your sync times degrade faster than your disk fills.

### 1.3 The gas limit is the accelerant

The mainnet gas limit went from 30M to 60M during 2025 (validator-signalled, then standardised as the default by EIP-7935 in Fusaka, live 2025-12-03). The measured effect, per EIP-8037's data:

- Daily new state **more than tripled**, from ~105 MiB/day to ~326 MiB/day — from a **2×** gas limit increase.
- That is **~116 GiB/year** of new active state at 60M gas.
- Client performance is observed to degrade past roughly **650 GiB** of state.
- Extrapolated to a **200M** gas limit (the stated Glamsterdam-era ambition), growth would be **~387 GiB/year**, breaching 650 GiB in under a year from a 390 GiB start.

**Read that last line as the core planning risk.** The protocol's scaling agenda for 2026–2027 is explicitly to raise L1 execution throughput several-fold. Absent countermeasures, that multiplies your state growth rate by ~3×. The countermeasures are real (§2.1) but they are calibrated to *permit* the throughput increase, not to give operators headroom back.

---

## 2. What is coming, and how much you can bank on it

Status vocabulary used below: **Live** (on mainnet now) · **SFI** (Scheduled for Inclusion in a named fork) · **CFI** (Considered) · **DFI** (Declined) · **No fork relationship** (research/proposal only). Note that an EIP being "Draft," "Review," or "Final" describes *spec maturity only* and says nothing about whether it will ship.

### 2.1 Glamsterdam — SFI, mainnet targeted Q4 2026, **not yet scheduled**

Glamsterdam is the next fork. Per the meta EIP (EIP-7773), **18 EIPs are Scheduled for Inclusion**. Its activation table currently has **Sepolia filled in (epoch 353024, 2026-10-06 13:53 UTC), Hoodi and Mainnet blank.** Hoodi is tentatively 2026-10-27. Core devs target Q4 2026 mainnet and have discussed December, but **no mainnet epoch has been agreed**, and Glamsterdam has already slipped once (ePBS engineering). Devnet-11 did complete a Gloas transition and ran at a 200M gas limit without losing finality on 2026-09-16, which is a genuine signal that the throughput work is real.

**Confidence for planning: high that it ships, moderate that it ships in 2026.** Assume Q4 2026–Q1 2027. A one-quarter slip should not break your plan.

The state-relevant contents:

| EIP | Status | What it does for you |
|---|---|---|
| **EIP-8037** State Creation Gas Cost Increase | SFI | **The single most important item in this brief.** Introduces `CPSB` (cost per state byte) = 1,530 gas, harmonising the cost of *all* state creation (new accounts, new storage slots, deployed code, 7702 delegations). Explicitly calibrated to target **~120 GiB/year of state growth at a 150M gas limit**. Also introduces **two-dimensional gas metering**: execution-gas and state-gas are counted separately, and a block is full when *either* dimension hits the limit. |
| **EIP-8038** State-access gas cost update | SFI | First state-access repricing since Berlin. `COLD_ACCOUNT_ACCESS` 2,600→3,000; new explicit `STORAGE_WRITE` surcharge 2,800→**10,000 (+257%)**; `ACCOUNT_WRITE` 6,700→9,000; `EXTCODESIZE`/`EXTCODECOPY` charged for their second DB read. |
| **EIP-7976** Increase Calldata Floor Cost | SFI | Calldata 10/40 → 64/64 gas per byte. Cuts max block size ~37%. Pushes data to blobs. |
| **EIP-7981** Increase Access List Cost | SFI | Access lists charged 64 gas/byte. Cuts max block size a further ~21%. |
| **EIP-7778** Block Gas Accounting without Refunds | SFI | Refunds no longer offset the *block* gas limit (users keep their refunds). Closes the loophole that let blocks exceed their intended real computational load. |
| **EIP-2780** Resource-based intrinsic transaction gas | SFI | Restructures intrinsic gas so state-dependent charges become runtime charges. |
| **EIP-7928** Block-Level Access Lists | SFI | Headliner. Pre-declared state access enables parallel execution — this is what *unlocks* the higher gas limits. |
| **EIP-7954** Increase Maximum Contract Size | SFI | Cuts the other way: larger contracts permitted. Mitigated by 8037's per-byte pricing. |
| **EIP-8246** Remove SELFDESTRUCT Burn | SFI | Cleanup. |
| **EIP-8261** Gas Limit Schedule | SFI (Informational) | Moves the gas-limit default from client-release-scoped to an epoch-keyed `GAS_LIMIT_SCHEDULE` in the CL config, mirroring `BLOB_SCHEDULE`. **Operationally important to you:** future gas limit increases become pre-announced, epoch-dated, machine-readable events instead of socially-coordinated surprises. This is your early-warning system — wire it into capacity planning. |

**Non-state item you must not miss: EIP-7708 (ETH transfers emit a log), SFI.** Every ETH transfer — including plain EOA-to-EOA sends and value-bearing internal calls — will emit a log. For an Ethereum *data* company this is a material change to receipt/log volume and to your indexing pipeline's shape (it makes value flow tractable via logs instead of trace-based reconstruction). Expect meaningfully larger receipt storage and log indices, and expect a one-time schema/backfill decision. Budget engineering time for this specifically; it is arguably a bigger near-term line item for you than the state repricing.

**Net effect of Glamsterdam on your disk:** growth per unit of gas goes down substantially; gas per block goes up substantially. The explicit design target is ~120 GiB/yr at 150M gas — i.e. **roughly today's absolute growth rate at 2.5× today's throughput.** Do not model a decrease. Model "flat-to-slightly-worse absolute growth, with much higher throughput," and model a *step change in write volume* for archive nodes as the higher gas limit lands.

### 2.2 History expiry (EIP-4444) — partially Live, remainder unscheduled

This one has genuinely delivered, and it is the only shipped relief to date.

- **Phase 1 — pre-merge history drop: effectively live.** All execution clients support partial history expiry, rolled out from mid-2025. Pre-merge block bodies and receipts can be dropped; pre-merge *headers* must still be served over devp2p. **Savings: 300–500 GB per node.** If any node in your fleet has not had this applied, that is free money sitting on the table today.
- **Phase 2 — rolling post-merge window: not scheduled.** EIP-4444 itself is still **Draft**, with `HISTORY_PRUNE_EPOCHS` = 33,024 epochs (the CL block retention window, ~5 months). The meta EIP tracking rollout (EIP-7927) is marked **Stagnant**. There is no fork scheduling and no agreed drop date for post-merge history.
- **The catch for you:** phase 2 is *hostile* to your business model, not helpful. It means the p2p network stops serving the historical data your customers pay you for. The mitigations (Portal Network, era files, torrents) are immature. If you serve historical data, your competitive position *improves* when phase 2 lands — you become one of few parties holding it — but your sourcing risk goes up sharply if you ever need to re-derive history you didn't keep.

**Action implied: never rely on devp2p as your historical-data backstop.** Take and hold your own era-file/receipt archives now, independent of your live nodes, while full history is still trivially available from the network.

### 2.3 State expiry — No fork relationship, effectively dormant

**EIP-7736 (Leaf-level state expiry) is marked Stagnant** with a `FORK_TIME` of "TBD" and no fork scheduling. It was designed against Verkle trees, which are themselves no longer the active design (§2.4). EIP-8188 (Last-Written Block for Accounts and Slots), a prerequisite-shaped proposal in this family, was **Declined for Inclusion in Hegotá**, with the stated reason that it "waits for the I\* trie-migration design."

That note is the whole story: **state expiry is blocked behind a tree migration that has not itself been designed to completion.** There is no version of the roadmap in which state expiry reaches mainnet before ~2029 at the earliest.

**Bank on it: zero. Do not let it appear in any financial model.**

### 2.4 New state tree / stateless clients — No fork relationship

This is the area where you are most likely to be handed bad information, so it is worth being precise.

- **Verkle trees (EIP-6800) are no longer the plan.** You will find recent secondary coverage — including articles published in 2026 — confidently stating that "Hegotá will introduce Verkle Trees and cut node storage by 90%." **This is wrong.** Verkle has been superseded by binary-tree designs.
- **The live design work is EIP-7864 (unified binary tree, Draft, created Jan 2025)** and its successor **EIP-8297 (Partitioned Binary Tree, Draft, created Jun 2026)** — authored by essentially the entire EF state-tree research group. Both replace the hexary MPT with a binary tree merging accounts, storage, and code into one structure, cutting proof sizes ~75%. The hash function is **explicitly not final** in EIP-8297 (BLAKE3 as a placeholder; a Poseidon-family or post-quantum choice is open).
- **Migration is a separate, unsolved problem.** The staged plan is: freeze the MPT, start a new empty tree (7864/8297), then migrate MPT data in a *later* hard fork (EIP-7748). That migration touches every account and contract on the network.
- **Neither is in any fork.** Neither appears in the Glamsterdam meta EIP, and neither appears on the EF Protocol cluster's Hegotá tier list published 2026-09-07 — a list that graded 62 EIPs and *declined 28 of them specifically to keep the fork small enough for post-quantum work to stay on schedule.*
- **The real motivation is proving, not storage.** Binary trees are being pursued to make blocks cheap to prove (zkEVM / validity proofs) and to reach post-quantum security. Operator storage relief is a hoped-for side effect, and it accrues to *stateless validators*, not to archive nodes serving historical state. **Even in the best case, this does not help your archive fleet.**

**Bank on it: zero inside a 24-month window.** The honest earliest plausible mainnet date for a tree swap is 2028–2029, gated on a hash-function decision that has not been made.

### 2.5 Hegotá — in planning, headliners chosen, nothing here for you

The fork after Glamsterdam. Ethereum.org lists it as in planning with an indicative **Q2 2027** period and **no confirmed date**. The EF Protocol cluster's tier list (2026-09-07) names two S-tier "must-ship" headliners:

- **EIP-7805 (FOCIL)** — censorship resistance (CL headliner)
- **EIP-8141 (Frame Transactions)** — EL headliner

A-tier includes EIP-8250 (Keyed Nonces), EIP-8272 (Recent Roots), EIP-7906 (post-transaction state assertions), EIP-8025 (zkEVM integration), EIP-8369 (VOPS profiles), and post-quantum migration primitives. The broader roadmap now carries a stated **2029 target for a post-quantum L1**.

**No state-growth, state-expiry, tree-migration, or history-expiry EIP is in Hegotá's headliner or A-tier set.** Hegotá is a censorship-resistance, account-abstraction, and post-quantum-groundwork fork. Plan for it to be storage-neutral at best, and note that post-quantum signature work tends to *increase* per-transaction data.

### 2.6 Summary table — what to bank on

| Change | Fork status | In your 24-month window? | Effect on archive-node disk |
|---|---|---|---|
| EIP-4444 pre-merge history drop | **Live now** | ✅ Already available | **−300 to −500 GB, one time.** Apply it today. |
| Glamsterdam state repricing (8037/8038/7976/7981/7778/2780) | **SFI**, mainnet Q4'26 target, unscheduled | ✅ Likely (Q4'26–Q1'27) | Slows growth *per gas*; offset by higher gas limit. **Net: no reduction.** |
| EIP-8261 gas limit schedule | **SFI** (Informational) | ✅ Likely | No direct effect; gives you advance warning of throughput steps. |
| EIP-7708 ETH transfers emit logs | **SFI** | ✅ Likely | **Increases** receipt/log volume. Pipeline work required. |
| EIP-4444 rolling post-merge window | Draft, meta EIP Stagnant, **no fork** | ⚠️ Possible, unscheduled | Reduces *full*-node disk. **Raises your data-sourcing risk.** |
| State expiry (EIP-7736) | **Stagnant, no fork** | ❌ No | None. Exclude from models. |
| Binary tree (7864 / 8297) + migration (7748) | **Draft, no fork relationship** | ❌ No | None in window; benefits stateless validators, not archives. |
| Verkle trees (EIP-6800) | **Superseded** | ❌ No | Disregard all press claiming otherwise. |
| Statelessness | Research | ❌ No | None. |

---

## 3. What to do in the meantime

The uncertainty is asymmetric: the downside (throughput rises on schedule, relief does not arrive) is well-characterised and likely; the upside is speculative. Everything below is chosen to be correct *regardless* of whether any unscheduled item ships.

### 3.1 Do now (this quarter, low cost, high certainty)

1. **Apply pre-merge history expiry across the entire fleet.** 300–500 GB per node, available today, zero protocol risk. Verify per-node rather than assuming your client defaults did it.
2. **Audit your archive storage layout.** This is the largest single lever you control and it is a client-engineering choice, not a protocol one. Modern path-based archive layouts run ~2 TB (Geth's path-based archive mode, introduced Jan 2026; Erigon ~1.8–2.2 TB) versus **18–20 TB for legacy hash-based Geth archive**. If any archive node is still on a legacy layout, migrating is a ~10× reduction — larger than anything the protocol will give you this decade. Treat this as the top-priority capital-efficiency item.
3. **Take independent custody of history now.** Export era files / receipts to cheap object storage, decoupled from your live nodes, while full history remains freely available over devp2p. This is insurance against EIP-4444 phase 2 and against a bad resync. Cold object storage is cheap; re-deriving unavailable history is not.
4. **Instrument growth as a first-class metric.** Track, per client and separately: active state bytes, history bytes, archive-diff bytes, and daily deltas of each. You need *your* growth curve, not EIP-8037's Geth reference figure, to make the 18–24 month call. Right now you are budgeting against someone else's number.
5. **Start the EIP-7708 pipeline assessment.** Model the receipt/log volume increase and decide the backfill/schema question before it lands, not after.

### 3.2 Plan for (next 2–3 quarters)

6. **Budget on a no-relief baseline.** Model active state growth at **120–150 GiB/year** through the window, and assume a **step increase in archive write volume** when the gas limit moves past 60M. Concretely: ~390 GiB state (Jan 2026) plus ~116 GiB/yr puts a Geth node near the **650 GiB degradation threshold during 2028** — inside your window, on the *optimistic* assumption that repricing fully offsets the throughput increase. Provision headroom for that crossing.
7. **Buy for IOPS and endurance, not just capacity.** The binding constraint is increasingly random-read latency and write amplification, not raw terabytes. Higher gas limits plus parallel execution (BAL-enabled) means more concurrent state access per block. Spec NVMe with real sustained random-read performance and adequate DWPD; avoid consumer drives, which fail on endurance well before capacity.
8. **Prefer horizontal, tiered archives over ever-larger single nodes.** Since no protocol change will shrink historical state, the long-term answer is architectural: split archive service by block range, serve recent ranges from fast NVMe and cold ranges from cheaper tiers, and keep the number of full-range archive nodes to the minimum your SLA requires. This is the design that holds up whether or not anything on the roadmap ships.
9. **Track the Glamsterdam mainnet epoch and rehearse.** Watch the Sepolia activation on 2026-10-06 and Hoodi (~10-27). The gas-repricing EIPs change the cost of operations your customers' contracts use; expect user behaviour to shift, and expect your own simulation/estimation endpoints to need updating. Plan a non-trivial testnet burn-in — this fork contains two headliners (ePBS, BALs) plus 25+ changes and is the largest EL change in years.
10. **Adopt `GAS_LIMIT_SCHEDULE` monitoring once EIP-8261 is live.** It converts gas-limit increases from a social-coordination surprise into a dated, machine-readable event. Alert on new schedule entries; each one is a capacity-planning trigger.

### 3.3 Do not

- **Do not defer hardware purchases waiting on state expiry, Verkle, or stateless clients.** None has a fork relationship. Deferring on that basis is deferring against a date that does not exist.
- **Do not build a product or a cost model that assumes p2p history remains available.** Phase 2 of EIP-4444 is unscheduled but directionally certain.
- **Do not trust secondary press on fork scope.** Multiple 2026 articles state Hegotá ships Verkle trees and cuts node storage 90%. The primary sources — the Hegotá tier list and the meta EIPs — do not support this. For anything that drives budget, check the meta EIP's SFI list and the activation table directly.

### 3.4 The one-line version for finance

> Storage requirements will keep growing at roughly the current absolute rate or faster through 2028. The protocol changes arriving in the next year make growth *cheaper per unit of throughput* but do not reduce what we store, and the changes that would actually shrink node storage are unscheduled research with no mainnet date. The large wins available to us are operational — modern archive storage layouts (up to ~10× on legacy nodes), history expiry (300–500 GB/node, available today), and tiered archive architecture — not protocol-driven. Budget for growth; treat protocol relief as upside only.

---

## Sources checked

Primary (authoritative for fork scope and status):
- [EIP-7773: Hardfork Meta — Glamsterdam](https://eips.ethereum.org/EIPS/eip-7773) — SFI list and activation table
- [EIP-8037: State Creation Gas Cost Increase](https://eips.ethereum.org/EIPS/eip-8037) — state growth measurements and targets
- [EIP-8038: State-access gas cost update](https://eips.ethereum.org/EIPS/eip-8038)
- [EIP-8261: Gas Limit Schedule](https://eips.ethereum.org/EIPS/eip-8261)
- [EIP-7976: Increase Calldata Floor Cost](https://eips.ethereum.org/EIPS/eip-7976) · [EIP-7981: Increase Access List Cost](https://eips.ethereum.org/EIPS/eip-7981) · [EIP-7778: Block Gas Accounting without Refunds](https://eips.ethereum.org/EIPS/eip-7778)
- [EIP-4444: Bound Historical Data in Execution Clients](https://eips.ethereum.org/EIPS/eip-4444) (Draft) · [EIP-7927: History Expiry Meta](https://eips.ethereum.org/EIPS/eip-7927) (Stagnant)
- [EIP-7736: Leaf-level state expiry in verkle trees](https://eips.ethereum.org/EIPS/eip-7736) (Stagnant, no fork)
- [EIP-7864: Ethereum state using a unified binary tree](https://eips.ethereum.org/EIPS/eip-7864) (Draft) · [EIP-8297: Partitioned Binary Tree](https://eips.ethereum.org/EIPS/eip-8297) (Draft)
- [EF Protocol: The Hegotá EIP Opinion Post and Tier List](https://blog.ethereum.org/2026/09/07/protocol-hegota-eips) (2026-09-07)
- [Partial history expiry announcement — EF Blog](https://blog.ethereum.org/2025/07/08/partial-history-exp)
- [Fusaka Mainnet Announcement — EF Blog](https://blog.ethereum.org/2025/11/06/fusaka-mainnet-announcement)
- [Forkcast](https://forkcast.org) — fork/EIP status tracker

Secondary (timing and operational figures; treat as indicative):
- [ACDE call coverage, Christine D. Kim](https://christinedkim.substack.com/p/acde-241) — Glamsterdam devnet progress
- [Ethereum targets Oct. 6 for Glamsterdam on Sepolia](https://finance.biggo.com/news/fff99f04-5507-4426-bd6f-f63359070bd4) — ACD 2026-09-17, Hoodi ~10-27, mainnet Q4'26 unconfirmed
- [Archive node disk sizes 2026 — 7BlockLabs](https://www.7blocklabs.com/blog/ethereum-archive-node-disk-size-2026-vs-erigon-archive-node-disk-size-2026-vs-geth-full-node-disk-size-2026)
- [Erigon vs Geth 2026 — Chainstack](https://chainstack.com/ethereum-clients-geth-and-erigon/)
- [Ethereum validators push gas limit to 60M — Cointelegraph](https://cointelegraph.com/news/ethereum-validators-push-gas-limit-60m-scaling)

**Caveat on claims marked unscheduled:** fork scope changes. Re-verify the Glamsterdam activation table and the Hegotá meta EIP before any purchase decision dated more than one quarter out.
