# Recommendation: build on MPT proofs today, architect for the Partitioned Binary Tree (PBT) switch

**Checked: 2026-09-23, against forkcast.org, the EIPs repo, and recent ACD/research discussion.**

## TL;DR

- **Build your verifier around the existing hexary Merkle Patricia Trie (MPT) proof format** — it's the only format that verifies against live mainnet `stateRoot`s today, and it will remain the canonical commitment until at least late 2027.
- **But do not hard-wire MPT assumptions into your architecture.** Ethereum's state layer has clearly converged on a **binary tree** (EIP-8297, "Partitioned Binary Tree," with migration in EIP-8347) as the MPT's replacement. Put the proof verification behind a pluggable "tree backend" interface so swapping MPT → binary-tree proofs is a contained change, not a rewrite.
- **Do not build around Verkle trees.** That line of work was deprioritized in 2024–2025 (ZK-unfriendliness and lack of quantum resistance) and is effectively dead — it isn't even tracked for any fork anymore.
- **Do not take a hard dependency on PBT specifics yet.** It's a Draft EIP, not scheduled for any fork, and its details (hash function, key/zone layout) changed as recently as this summer and are still explicitly marked non-final.

## Where Ethereum's state layer actually stands today

- **Live on mainnet (Fusaka, Dec 2025):** state is committed via the hexary MPT (Keccak + RLP). `eth_getProof` returns MPT proofs. This is what every existing state-proof verifier consumes.
- **Glamsterdam (next fork, projected ~Dec 2026):** no state-tree change. But it ships **EIP-7928 Block-Level Access Lists (SFI, headliner)** and state gas (EIP-8037) — both are explicit dependencies of the future tree migration.
- **Hegotá (projected ~mid-2027):** headliners are FOCIL and Frame Transactions. The state tree change is **not** scheduled here.
- **Verkle (EIP-6809):** abandoned as the statelessness vehicle. The research consensus moved to binary trees because Verkle's polynomial commitments are not post-quantum secure and are awkward in ZK circuits.

## Where it's genuinely going: the Partitioned Binary Tree

The direction is unambiguous and stable even though the schedule is not:

- **EIP-7864 (Unified Binary Tree, Jan 2025)** — by Vitalik, Guillaume Ballet, Dankrad, and the stateless-client group — established the binary-tree direction: replace the hexary MPT with a single binary tree, no RLP, co-located account data, proofs shrinking from ~3.8 KB to ~768 B, and a hash function chosen for ZK-friendliness. It was explicitly framed as "probably the final state tree used in the protocol."
- **EIP-8297 (Partitioned Binary Tree, Jun 2026)** — the current, actively-developed successor to 7864. Same authors plus new contributors. Single binary tree with variable-length prefix-free keys, split into zones (account headers / content-addressed code / storage), first ~64 storage slots co-located with the account header. Geth has working draft implementations and devnet testing.
- **EIP-8347 (Jul 2026)** — the migration plan: offline conversion at a finalized anchor block, verifiable snapshot, catch-up via BAL replay (which is why EIP-7928 in Glamsterdam matters), a "shadow commitment" period where validators publish PBT roots while MPT remains canonical, then a single swap fork.
- **Timing signal from the people doing the work:** an EF state-team post (ethresear.ch, Sep 2026) says "the PBT migration is expected later, in **fork I\***" — i.e., the fork *after* Hegotá. Vitalik (Sep 10, 2026) similarly describes PBT as "a major EIP being considered for I\*." Realistically that means **late 2027 at the very earliest, plausibly 2028**, and fork dates slip as a matter of course.

## What this means for your verifier

1. **Ship MPT proof verification now.** There is no alternative that verifies against a mainnet `stateRoot` today, and MPT remains canonical through Glamsterdam, Hegotá, and most likely the rest of 2027. (Separately: your trust-minimization story for the *root itself* — e.g., consuming headers via the beacon light-client sync protocol — is orthogonal to the tree format.)

2. **Abstract the tree backend.** Your verifier should take `(state_root, key, claimed_value, proof) → bool` through an interface with two planned implementations: `MPT` and `BinaryTree`. Everything above that interface (your dApp API, slot-addressing logic, root sourcing) should be tree-agnostic. Note that in the PBT, a storage slot's tree key is derived differently (unified key space, zone prefix, stem co-location), so keep "which tree key does slot S of account A map to" behind the same abstraction.

3. **Track PBT, don't pre-commit to it.** Reasons to hold off on a hard dependency:
   - EIP-8297 is **Draft with no fork relationship** — not CFI, let alone SFI, for anything.
   - The spec is still moving: the zone/key encoding changed between the June draft and the current text; the **hash function is explicitly TBD** (reference code uses BLAKE3, with Keccak and Poseidon2 as candidates — this directly determines your verifier's hashing cost and circuit-friendliness).
   - Fork scope can always change; "expected in I\*" is a research-team statement of intent, not an ACD decision.

4. **Expect a forced migration, and use it as your trigger.** EIP-8297 itself flags that the swap "breaks in-EVM verification of MPT state proofs… contracts that verify proofs against them must adopt the new tree's proof format." The moment PBT reaches **SFI** for a named fork (watch forkcast.org), the hash function and key layout will be frozen enough to implement against with confidence. That's when you build the `BinaryTree` backend. The shadow-commitment period in EIP-8347 will even give you live PBT roots to test against before the swap fork activates.

## Bottom line

Ethereum is heading from hexary MPT to a **partitioned binary tree** — not Verkle — but the switch is a Draft-EIP, post-Hegotá event, realistically 2028. Commit to MPT proofs for what you ship now, with a clean backend abstraction so the binary-tree proof format becomes a drop-in upgrade when its spec and fork schedule actually firm up.
