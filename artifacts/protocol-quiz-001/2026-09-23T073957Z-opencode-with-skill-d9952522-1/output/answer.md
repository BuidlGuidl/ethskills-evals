# Recommendation: build the verifier around MPT (EIP-1186-style) proofs today, behind a format-agnostic interface. Do **not** wire the pipeline to Verkle.

## TL;DR

Commit to **Merkle Patricia Trie witnesses (EIP-1186-style `eth_getProof` account + storage-trie proofs), anchored to a recently finalized block header verified via the beacon-chain sync-committee light client**. That is the only state-proof format that is live on mainnet today, it fully solves your use case (a single storage slot is a sub-2 KB proof, not the multi-MB whole-block witnesses that motivated Ethereum's statelessness research), and it remains the live format through at least the next two network upgrades.

Do **not** build around **Verkle tree proofs (EIP-6800 family)** — that is the design the protocol has moved away from. The genuine long-term direction is **EIP-7864's unified binary Merkle tree with STARK-provable witnesses**, but it is an unscheduled Draft with no fork relationship, so it must be a tracked, pluggable future option — not a hard dependency.

## Where Ethereum's state layer stands today (Sept 2026)

- Mainnet state is still committed in the **Keccak hexary Merkle Patricia Trie**; the state root in every execution block header is an MPT root, and every client's `eth_getProof` produces EIP-1186-style account and storage proofs against it. **Status: live**, and the only thing that can actually verify "storage slot X of contract Y as of block Z" right now.
- The last two upgrades (Pectra, Fusaka) and the next two contain **no state-tree change**:
  - **Glamsterdam** — in progress, projected mainnet activation ~Dec 2026 (forkcast estimate, not an announced date); headliners are Block-level Access Lists and ePBS. No tree EIPs in scope.
  - **Hegotá** — early planning, projected ~mid-2027 (estimate); headliners SFI'd are FOCIL and Frame Transactions. No tree EIPs in scope.
- So the MPT is guaranteed to be the state commitment for recent blocks for **at least the next two forks** — realistically well beyond, since no successor even has CFI status yet (see below).

## Where it is genuinely going — and what it is moving away from

**Verkle (EIP-6800 family): moving away from.** Forkcast shows the entire Verkle apparatus with no fork relationship and stalled maturity:

| EIP | What it is | Spec status | Fork relationship |
|---|---|---|---|
| 6800 | Unified Verkle state tree | **Stagnant** | none |
| 7612 / 7748 | Overlay tree / state conversion | Stagnant / Draft | none |
| 7545 | Verkle proof verification precompile | Stagnant | none |
| 6873 | Preimage retention (Verkle prep) | Stagnant | **Declined for Glamsterdam** |
| 4762 | Statelessness gas repricing | Draft | none |

The pivot away from Verkle is well documented: the statedrivers (Buterin, Ballet, Feist, et al.) moved to a **binary hash tree** design because Verkle's KZG/pairing commitments are not quantum-resistant, require a trusted setup, and are hard to SNARK-wrap later (Vitalik, "Possible futures of the Ethereum protocol, part 4: The Verge," Oct 2024; ethereum.org's Verkle roadmap page, still live, is now describing a deprioritized track). **Anything you build around the Verkle witness format is wiring yourself to a design the protocol is abandoning.**

**Binary tree + STARKs (EIP-7864): the real direction, but unscheduled.**

| EIP | What it is | Spec status | Fork relationship |
|---|---|---|---|
| 7864 | Unified binary state tree | **Draft** | **none** |
| 8297 | Partitioned binary tree (further restructuring) | Draft | none |
| 8025 | Optional Execution Proofs (stateless block proving) | Draft | Proposed for Hegotá |

EIP-7864 replaces the MPT with a flat, hash-based binary tree whose witnesses are small enough to be STARK-provable — quantum-safe, no trusted setup, and prover times are within reach of consumer hardware per current benchmarks. This is where the engineering attention is. But: **it is not Scheduled, not even CFI, for any named fork.** Glamsterdam and Hegotá don't touch the tree. The earliest plausible window is a fork *after* Hegotá (post-2027), and its own witness format is still in flux (EIP-8297 proposes to re-partition it; conversion/overlay mechanics are still being debated). Per the skill's classification: **no fork relationship — proposal/research only.** Do not give it a ship date, and do not take a hard dependency on it.

One adjacent live effort worth tracking but not committing to: the **execution-witness standardization** for L1 zk-proving (`debug_executionWitness`, `engine_newPayloadWithWitness`, EIP-8025 rated "A-ish" on the EF's Hegotá tier list per the Sept 2026 L1-zkEVM breakout). This is MPT-based witness work happening now, and it signals the protocol's proving stack is being built around MPT-then-binary-tree, not Verkle.

## What this means for your commitment decision

1. **Build now on MPT/EIP-1186.** For your use case the usual argument against MPT (multi-MB whole-block witnesses, ~3.5 MB per 1000 leaves) doesn't apply: proving one storage slot costs one account proof (~hundreds of bytes) + one storage proof (~hundreds of bytes), verified against the header's `stateRoot`. Combine with the **sync-committee light client (live since Altair, 2021)** to get the header trust-minimized, and your whole trust surface is the Ethereum validator set — no RPC trust, no archive node.
2. **Isolate the proof format.** Put the witness parsing/verification behind one interface (e.g., `verifyStateProof(headerRoot, address, slot, witness) -> value`). The MPT verifier is ~a few hundred lines of Keccak + RLP; the future binary-tree/STARK verifier plugs in behind the same interface without touching your pipeline.
3. **Ignore Verkle entirely.** Stagnant, no fork relationship, precompile (EIP-7545) stagnant — building a Verkle verifier is stranded work by construction.
4. **Track EIP-7864's fork relationship, not blog posts.** The trigger to start building is when it moves to *Considered for inclusion (CFI)* in a named fork on forkcast. Note also that when the tree does change, it changes at a hard fork boundary: proofs of *recent* blocks will use the new tree, but MPT proofs against pre-fork headers remain valid forever (old `stateRoot`s still commit to the old trie), so your MPT verifier never becomes dead code.
5. **Timing summary:**
   - Live now, safe as a hard dependency: MPT state root + EIP-1186 proofs + sync-committee light client. Guaranteed correct through Glamsterdam and Hegotá — no state-tree EIP has any status in either.
   - Unscheduled, do not depend on: EIP-7864 binary tree / STARK witnesses (Draft, no fork relationship; earliest plausible fork is after Hegotá, projected ~2027, and that projection is an estimate).
   - Dead end: Verkle (EIP-6800 family), Stagnant/Declined.

## Sources checked (2026-09-23)

- forkcast.org EIP records: `/api/eips/6800.json` (Stagnant, no fork relationship), `/api/eips/7864.json` (Draft, no fork relationship), bulk EIP index for 7545/7612/7748/4762/6873/8297/8025 fork statuses
- forkcast.org `/api/upgrades.json`: Glamsterdam (projected 2026-12-02, estimate) and Hegotá (projected 2027-06-16, estimate) scope/headliners
- forkcast.org call summaries: ACDE #235 (Apr 2026, EIP-8237 witness EIP deferred to Hegotá), RPC Standards #26–35 (2026, `debug_executionWitness` spec work), L1-zkEVM breakouts #01–08 (2026, execution-witness standardization, EF Hegotá tier list)
- ethereum.org Verkle trees roadmap page (updated June 2026) and "Possible futures of the Ethereum protocol, part 4: The Verge" (Buterin, Oct 2024)