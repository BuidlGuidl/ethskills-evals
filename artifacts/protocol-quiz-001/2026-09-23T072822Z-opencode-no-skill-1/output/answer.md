# Recommendation: which state-proof format to build around

## Short answer

Build your verifier around **Merkle Patricia Trie (MPT) proofs today — the `eth_getProof` (EIP-1186) format: an account proof plus a storage proof against the execution payload's `stateRoot`, with the `stateRoot` itself anchored trustlessly via the beacon light-client sync-committee chain**. Put the proof format behind a clean abstraction so you can swap in **binary-tree proofs** later, because the unified/partitioned binary tree (EIP-7864, refined by EIP-8297) is where Ethereum's state layer is actually heading.

**Do not build around Verkle.** That ship has sailed — it is no longer the protocol's direction.

## Where the state layer stands today (September 2026)

- **MPT is the only live state commitment.** Every mainnet block's `stateRoot` is a hexary Keccak Merkle Patricia Trie root. A storage-slot proof today is a two-level MPT proof (account proof → `storageHash`, then storage proof → slot value). It is verifiable entirely offline against a block header, and the header can be obtained trust-minimized via the consensus-layer light-client protocol (sync committee signatures + Merkle branches into the execution payload header). This is what Helios and every serious light client already do. It is standardized, implemented by all clients, and available from any full node RPC (`eth_getProof`).
- **Verkle (EIP-6800) is dead in practice.** It was the "Verge" plan for years, but it is now stagnant/deprioritized: it rests on elliptic-curve polynomial commitments that are not post-quantum secure (NIST guidance is to retire ECC by ~2030), and SNARK proving got fast enough that "binary tree + SNARK-friendly hash" can match Verkle's main advantage (small witnesses). Core developers publicly consider Verkle's chances low. Wiring your pipeline to Verkle proofs would be wiring it to a design the protocol is moving *away* from.
- **The binary state tree is the anointed successor.** EIP-7864 (Jan 2025, Buterin/Ballet/Feist et al.) proposed replacing the MPT with a single unified binary tree holding accounts, code, and storage. In 2026 this has real momentum: geth merged an EIP-7864 bintrie implementation, the Stateless Consensus calls treat binary trees as the assumed direction, and in June 2026 the design was refined into **EIP-8297 (Partitioned Binary Tree)** — variable-length prefix-free keys, the key space partitioned into zones (account headers / code / storage), code content-addressed, stems for locality — with migration specified separately in **EIP-8347** (offline MPT→binary conversion, activated at one coordinated fork). For your use case (light-client storage proofs) this direction is strictly better: binary branches are ~3–4× shorter than MPT branches, proofs are smaller, and the design explicitly targets client-side proving.

## Timing flags — how hard a dependency you can take on the binary tree

This is the part that should temper the design, not the direction:

1. **The spec is not frozen.** EIP-7864 is still Draft; EIP-8297 is a June-2026 refinement that may supersede it; the *hash function is explicitly undecided* (BLAKE3 is a placeholder; Poseidon2 is the favored proving-friendly candidate but still needs security review). Proof encoding details could still change. You cannot ship a binary-tree verifier today against a final spec — one doesn't exist.
2. **No fork is scheduled.** Glamsterdam (mid-2026) shipped ePBS and Block Access Lists, not the state tree. Hegota (targeted late 2026 / early 2027) has binary trees on the table but no finalized headliner. A realistic earliest mainnet activation is **2027+**, and Ethereum roadmap timelines historically slip. EIP status "Draft" means "not scheduled" — don't treat roadmap diagrams as commitments.
3. **The transition is designed to be staged.** Migration (EIP-8347) happens off the consensus path, and the state tree activates fully populated at a single fork. Crucially: **after that fork, `stateRoot` commits to the binary tree, and in-EVM/off-chain verification of MPT proofs against new blocks breaks** (EIP-8297 calls this out as the main breaking change). MPT proofs remain valid for *historical* pre-fork blocks, but not for "recent block" proofs — which is exactly your use case.
4. **Net timing implication:** MPT proofs are guaranteed to be the correct format for at least the next ~1–2 years and possibly longer, but they are *not* the format your verifier will use long-term. The binary tree will likely be the *final* state tree Ethereum ever deploys (hash-only, post-quantum-safe, no second migration like Verkle would have required).

## Concrete recommendation

1. **Ship on MPT proofs now.** Verify `(address, slot, block) → value` via EIP-1186 account+storage proofs against `stateRoot`, and verify `stateRoot` against a beacon block root using the sync-committee light-client protocol. This is trust-minimized, works today against any RPC *as an untrusted prover* (you check the proof, not the provider), and requires no archive node.
2. **Abstract the proof format behind an interface** from day one: `verify(stateRoot, key, value, proof) -> bool` with pluggable MPT vs. binary-tree implementations, plus a `keyDerivation(address, slot) -> treeKey` layer. The binary-tree key derivation (zones, stems) differs fundamentally from MPT's `keccak(slot)` layout, so isolate that too.
3. **Track, don't adopt, the binary tree.** Follow EIP-8297 / EIP-8347, the Stateless Consensus calls, and forkcast for actual CFI/SFI scheduling. Add a binary-tree verifier once the hash function and key encoding are frozen and a fork is scheduled — that's the moment the format becomes a safe hard dependency. Until then, treat it as a known future migration, not a build target.
4. **Explicitly avoid Verkle** in any dependency or format decision; EIP-6800 is stagnant and the curve-based crypto stack it would add is on a retirement path.

**Bottom line:** the only proof format that exists and is trustworthy today is the MPT proof; the only format the protocol is genuinely converging on is the binary state tree. Build for the former, design for the latter, and don't touch Verkle.
