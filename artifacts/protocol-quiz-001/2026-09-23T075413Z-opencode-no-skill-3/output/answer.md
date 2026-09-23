# Recommendation: build around MPT proofs today, behind an abstraction — the protocol's destination is the **hash-based binary tree (PBT)**, not Verkle

## TL;DR

Build your verifier's state-proof format around what mainnet actually commits to **today**: the
Keccak-256 hexary **Merkle Patricia Trie (MPT)** — EIP-1186-style account + storage proofs
(`eth_getProof` witness format) — anchored to the execution `stateRoot` via a beacon-chain light
client (sync committees).

But wire it behind a swappable "state witness" interface, because the format the protocol is
genuinely heading toward is the **Partitioned Binary Tree (PBT, EIP-8297)** — a hash-based,
SNARK-friendly binary tree — with an offline state migration (EIP-8347). **Do not build anything
around Verkle trees**: that is precisely the design Ethereum's state layer is moving away from.

## Where Ethereum's state layer stands today (Sept 2026)

- Mainnet state is still committed via the **MPT**: a tree-of-trees (account trie + one storage
  trie per contract), RLP-encoded nodes, Keccak-256. Storage proofs are two proofs (account branch
  → `storageRoot`, then storage branch). This is the only format you can verify against mainnet
  state roots right now, and it will remain canonical until the binary-tree fork activates.
- Verkle trees (EIP-6800 family) were the plan for years. That changed: since Vitalik's late-2024
  "The Verge" analysis and through 2025–2026, the roadmap's center of gravity moved to
  **STARKed binary hash trees**. The current reference points are:
  - **EIP-7864** (Jan 2025): unified binary tree, the first formal binary proposal.
  - **EIP-8297** (June 2026): **Partitioned Binary Tree** — its successor. Single tree with
    zone-partitioned, prefix-free keys; account and storage tries merged; RLP gone; code chunked
    and content-addressed; account data co-located for locality. Reference implementation hashes
    with BLAKE3, but the hash choice is explicitly **not final** (Keccak, BLAKE3, Poseidon2 all
    candidates).
  - **EIP-8347** (July 2026): offline migration — state converted at a finalized anchor block,
    caught up by replaying Block-Level Access Lists (EIP-7928, shipping with Glamsterdam), attesters
    publish signed "shadow roots" for observability, and the commitment swaps at a single
    coordinated hard fork (`PBT_ACTIVATION_FORK`).
- Fork sequencing per current EL discussion: **Glamsterdam** (BALs + state gas) → **Hegotá** →
  the PBT migration "later, in fork I*". Both PBT EIPs are still **Draft**, and `PBT_ACTIVATION_FORK`
  "names but does not schedule" itself. Realistically, mainnet activation is **years out
  (~2028+ at the earliest)**.

## Why the protocol abandoned Verkle (and why you should too)

1. **Post-quantum security.** Verkle proofs rest on elliptic-curve vector commitments; a hash-based
   binary tree depends only on hash functions and stays secure under Shor. NIST guidance calls for
   retiring ECC by 2030, and EIP-8297 says it outright: Verkle "would eventually need to be
   replaced by a post-quantum secure alternative," while the binary tree "will probably be the
   final state tree used in the protocol." Building on Verkle means wiring for a design the
   protocol intends to replace *twice*.
2. **Prover progress killed Verkle's main advantage.** Verkle's selling point was small, fast
   proofs. STARK/GKR-style prover throughput gains mean pre/post-state proofs over a plain
   binary hash tree are now fast enough, with far less cryptographic novelty.
3. **Simplicity.** Binary Merkle branches are boring, auditable, natively updatable, and efficient
   for small proofs — exactly your use case (one contract, one slot). Arity-2 minimizes branch
   size (~768 bytes for a 2^24-leaf tree vs ~2880 for hexary), and proofs are plain hash chains,
   no pairings, no trusted setup.

## What this means for you: how hard a dependency can you safely take?

- **Safe dependency now: MPT witness format.** It's the only thing live on mainnet, and it stays
  canonical through at least Glamsterdam and Hegotá. Treat it as your v1 production format.
- **Unsafe dependency: Verkle.** Deprioritized across clients and research; building to it now
  guarantees a rewrite.
- **Future dependency, not a present one: PBT.** It's where the protocol is genuinely going, but
  it's Draft, the merkelization hash isn't pinned, and no fork is scheduled. Don't hard-wire to
  EIP-8297's specifics today — but do design so you can adopt its witness format later:
  - single-tree proofs (no per-account `storageRoot`; a slot proof is one branch in one tree),
  - tagged node hashing (`leaf = H(0x00 ‖ key ‖ value)`, `branch = H(0x01 ‖ prefix ‖ L ‖ R)`),
    prefix-carrying branch nodes, absence proofs for zero values.
- **Timing is in your favor.** EIP-8347 itself flags "on-chain proof consumers (bridges,
  light-client verifiers, `eth_getProof` consumers)" as *"the longest-lead-time dependency of the
  migration"*, with a rehearsal + shadow-commitment period before any swap. You will get
  **years of notice**, a testnet rollout, and a transition window (both trees kept until the swap
  fork finalizes) before MPT proofs stop being usable. There is no scenario where you wake up and
  MPT proofs are dead next quarter.
- **Your beacon-light-client half is fork-proof.** EIP-8347 keeps `ExecutionPayload.state_root`
  as 32 opaque bytes to the CL — sync-commitry light clients don't change; only the 32-byte root's
  meaning does. Invest confidently there.

## Concrete plan

1. **v1 (now):** sync-committee beacon light client → execution payload `stateRoot` →
   MPT account proof + storage proof for `(address, slot)`. Verify Keccak/RLP node hashing
   yourself; never trust the RPC's word for the value, only use it to *fetch* the witness.
2. **Abstract the witness:** a `verifyStateWitness(stateRoot, address, slot, value, witness,
   format_version) -> bool` interface with a pluggable tree module. Keep RLP/Keccak logic fully
   contained in the MPT module.
3. **v2 (when PBT fork is scheduled + testnets live):** add a PBT witness verifier per EIP-8297
   (pin the hash function once the EIP does), switch per fork block — the same pattern the
   migration itself uses (commitment meaning changes at one fork).
4. **Optional hedge:** if you later want succinctness, wrap the tree verification in a STARK/SNARK
   once PBT lands — the tree was designed for exactly that. But that's a post-PBT problem; don't
   take it on now.

## Bottom line

The protocol's state layer is moving from MPT directly to a **hash-based partitioned binary tree**
(EIP-8297 + EIP-8347), skipping Verkle entirely — Verkle is the design Ethereum is moving *away*
from. So: build v1 on MPT (the only live truth), keep the witness format swappable, and reserve a
clean slot for the PBT branch-proof format as your migration target. Don't hard-code either future
drafts' unpinned parameters (hash function) or Verkle anything.
