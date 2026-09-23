# State-proof format recommendation for the trust-minimized light client

## Verdict

**Build your verifier today around MPT (Merkle-Patricia Trie) storage proofs (`eth_getProof`), behind a pluggable witness-verifier interface whose designed successor is the hash-based binary state tree (EIP-7864 → EIP-8297) with STARK-compressed witnesses. Do NOT build on Verkle.**

Commit to the *direction* (binary tree + STARKs); do not commit to its *wire format* yet. The direction is genuine and well-established; the format is not safe to hard-depend on for at least a couple of years.

## Why, specifically

### Where the state layer stands today (verified Sept 23, 2026)

- **Live on mainnet:** the hexary MPT. Every block header's `state_root` commits to it, and `eth_getProof` produces inclusion/storage proofs against it. This is the only witness format a trust-minimized verifier can actually check today.
- **Fusaka** went live Dec 3, 2025 with no state-tree change.
- **Glamsterdam** (projected Dec 2026) is scoped around Block-level Access Lists and ePBS — no state-tree EIP.
- **Hegotá** (projected mid-2027) headliners are FOCIL and Frames. EIP-7862 (delayed state root) was DFI'd on Sept 10, 2026 (ACDE #245), with a Nethermind dev explicitly suggesting to "revisit with binary tries" — i.e., binary-trie work is understood as a *later*-fork project.
- **Verkle is dead.** EIP-6800 is marked **Stagnant** with no fork relationship on Forkcast. The binary-tree EIPs' own rationale explains why: Verkle's polynomial-commitment stack relies on elliptic curves that are not post-quantum secure, and progress in STARK proving has erased Verkle's main advantage (small, fast proofs). Building on Verkle is exactly the mistake you said you want to avoid — wiring to a design the protocol has moved away from.

### Where it's genuinely going

- **The hash-based binary state tree with STARK-compressed witnesses.** EIP-7864 ("unified binary tree," Jan 2025) is the acknowledged successor to the MPT, and it is evolving into EIP-8297 ("Partitioned Binary Tree," June 2026) from the same core author group (Buterin, Ballet, Feist, Hagopian, et al.). It depends only on hash functions (post-quantum safe), eliminates RLP, merges account/storage/code into one tree, and shrinks worst-case branches from ~5,760 bytes (MPT) toward ~768 bytes. The EIP's own rationale calls it "probably the final state tree" — precisely the long-term-stability property you want.
- Core devs treat it as the eventual state migration: on ACDE #244 (Aug 27, 2026) the "binary tree (PBT) migration" was discussed as the future massive state reorganization. The transition plan is overlay-based (new tree starts empty, MPT frozen, data migrated later, per EIP-7748), so there will be a long period where both formats exist.

### Timing flags — how hard a dependency is safe

1. **No fork relationship.** As of Sept 2026, EIP-7864 and EIP-8297 are both `Draft` with **empty fork relationships** on Forkcast — not Scheduled, not even CFI for any named fork. Client teams (e.g., ethrex, March 2026) describe 7864 as "not yet scheduled for inclusion in any ethereum upgrade." Earliest plausible activation is a fork after Hegotá (~2028+), and that is optimistic. A hard dependency today would be a dependency on research, not on a protocol.
2. **The merkelization hash — the literal thing your verifier would hash — is explicitly TBD** (BLAKE3 vs Keccak vs Poseidon2, per EIP-7864). You cannot freeze a witness format whose core hash is undecided.
3. **The spec is still churning.** 7864 → 8297 within ~17 months changed key structure and layout (partitioned zones, content-addressed code). Any binary-tree wire format you froze today would likely break before mainnet activation.
4. **The eventual migration is breaking.** Post-fork state roots will commit to the new tree, so in-EVM (and off-chain) MPT verification against *new* blocks stops working at the fork. You will have to migrate anyway; the only question is whether your architecture makes that a backend swap or a rewrite.

**Rule of thumb:** a hard dependency becomes safe when the EIP is CFI/SFI for a named fork *and* the merkleization hash is final. Neither holds today.

## Concrete plan for your build

1. **Now — MPT backend (live):**
   - Trusted anchor: a beacon-chain light client (sync-committee based, Helios-style) gives you a trust-minimized recent block header without an RPC provider's word for it. Keep the *anchor* logic strictly separate from the *witness* logic — the anchor is stable; the witness format is what churns.
   - Witness: `eth_getProof`-style MPT account + storage proofs, verified against the header's `state_root` in your service (or on-chain via an EIP-1186-style verifier if a contract must check it). No archive node needed — any full node serving proofs suffices, since the proof itself carries the trust.
2. **Architecture — pluggable witness format:**
   - Define a `WitnessVerifier` interface (e.g., `verify(state_root, key, value, witness) -> bool`) with per-format backends: `mpt` now, `binary-tree` (with optional STARK compression) later. Isolate RLP/Keccak/MPT-specific node handling entirely inside the MPT backend so nothing else in the pipeline touches it.
3. **Later — binary-tree + STARK backend:**
   - Add the backend when EIP-7864/8297 (or successor) reaches CFI/SFI for a named fork and the hash decision is final. At the fork itself, run both backends keyed on block height. If you want a head start, prototype against the EIP-8297 spec in a branch — but do not ship it as the committed format.
4. **What not to do:**
   - Don't build anything on Verkle (EIP-6800) — stagnant, abandoned for post-quantum and proving-cost reasons.
   - Don't freeze binary-tree wire details (hash, key layout) into your committed pipeline today — they are still moving.

## Sources checked (Sept 23, 2026)

- Forkcast EIP records: EIP-6800 (Stagnant, no fork relationship), EIP-7864 (Draft, no fork relationship), EIP-8297 (Draft, June 11, 2026, no fork relationship) — forkcast.org/api/eips/{6800,7864,8297}.json
- Forkcast upgrades index: Fusaka live Dec 3, 2025; Glamsterdam projected Dec 2026 (BAL + ePBS); Hegotá projected 2027 (FOCIL + Frames headliners)
- ACDE #244 (Aug 27, 2026) and #245 (Sept 10, 2026) call summaries via Forkcast: PBT migration discussed as future state reorganization; EIP-7862 DFI'd with "revisit with binary tries"
- EIP-7864 and EIP-8297 specs: merkelization hash TBD (BLAKE3/Keccak/Poseidon2); post-quantum rationale vs Verkle; overlay transition with frozen MPT and later migration (EIP-7748)
