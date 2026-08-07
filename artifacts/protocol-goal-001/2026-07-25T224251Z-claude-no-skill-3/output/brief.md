# Ethereum State Growth: Technical & Capacity Planning Brief

**Date:** 25 July 2026
**Audience:** Infrastructure team + Finance
**Planning window:** Q3 2026 – Q1 2028 (18–24 months)

---

## Bottom line up front

1. **No protocol change landing in your planning window reduces archive node disk usage.** Not one. Every mechanism that would actually shrink an archive node — statelessness, state expiry, binary trees — is unscheduled, has no fork target, and is described by the Ethereum Foundation itself as "long term." Verkle trees, which most 18-month-old planning material assumes, have been **abandoned** and replaced by an unscheduled binary-tree proposal. Budget as if none of it exists.

2. **The one change that is genuinely coming — gas repricing in the Glamsterdam fork — is a brake, not a reversal.** It caps how fast state grows *per unit of gas*. It does not shrink anything, and it does not even hold your growth rate flat.

3. **The dominant variable for your budget is not state bloat, it's the gas limit.** It went 30M → 60M in 2025 and **daily new state more than tripled** (105 MiB/day → 326 MiB/day). The credible post-Glamsterdam target is **200M**. That is another ~3.3x on throughput, and throughput — not net state — is what drives archive node growth.

