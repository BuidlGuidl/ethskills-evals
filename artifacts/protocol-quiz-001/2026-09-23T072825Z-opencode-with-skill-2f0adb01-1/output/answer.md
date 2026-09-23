# Recommendation: which state-proof format to build around

## Short answer

**Build your verifier around standard Merkle Patricia Trie (MPT) proofs against the finalized execution state root — that's the only thing that verifies against live mainnet today — but put the proof-verification layer behind a pluggable "state backend" interface, and design that interface for the binary-tree proofs Ethereum is migrating to. Do NOT build around Verkle, and do NOT hard-code the binary-tree spec yet.**

The trust anchor of your design (sync committee → finalized checkpoint → execution payload header → `stateRoot`) survives the state-tree migration unchanged. Only the module *below* the state root changes. Architect for exactly that swap.

---

## Where the state layer stands today (September 2026)

- **Mainnet state is still the hexary MPT**: Keccak hashing, RLP encoding, a two-level structure (account trie → per-contract storage trie). A storage-slot proof today is two chained MPT branch proofs, roughly ~3.8 KB in the average case. This is what `eth_getProof` returns and what every existing light client (e.g. Helios) verifies.
- **Glamsterdam** (~Q3–Q4 2026, scope frozen per EIP-7773) ships ePBS, Block-Level Access Lists (EIP-7928), and state gas repricing — **no state-tree change**. One item worth your attention: EIP-7688 (forward-compatible consensus data structures) stabilizes the consensus-layer paths to execution data, which is good news for your trust anchor.
- **Hegotá** (next fork, early scoping per EIP-8081) is headlined by FOCIL and frame transactions, with optional zkEVM execution proofs (EIP-8025) being considered — again **no state-tree change**.

So for the foreseeable future, MPT proofs are what works in production.

## Where it's genuinely going: binary trees, not Verkle

This is the part that's easy to get wrong from stale sources:

- **Verkle (EIP-6800) was the leading direction for years and is now deprioritized.** Two reasons: (1) its vector-commitment stack relies on elliptic curves that are not post-quantum (NIST guidance is to retire ECC by 2030), and (2) progress in ZK proving systems made plain hash-based Merkle trees viable for the ZK-proven-L1 roadmap, eroding Verkle's main advantage (tiny witnesses). Do not wire anything to Verkle.
- **The current direction is a binary Merkle tree**, specified in two Draft EIPs:
  - **EIP-7864 — Unified Binary Tree (UBT)** (Jan 2025): single balanced tree, 32-byte keys, stem-level packing of account header + first storage slots + code chunks.
  - **EIP-8297 — Partitioned Binary Tree (PBT)** (Jun 2026): the newer evolution, partitioning the key space into zones (headers / code / storage), with content-addressed code. Current state-roadmap discussion (ethresear.ch, Sept 2026) treats **PBT as the expected design**, with activation targeted at the fork *after* Hegotá ("fork I\*") — realistically **2027 at the earliest, quite possibly later**.
  - **EIP-8347** defines the migration: offline conversion of MPT state at a finalized anchor block, catch-up by replaying Block-Level Access Lists (the EIP-7928 BALs shipping in Glamsterdam), and an atomic switch of the state-root commitment at the activation fork.

Key properties of the future format, whichever of UBT/PBT wins:

- **One tree, one branch.** A storage slot is proven by a single branch in a single tree — no more account-trie + storage-trie chaining.
- **Hash-only cryptography** (candidates: BLAKE3, Keccak, Poseidon2 — **explicitly not decided**). Post-quantum-safe and ZK-friendly.
- **No RLP, no ECC.**
- Smaller proofs (~768 bytes vs ~3.8 KB for MPT, per client-team estimates).

## Timing: how hard a dependency can you take?

| Component | Status | Safe to depend on? |
|---|---|---|
| MPT proofs vs `stateRoot` | Live on mainnet today | ✅ Yes — your only production-viable option now |
| Verkle (EIP-6800) | Deprioritized; no fork relationship | ❌ No — dead end |
| UBT (EIP-7864) | **Draft**; not CFI/SFI for any fork | ❌ Not as a hard dependency |
| PBT (EIP-8297) + migration (EIP-8347) | **Draft**; expected fork *after* Hegotá (2027+) | ❌ Not yet — but track it as the most likely end state |

Both binary-tree EIPs are **Draft status with no fork scheduling**. The hash function is TBD, and the UBT-vs-PBT structural question is still being worked through. Hard-coding either spec today risks exactly the "wired to a design the protocol moved away from" failure you want to avoid — the same thing that would have happened to a team that committed to Verkle in 2023.

## Concrete architecture advice

1. **Ship MPT proof verification now.** It's the only format that verifies against live state roots, it's stable, well-specified, and has mature libraries in every language.
2. **Isolate the tree proof behind an interface.** Something like: `verify(anchor: StateRoot, address, slot) -> value`. Two implementations: `MptBackend` (now) and `BinaryBackend` (later). Everything above the state root — sync-committee light-client logic, finalized-header retrieval, your API surface — must not know which tree is underneath.
3. **Design the interface for the binary future, not the MPT present.** Concretely: assume a *single* tree proof per storage slot (not two chained proofs), assume hash-only verification with a pluggable hash function, and don't let RLP/MPT node internals leak into shared types. If you do this, the eventual migration is a backend swap plus a recompile, not a pipeline rewrite.
4. **Plan for an atomic switchover, not a hybrid.** Under the current PBT migration plan (EIP-8347), the state root flips from MPT to the new tree at a single coordinated fork block. Your service should be able to select the backend by block height. (Note: the older UBT plan had a frozen-MPT overlap period; if that variant wins, you'd need dual-proof fallback during the transition — another reason to keep the backend pluggable.)
5. **Track, don't adopt.** Watch forkcast.org for EIP-7864 / EIP-8297 / EIP-8347 moving from Draft to CFI for the post-Hegotá fork, and the hash-function decision (BLAKE3 vs Poseidon2 vs Keccak). The moment one is SFI with a devnet, you can start building the `BinaryBackend` against real test vectors with confidence.

**Bottom line:** MPT proofs today, behind an abstraction shaped like the single-tree, hash-based binary proofs the protocol is converging on (PBT being the current front-runner). Verkle is out; the binary tree is coming but is 2027-or-later and still in flux — so it belongs in your interface design, not in your production verifier.
