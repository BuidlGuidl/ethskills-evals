# Recommendation: build the verifier around a pluggable commitment layer, with MPT/Keccak proofs as the live backend and the binary-tree family (EIP-7864 → EIP-8297) as the tracked target. Do **not** wire anything to Verkle.

## TL;DR

1. **Ship on Merkle Patricia Tree (MPT) / Keccak state proofs today.** It is the only commitment format that exists on mainnet, and it will remain the canonical state commitment for at least ~2 more years — there is no state-tree change in Glamsterdam or (as of today) in Hegotá.
2. **Treat the *binary tree* as the approach Ethereum's state layer is actually heading toward** — currently specified as EIP-7864 ("unified binary tree", Jan 2025), now being superseded by EIP-8297 ("Partitioned Binary Tree" / PBT, June 2026), with migration specified in EIP-8347. Build your pipeline so this is a *new backend*, not a rewrite.
3. **Verkle is a dead end.** EIP-6800 is **Stagnant** and its specs were removed from `consensus-specs` in March 2026 ("unlikely to be included in an upgrade anytime soon"). Any 2023–2025 blog post saying "Verkle is coming" is stale.
4. **Do not take a hard dependency on the binary tree yet.** All three EIPs (7864, 8297, 8347) are **Draft with no CFI/SFI status for any fork**, and the tree's hash function is explicitly undecided. Hard-commit only when it's SFI for a named fork.

## Where Ethereum's state layer actually stands (as of Sept 2026)

**Live today:** Mainnet state is committed via the hexary Merkle Patricia Tree (Keccak/RLP), i.e. the format behind `eth_getProof` (EIP-1186) witnesses. If you want to verify a mainnet storage slot against a trust-minimized block header *today*, this is the only game in town. Serving proofs for *recent* blocks needs a synced full node at chain head, not an archive node.

**Verkle — deprioritized, effectively dead:** EIP-6800 was the leading statelessness candidate for years ("coming in the verge fork" per countless 2023–2024 posts). In 2024–2025, concerns about (a) post-quantum security — Verkle's elliptic-curve stack (Banderinas/related curve assumptions) is not quantum-safe, and NIST guidance calls for retiring ECC by 2030 — and (b) ZK-compatibility shifted core devs decisively away. In March 2026 the Verkle specs were removed from `consensus-specs` entirely, and Vitalik's August 2026 roadmap notes explicitly describe the replacement path as "Verkle → unified BT → PBT". Anyone telling you to build for Verkle is reading old material.

**The genuine direction: hash-based binary trees.** The protocol is converging on a unified binary tree replacing the "tree of trees" MPT design:

- EIP-7864 (Jan 2025): single binary tree merging account, storage, and chunked contract code; no RLP; co-located account data; ~75% smaller branch witnesses than hexary; depends only on hash functions, so it's post-quantum secure; designed from the start to be STARK/SNARK-friendly (a stepping stone to SNARKified L1, where most nodes won't hold state at all).
- EIP-8297 (June 2026): "Partitioned Binary Tree" — the *current* revision, by the same author group (Buterin, Ballet, Feist, jsign, et al.). Adds structural key-space partitions (headers vs code vs storage, per-account storage buckets) so later work — state expiry replacements and partial statelessness — can reference commitments to whole regions without side structures. This is what "PBT" in Vitalik's 2026 roadmap refers to.
- EIP-8347 (July 2026): offline migration of MPT state to the PBT — state is converted off the consensus-critical path (self-convert at a finalized anchor or download a verifiable snapshot), caught up by replaying Block-level Access Lists, and the commitment swap happens at a single coordinated hard fork. Note it *requires* EIP-7928 (Block-level Access Lists), which is shipping in Glamsterdam — the migration design is built on BALs existing first.

**Fork timing (from forkcast.org):**

| Fork | Projected activation | State-layer relevance |
|---|---|---|
| Glamsterdam | ~Dec 2026 (forkcast estimate) | ePBS (EIP-7732) + Block-level Access Lists (EIP-7928). **No state-tree change**, but BALs are a prerequisite the PBT migration depends on. |
| Hegotá (Heze + Bogotá) | ~mid-2027 (forkcast estimate) | Headliner selection concluded: FOCIL + Frame Tx. The binary tree is **not CFI** for Hegotá. |
| Beyond | 2028+, realistically | Earliest plausible PBT activation, and that's optimistic — it requires 8297 + 8347 to go Draft → Review → CFI → SFI → devnets → fork. Historical slip rates for changes of this magnitude (Verkle itself was "next fork" for ~3 years) suggest budgeting 2–4 years. |

## Timing flags that constrain how hard a dependency you can take

1. **No fork relationship at all.** 7864, 8297, and 8347 all show *no* CFI/SFI status for any upgrade on forkcast. Under the EIP-7723 inclusion process, this is pre-"seriously being evaluated for a specific fork." Features at this stage have a substantial failure-to-ship rate.
2. **The hash function is explicitly undecided.** EIP-7864's own text: the BLAKE3 choice is a placeholder for implementation friction ("Do not assume BLAKE3 is a final decision"), with Keccak and Poseidon2 as candidates. This means even the *commitment values* are not stable — you literally cannot freeze a verifier constant today for the future tree. Poseidon2 security analysis is still in progress; switching from a BLAKE3-style to an arithmetic hash changes proof circuits substantially.
3. **The design is still churning.** "Unified binary tree" (7864) was the leading design for 17 months and is now being superseded by "Partitioned Binary Tree" (8297). A pipeline hard-wired to 7864's exact key layout and node encoding would already be building against a moving target.
4. **The cutover breaks MPT proof verification in-EVM** (stated in EIP-8297: "the tree structure change breaks in-EVM verification of MPT state proofs. Post-fork state roots commit to the new tree"). So your MPT backend isn't just legacy — it's the format that will keep working *until the migration fork*, and your service needs a clean cutover story when it happens.

## What to commit to, concretely

- **Commitment interface (the durable asset):** `verify(witness, address, slot, expected_root) -> value`, with the tree format behind an abstract backend. The anchor (trust-minimized recent block header → state root) is independent of tree format and is where your trust-minimization work lives; keep it decoupled.
- **Backend 1 (ship now):** MPT/Keccak witnesses, i.e. `eth_getProof`-style account-proof + storage-proof pairs verified against the state root in your trust-minimized header. Expect this to be the canonical mainnet commitment into ~2028 at the earliest. Serving it requires only near-tip state, not an archive node.
- **Backend 2 (build when, not if):** the PBT/binary-tree witness format. Implement against EIP-8297 once (a) the hash function is decided, and (b) the EIP reaches **SFI for a named fork** — those are the two points at which the commitment format stops being re-specifiable. Watch forkcast for stage changes on 8297/8347 and the Hegotá-plus fork scopes; devnet matrices appearing (clients implementing on binary-tree devnets, as happened with Verkle's Kaustivan devnets) is the leading indicator that SFI is close.
- **Never:** Verkle/EIP-6800. Do not spend a line of code on it.

This gets you a trust-minimized product today, a straight-line migration to the format the protocol is genuinely converging on (the PBT family — hash-only, post-quantum, witness-compact, and intended to be the *final* state tree), and zero risk of having wired your proof pipeline to a design Ethereum has already walked away from once (Verkle) or is still actively revising (7864 → 8297).