4. **Plan for archive growth to accelerate by roughly 2–3x during the window, not to decline.** The repricing EIPs stop it being worse than that. See [§4](#4-the-planning-numbers) for the model.

5. **Your largest available lever is client choice, and it is entirely in your hands — worth ~10x, far more than anything the protocol will do for you.** A hash-based Geth archive is >20 TB; Erigon 3, Reth, and Geth's path-based archive mode are all in the ~1.8–2.2 TB range. If any of your fleet is still hash-based Geth, that migration dwarfs every protocol consideration in this document.

---

## 1. What is actually driving this at the protocol level

### 1.1 Three different things get called "state growth"

Most confusion in capacity planning — and most of the misleading vendor content — comes from conflating three separate data sets with three different growth drivers and three different roadmap answers.

| | What it is | Who must store it | Grows with |
|---|---|---|---|
| **State** | Current balances, nonces, contract code, storage slots — the data needed to validate the *next* block | Every full node | *Net new* accounts and storage slots |
| **History** | Block bodies, receipts, logs — the record of how we got here | Full nodes (recently: only a rolling window) | *Throughput* (gas used) |
| **Historical state** | The value of every slot at every past block — what `eth_call` at block N needs | **Archive nodes only** | *Throughput* (state writes per block) |

**This distinction is the core of the brief.** The Ethereum roadmap's state-growth work targets column 1. Your pain is overwhelmingly columns 2 and 3. This is why roadmap announcements that sound like relief are not relief for you.

### 1.2 Why the state itself grows

Ethereum's state is a Merkle Patricia Trie: a 16-way (hexary) radix tree, keyed by the Keccak hash of the account address or storage slot, with every node hashed into a single root commitment in each block header. Two consequences matter:

- **Per-item overhead is large and unavoidable.** A 32-byte storage slot costs roughly **191 bytes** on disk once trie node overhead, key encoding and database overhead are counted; an account costs ~134 bytes. You are paying ~6x the logical data size.
- **Hashing keys destroys locality.** Because the trie is keyed by hash, two storage slots in the same contract land in unrelated parts of the tree. Every state access is a scattered set of random reads down a ~7-level-deep tree. This is why NVMe latency, not sequential throughput, is the binding hardware constraint, and why the problem is as much IOPS as capacity.

Composition, from Paradigm's analysis, is stable and explains why growth is relentless: **contract storage is ~81.7% of state**, accounts ~14.1%, bytecode ~4.3%. Within that, **ERC-20 balances are ~27.2% and ERC-721 ~21.6% of the entire state**. The reason is structural: every (token, holder) pair is its own 32-byte slot with its own ~191 bytes of overhead. State therefore scales with *users × tokens held*, which is a product of two growing numbers. At least 7.4% is already dormant — dead games, abandoned DEXs, defunct schemes — and under current rules it is stored forever, by everyone, for free.

That last clause is the actual economic defect: **state creation is charged once, at write time, but imposes a storage cost on every node operator forever.** Everything in the roadmap's short-term column is an attempt to fix that mispricing.

### 1.3 Why *archive* nodes grow much faster than state does

An archive node does not store "state" — it stores a way to reconstruct state at any historical block. Modern clients (Erigon 3, Reth, and Geth's path-based mode since v1.16) no longer keep every historical trie; they keep one flat current state plus **reverse diffs / changesets** per block, and rebuild historical state on demand by walking backwards.

This is an enormous improvement (>20 TB → ~2 TB), but note what it makes your growth proportional to: **the number of state writes per block, not the net new state per block.** A block that writes the same hot Uniswap slot 400 times adds ~zero net state and 400 changeset entries.

Your archive delta is therefore roughly:

```
archive_growth ≈ net_new_state          (small, capped by repricing)
               + state_change_diffs     (∝ throughput)
               + receipts & logs        (∝ throughput)
               + block bodies/calldata  (∝ throughput)
               + your indices & traces  (∝ throughput, often 1-2x the raw data)
```

**Four of five terms scale with throughput.** The roadmap's repricing work constrains only the first. This is the single most important sentence in this brief for budget purposes.

It also explains your sync-time complaint, which is a consequence of the same thing rather than a separate problem. A Geth path-based archive sync from genesis is **~2 weeks, plus ~30 hours to build the archive state index** before historical state is served at all. That number is a function of total accumulated history, so it grows monotonically and will grow faster once the gas limit rises. Treat resync-from-genesis as a capability you are losing, and see [§5.4](#54-stop-treating-resync-as-a-recovery-plan).

---

## 2. What is coming from the protocol — and how much to bank on it

### 2.1 The scorecard

Confidence is my assessment of the change being **live on mainnet before Q1 2028**, given today's status.

| Change | What it does | Status (25 Jul 2026) | Confidence in window | Effect on your archive fleet |
|---|---|---|---|---|
| **EIP-8037** state creation gas | Fixed 1,530 gas/byte for new state; separate state-gas reservoir | **SFI** for Glamsterdam; spec finalized at May 2026 interop | **High (~80%)** | Caps *state* growth rate. Near-zero effect on archive disk. |
| **EIP-8038** state access repricing | Raises cost of storage writes, cold access, account writes | **SFI** for Glamsterdam | **High (~80%)** | Modest — slows diff/changeset volume. |
| **EIP-2780 / 7976 / 7981 / 7778** | Intrinsic gas, calldata, access-list, refund repricing | CFI/SFI, bundled | Medium-high | 7976 (calldata cost ↑) slightly slows history growth. |
| **Glamsterdam fork itself** | ePBS (7732), BALs (7928), the repricing bundle | Devnet-7 (8 Jul); Sepolia **3 Aug 2026**; mainnet **targeted 16 Sep 2026** | **Medium-high (~65%) for 2026**; high for H1 2027 | Neutral-to-negative on disk; see §2.3. |
| **Gas limit 60M → 200M** | ~3.3x throughput | "Credible post-Glamsterdam floor" per EF, May 2026 | **High on direction, low on timing** | **Your single biggest cost driver. Increases growth.** |
| **History expiry, rolling window** (EIP-4444 / 7927 phase 2) | Full nodes drop history beyond a rolling window | Pre-Merge drop shipped 2025; rolling window specced, not scheduled | Medium | **Negative for you** — peers stop serving history you depend on. See §5.5. |
| **Binary trees** (EIP-7864) | Replaces hexary MPT; 4x shorter proofs; enables statelessness | **Draft since Jan 2025. No fork target.** Hash function (Poseidon2 vs BLAKE3) still undecided pending EF security review | **Very low (<10%)** | Would eventually help. Also forces a **full fleet re-sync**. |
| **Statelessness** | Nodes validate without storing state | Research. EF: "long term" | **Very low** | Helps validators, **not archive nodes**. |
| **State expiry** (EIP-7736) | Inactive state hibernates | **Stagnant.** Was specced against Verkle, which is cancelled | **~0%** | Would be the real fix. Do not plan on it. |
| **Verkle trees** | — | **Cancelled / superseded by EIP-7864** | **0%** | Disregard all planning material citing it. |

### 2.2 Read this before anyone quotes a "90% storage reduction"

There is a large volume of secondary content — exchange blogs, SEO node-hosting sites, several AI-generated "2026 roadmap" pages — currently claiming that the Hegotá fork replaces the Merkle Patricia Trie with **Verkle trees** and cuts node storage by ~90%. **This is wrong on every count**, and I flag it explicitly because it is the most likely thing to contaminate a planning discussion:

- Verkle trees were **dropped**, superseded by the binary-tree proposal EIP-7864.
- EIP-7864 is a **Draft with no fork target** and an undecided hash function.
- Hegotá's actual selected headliner is **FOCIL (EIP-7805)**, a censorship-resistance mechanism, with account abstraction as secondary work — per the EF's own April 2026 checkpoint. Nothing to do with state.
- Even a completed binary-tree migration **does not shrink an archive node**. It shrinks *proofs*, which enables stateless *validators*. Your historical state, receipts and indices are untouched.

Sanity check for the team: `ethereum.org/roadmap/statelessness` is itself stale — it still describes Verkle as the plan and quotes a 12 TB archive figure from February 2023. Prefer the EF blog's protocol updates and the EIPs themselves.

### 2.3 The catch nobody puts in the headline

The repricing EIPs are not being built to make your life easier. They are being built **to make a gas limit increase safe**. Those are different goals, and for an archive operator they point in opposite directions.

The arithmetic is explicit in EIP-8037. The cost-per-state-byte of 1,530 gas was derived by *choosing a target growth rate and solving backwards*:

```
target:  120 GiB of new state per year
assume:  150M gas limit, 50% of block gas going to state, 2,628,000 blocks/yr
CPSB  =  (150M / 2 × 2,628,000) / 128,849,018,880 bytes  ≈  1,530 gas/byte
```

The target is **proportional to the gas limit**. Hold CPSB at 1,530 and raise the limit to the stated 200M floor, and the design target becomes:

```
(200M / 2 × 2,628,000) / 1,530  ≈  160 GiB/year of new state
```

Today, at a 60M limit, measured state growth is **~116 GiB/year** (326 MiB/day). So the fully-implemented, working-as-intended outcome of the state-growth relief programme is **state growing ~40% faster than it does today** — while throughput, and therefore everything else on an archive node, goes up ~3.3x.

Repricing is doing real work: unmitigated, EIP-8075's analysis projects up to 440 MiB/day at a 300M limit. Without it the picture would be considerably worse. But "considerably worse than it would have been" is not relief, and it must not be booked as a cost saving.

> **The one-line version for finance:** Ethereum is not reducing the data you store. It is making itself ~3x faster while keeping the per-transaction storage cost from rising. Your volumes go up.

### 2.4 Glamsterdam's other operational impacts on you

Beyond repricing, the fork carries items that specifically touch a data company:

- **EIP-7928 (BALs)** — every block gains a block-level access list, ~72 KiB compressed at a 60M limit (~300 MB/day). They are *not* in the block body and may be pruned after the weak-subjectivity period (~3,533 epochs, ~16 days), so they are not a permanent archive burden **unless you choose to retain them** — and as a data company you may well want to, since they are a free, complete, pre-computed state-access index. At a 200M limit budget ~240 KiB/block (~1 GB/day, ~360 GB/yr) if you retain them. **Treat this as a product decision, not just a cost.**
- **EIP-7708 (ETH transfers emit logs)** — genuinely good news for you. Value transfers become ordinary logs, so ETH balance-flow indexing no longer requires full transaction tracing. This can *remove* a large trace-index workload from your pipeline. It also increases raw log volume. Net: likely a win, but it will change your log-index sizing.
- **New wire protocols**: eth/70 (EIP-7975), eth/71 (EIP-8159). Fleet-wide client upgrade coordination, with peering degradation for stragglers.
- **ePBS (EIP-7732)** restructures block production into a two-phase proposer/builder flow. If you sell mempool, block-building, or MEV data, your ingestion assumptions change. This is the item the EF flagged as "trickier than anticipated" and is the main schedule risk to the 16 Sep date.

---

## 3. Schedule confidence

Dates below are from the tracked upgrade schedule; the project publishes them as *projections, not commitments*.

- Devnet-7: 8 July 2026 ✅
- **Sepolia: 3 August 2026** ← the milestone to watch
- Hoodi: 17 August 2026
- **Mainnet target: 16 September 2026**
- Hegotá (FOCIL): devnets from Nov 2026, mainnet projected ~April 2027

**My read:** ~65% Glamsterdam is on mainnet in calendar 2026; ~90% by end of H1 2027. Base rates favour slippage — Ethereum forks slip more often than not, ePBS has been called out as the hard part, and past forks have taken 2–4 months of public-testnet seasoning. Pectra and Fusaka both shipped roughly on time in 2025, which is a genuine positive signal for the current process.

**None of this schedule risk changes your budget**, because the fork does not reduce your storage either way. It matters only for (a) when your client-upgrade window is, and (b) when the gas limit ramp starts — and the ramp is what costs you money. A *slip is financially good for you*: it delays the throughput increase.

---

## 4. The planning numbers

### 4.1 Anchors (measured, sourced)

| Quantity | Value | Source / vintage |
|---|---|---|
| New state, 30M gas era | ~105 MiB/day | EIP-8037, measured |
| New state, 60M gas era (**today**) | **~326 MiB/day ≈ 116 GiB/yr** | EIP-8037, measured |
| Alternative estimate, 60M | ~286 MiB/day ≈ 102 GiB/yr | EIP-8075 |
| Geth state-only DB | ~340 GiB | May 2025 |
| Erigon 3 archive, mainnet | **~1.77 TB** | Erigon docs, Sept 2025 |
| Reth archive | ~1.8–2.2 TB | Community reports |
| Geth path-based archive | **~2 TB** flat; **~6.5 TB** with historical trie nodes | Geth docs |
| Geth hash-based archive (legacy) | **>20 TB** | Geth docs |
| Design target post-repricing @150M | 120 GiB/yr state | EIP-8037 |
| Implied target @200M | **~160 GiB/yr state** | My arithmetic from EIP-8037 |

### 4.2 The model — and the number you must measure yourselves

I could not find a well-sourced measured figure for **archive-node annual delta** at the current gas limit, and I am not going to invent one that you would then put in a budget. Published archive totals are point-in-time snapshots that conflate ten years of accumulation, and they vary by client, index configuration and pruning flags — yours will differ from anyone's published number.

What *is* well established is the **shape**: four of the five archive growth terms are proportional to throughput. So:

```
archive_delta_per_year  ≈  k × gas_limit
```

Solve for `k` from your own fleet, then scale. Concretely:

```bash
# Run on a representative archive node. Record weekly for 8-12 weeks.
du -sb /data/erigon/chaindata /data/erigon/snapshots 2>/dev/null
# Break out the components that scale differently:
du -sh /data/erigon/snapshots/*   # domain / history / idx separately
```

Take the 90-day delta, annualise, divide by 60M. That `k` is your planning constant, and it is worth more than any figure in this brief.

### 4.3 Scenarios

Applied to your measured baseline delta `D` (annual archive growth at today's 60M limit):

| Scenario | Gas limit path | Annual archive delta | Probability |
|---|---|---|---|
| **A — Slip** | Stays 60M through 2027 | `1.0 × D` | 20% |
| **B — Measured ramp** *(plan on this)* | Glamsterdam H2 2026; 60M → 100–120M through 2027 | **`1.7–2.0 × D`** | 50% |
| **C — Full ramp** | 200M floor reached during 2027 | **`3.3 × D`** | 25% |
| **D — Relief** | Binary trees or state expiry live and shrinking archives | `<1.0 × D` | **<5%** |

**Recommendation: budget Scenario B, with contractual headroom to reach C inside 90 days.** Scenario D is not a plan; if you hear it in a vendor pitch or a board deck, it comes from the stale-Verkle content described in §2.2.

Note the ramp is gradual and operator-controlled: the gas limit moves by validator signalling, not by the fork itself, and 30M → 60M took months of incremental voting. You will have warning. Instrument for it ([§5.6](#56-instrument-the-leading-indicators)).

### 4.4 Second-order costs finance should be told about now

Capacity is the line item people remember; these are the ones that surprise them.

- **Write endurance.** 3.3x throughput is 3.3x write amplification against NVMe TBW ratings. Drives sized for a 5-year life at 60M may hit endurance limits in ~18 months at 200M. **Specify DWPD, not just TB** — and audit the DWPD on drives already in service, because this can turn into an unplanned mid-window replacement across the whole fleet.
- **IOPS before capacity.** The random-read pattern from hash-keyed trie access (§1.2) means you will hit latency limits before you fill the disks. Benchmark p99 `eth_call` latency at depth, not just free space.
- **RAM.** Working-set growth is roughly 2–4.7 GiB/year at current rates and scales with throughput. 64 GiB nodes have runway; 32 GiB nodes will need attention in-window.
- **A binary-tree migration, whenever it lands, is a full-fleet re-sync**, not a rolling upgrade. It is outside this window, but it is a known future capital event worth naming in a 3-year plan.

---

## 5. What to do in the meantime

Ordered by value per unit of effort.

### 5.1 Audit client mix first — this is worth more than the entire roadmap

If any archive node is still **hash-based Geth (>20 TB)**, migrating it to Erigon 3, Reth, or Geth path-based mode is a **~10x reduction**. Nothing in §2 comes close. Do this before any hardware purchase, because it changes the purchase.

Choose deliberately, because the modes are not equivalent:

- **Erigon 3 / Reth (~1.8–2.2 TB)** — best default for bulk historical query serving. Note Erigon 3 is a *full* node by default; archive requires `--prune.mode=archive`.
- **Geth path-based, flat (~2 TB)** — comparable size. But historical `eth_getProof` is unsupported without retaining historical trie nodes.
- **Geth path-based + `--history.trienode=N` (v1.17.x+)** — the only way to serve **historical Merkle proofs**. Costs up to ~6.5 TB.

**Decision required from product:** do customers need historical `eth_getProof`? If yes, you need a small number of expensive proof-capable nodes — you do not need the whole fleet to be one. If nobody has asked for it, do not pay the ~3x.

### 5.2 Stop running a uniform fleet

Uniform archive nodes mean paying archive prices for full-node workloads. Segment:

- **Hot tier** — recent state, high QPS, latency-sensitive. Full nodes (~0.9–1.3 TB), fast NVMe. Serves the large majority of real traffic.
- **Deep tier** — historical queries. Fewer, larger, cheaper storage, higher latency tolerated.
- **Proof tier** — only if §5.1 says yes. Smallest possible count.

This decouples your fastest-growing cost from your most expensive hardware, and it is the structural change that makes Scenario C affordable.

### 5.3 Buy in 12-month increments with headroom

Do not buy 24 months of capacity today. Two independent reasons, pointing the same way:

- The growth rate is genuinely uncertain (1.0x–3.3x), and over-buying at the top of that range is expensive.
- Storage cost per TB continues to fall, so deferred purchases are cheaper purchases.

Prefer contracts that let you **add capacity within ~90 days**. Optionality is worth more than a volume discount here, because the ramp is fast once it starts. Avoid multi-year lock-in justified by expected protocol relief.

### 5.4 Stop treating resync as a recovery plan

At ~2 weeks + ~30 hours of index build — and growing — resync-from-genesis is not a recovery-time objective any customer will accept. Move to **snapshot/restore**: periodic block-level snapshots, restore-time tested, with the restore drill actually run and timed at least quarterly. This is the highest-value operational change here independent of everything else in this brief, and it gets more valuable as history accumulates.

### 5.5 Backfill and pin pre-merge history now — this is an asset

History expiry means peers are **already permitted to drop pre-Merge block bodies and receipts** (EIP-7639), and the rolling-window phase will extend that to post-Merge history. The P2P network is ceasing to be a reliable source for the history you sell.

- Pull and store the full **era1/era file** set from the `eth-clients/history-endpoints` sources while distribution is healthy.
- Verify against known-good hashes, store with real durability, treat as a **company asset** rather than a cache.
- As full nodes shed history, complete verified history becomes scarcer and your competitive position improves. **This is the one place where a roadmap change is in your favour** — but only if you act before the source dries up.

### 5.6 Instrument the leading indicators

Cheap to set up, and turns a budget guess into a managed forecast:

1. **Per-component archive delta**, weekly, per client type (§4.2). This is your `k`.
2. **Mainnet gas limit** — alert on any move above 60M. This is your single best early warning; it precedes cost increases by months.
3. **Glamsterdam milestones** — Sepolia 3 Aug, Hoodi 17 Aug, mainnet ~16 Sep. Slippage on Sepolia is your signal that the ramp moves right.
4. **Drive write-endurance consumption** (SMART TBW vs rating), fleet-wide. Do this now, before the ramp.
5. **Client releases** for Glamsterdam support and the eth/70–71 protocol bumps.

### 5.7 Re-forecast at two decision points

- **~Sept 2026 (Glamsterdam mainnet):** confirm repricing shipped as specced; re-measure `k` in the first 60 days post-fork.
- **First gas limit vote above 60M:** this starts the cost ramp. Trigger the capacity option from §5.3 at this point, not before.

---

## 6. Assumptions and how this forecast could break

Stated explicitly so the team can challenge them:

- **I assume the gas limit rises during the window.** If the community stalls at 60M — plausible if ePBS proves operationally rough — you land in Scenario A and this brief is pessimistic. This is the most likely way I am wrong.
- **I assume `k` (growth per unit gas) is stable.** L2 migration could reduce L1 state intensity per gas; conversely, cheap compute post-repricing could induce new state-heavy L1 use. EIP-8075's authors argue explicitly that demand elasticity is unknown and that EIP-8037's *fixed* price may therefore under- or over-shoot. This is the largest technical uncertainty in the whole picture.
- **I assume no emergency state-growth intervention.** If growth badly overshoots the 120 GiB/yr target post-fork, an adaptive mechanism (EIP-8075 or similar) becomes likely in Hegotá. That would *help* you, and is not in the model.
- **Archive delta figures are unmeasured on your fleet.** §4.2 exists because of this. Everything in §4.3 is a multiplier on a number only you can produce.
- **The 16 Sep 2026 date is a projection, not a commitment**, and is published as such.

---

## 7. Sources

Primary (rely on these):

- [EIP-8037: State Creation Gas Cost Increase](https://eips.ethereum.org/EIPS/eip-8037) — CPSB derivation, measured 105→326 MiB/day
- [EIP-8038 / EIP-8007: Glamsterdam Gas Repricings meta](https://eips.ethereum.org/EIPS/eip-8007)
- [EIP-8075: Adaptive state cost to cap growth](https://eips.ethereum.org/EIPS/eip-8075) — alternative model, elasticity critique
- [EIP-7928: Block-Level Access Lists](https://eips.ethereum.org/EIPS/eip-7928) + [BAL size analysis](https://eips.ethereum.org/assets/eip-7928/bal_size_analysis)
- [EIP-7864: Unified binary tree](https://eips.ethereum.org/EIPS/eip-7864) — Draft, no fork target
- [EIP-7736: Leaf-level state expiry](https://eips.ethereum.org/EIPS/eip-7736) — **Stagnant**
- [EIP-7927: History Expiry Meta](https://eips.ethereum.org/EIPS/eip-7927)
- [EF: Protocol Priorities Update for 2026](https://blog.ethereum.org/2026/02/18/protocol-priorities-update-2026) — "binary trees and statelessness in the long term"
- [EF: Checkpoint #9, Apr 2026](https://blog.ethereum.org/2026/04/10/checkpoint-9) — ePBS difficulty; Hegotá headliner is FOCIL
- [EF: Protocol Cluster Updates, May 2026](https://blog.ethereum.org/2026/05/11/protocol-update-may-26) — EIP-8037 finalised; 200M floor
- [Geth: Archive mode docs](https://geth.ethereum.org/docs/fundamentals/archive) — sizes, `--history.trienode`, sync times
- [Erigon FAQ](https://docs.erigon.tech/help-center/frequently-asked-questions-faqs) — 1.77 TB archive, Sept 2025
- [Ethereum upgrade schedule](https://eipsinsight.com/upgrade/schedule) — devnet/testnet/mainnet dates
- [Glamsterdam overview](https://ethereum.org/roadmap/glamsterdam/) — SFI list
- [eth-clients/history-endpoints](https://github.com/eth-clients/history-endpoints) — era1 sources for §5.5

Analysis:

- [Paradigm: How to Raise the Gas Limit, Part 1 — State Growth](https://www.paradigm.xyz/writing/how-to-raise-the-gas-limit-1) — state composition, per-slot overhead, hardware runway. **Note: pre-60M vintage**; structural analysis current, absolute figures superseded.

Known-stale — do not plan from:

- [ethereum.org/roadmap/statelessness](https://ethereum.org/roadmap/statelessness/) — still describes Verkle, cites Feb 2023 archive figures.
- Exchange and node-hosting blog content on "Hegotá + Verkle + 90% storage reduction" — see §2.2.
