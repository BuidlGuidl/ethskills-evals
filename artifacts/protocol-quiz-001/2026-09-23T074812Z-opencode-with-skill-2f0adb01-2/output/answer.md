# Recommendation: state-proof format for our trust-minimized L1 storage-slot verifier

## TL;DR

Build around the **MPT witness format today, behind a pluggable proof-backend interface**, and track the **hash-based binary tree (Partitioned Binary Tree, EIP-8297)** as the format you'll migrate to. Do **not** build around Verkle trees. Do **not** take a hard dependency on PBT's current draft format either — it is Draft, unscheduled for any fork, and its hash function is explicitly not final.

The one thing you genuinely cannot do is commit your whole pipeline to a single concrete format: the format Ethereum is heading toward (PBT) is ~2+ years from mainnet, and the format live today (MPT) has a known expiry date. So commit to the *architecture* (a swappable proof backend), not to one encoding.

## Where Ethereum's state layer stands today (Sept 2026)

- **Mainnet state today is committed with the hexary Merkle Patricia Trie (MPT)** — Keccak256 hashing, RLP node encoding, a "tree of trees" (state root → account trie + per-contract storage tries). Every `eth_getProof` response, every state root in every block header, is an MPT commitment. There is no alternative: if you want to verify a mainnet storage slot as of a recent block *right now*, you verify an MPT Merkle proof against the state root in a (beacon-light-client-anchored) block header. This stays true through at least the end of 2026.
- **Glamsterdam** (projected ~Dec 2026; forkcast's planning estimate) ships the statelessness groundwork: **EIP-7928 Block-Level Access Lists (Scheduled)** and **EIP-8037 state-creation gas (Scheduled)**. BALs are not a proof format for you, but they matter: they're the mechanism the future tree migration replays state from, and they signal the statelessness track is active.
- **Hegotá** (~mid-2027, planning phase) has FOCIL (EIP-7805) and Frame Transactions (EIP-8141) scheduled. Only migration-*prep* EIPs (e.g. EIP-8253, cleaning up legacy zero-nonce accounts) are under consideration for Hegotá — **the tree swap itself is not in Hegotá**. EF research expects the PBT migration in **fork "I\*", the fork after Hegotá — realistically 2028+**.
- **Verkle trees are effectively dead as the state-tree plan.** They were the leading statelessness candidate for years, but were deprioritized in 2024–2025 because (a) the elliptic-curve cryptography (Pedersen commitments/IPA) is not post-quantum secure while NIST guidance calls for retiring ECC by 2030, (b) SNARK proving systems improved enough that the old "witnesses must be tiny and natively verifiable" argument weakened, and (c) Verkle would itself need replacing for PQ reasons — the binary tree is intended to be the final tree. Geth is literally replacing its Verkle code with binary-tree code. Anyone telling you "build for Verkle" is reading 2023 sources.

## Where it is genuinely going: the hash-based binary tree (PBT)

The destination is **EIP-8297, the Partitioned Binary Tree** (June 2026, successor to EIP-7864's unified binary tree), with migration mechanics in **EIP-8347** (offline conversion at a finalized anchor block, catch-up by replaying BALs, canonical swap at one hard fork). Key properties, all of which matter for a state-proof verifier:

- **Single unified tree** for accounts, code, and storage — no more tree-of-trees. One Merkle proof path commits to any state item.
- **Hash-based merkleization** (PQ-secure), no RLP. Binary arity → `log2` sibling path instead of the MPT's wide RLP-encoded branch nodes, and far more ZK-proving-friendly than either MPT or Verkle.
- **Stems co-locate data**: an account's header, basic data, and first ~64 storage slots live under one key prefix, so proving "this account's slot N" usually needs one stem opening, not separate account-trie + storage-trie proofs.
- **Code is chunked into the tree** and content-addressed, so the same proof format covers bytecode (relevant if you ever want to verify a contract's code hash without trusting an RPC).
- EIP-8297 says it outright: *"the tree structure change breaks in-EVM verification of MPT state proofs. Post-fork state roots commit to the new tree, so contracts that verify proofs against them must adopt the new tree's proof format."* Your service has the same property — your MPT backend has a known sunset at the swap fork.

## Timing: how hard a dependency can we safely take?

**On PBT — soft dependency only.** Concretely, as of today (forkcast, Sept 2026):

- EIP-8297 and EIP-8347 are **Draft with no fork relationship** — not CFI'd, not SFI'd, not scheduled for Hegotá or any named fork. Best case the swap lands in fork I\* ≈ 2028; historically, tree-transition timelines in Ethereum have only ever slipped.
- **The hash function is explicitly not final.** The current draft/implementation uses BLAKE3 "to reduce friction," with Poseidon2 the leading candidate pending formal security analysis from EF cryptography. The EIP text itself says: *"Do not assume BLAKE3 is a final decision."* A witness format is inseparable from its hash function — this alone makes any hard commitment to today's draft format premature.
- Witness/proof encodings, group depth, and key derivation details are still being benchmarked and iterated (active geth/ethrex work, devnets still ahead of us). Wiring your pipeline to byte-level details of a Draft spec means tracking churn for two years before it matters.

**On MPT — hard dependency, but a scheduled one.** MPT is the only thing that actually verifies mainnet state today and for at least ~2 more years. It's stable, fully specified (execution-specs), supported by every client's `eth_getProof`, and battle-tested. The cost is that it's the *departing* format — hence the interface.

## What I'd build

1. **A `StateProofBackend` abstraction** with a minimal interface: `verify(state_root, address, slot, witness) -> value`. Everything upstream (beacon-chain light client for recent finalized state roots, your API) is format-agnostic.
2. **Backend #1: MPT (ship this).** Verify the account proof and storage proof from an `eth_getProof`-shaped witness against the state root of your anchored block. This is the only backend that works on mainnet today, and it keeps working until the swap fork. Given the MPT's known break point, isolate *everything* MPT-specific (RLP, Keccak, tree-of-trees composition) inside this backend.
3. **Backend #2: PBT (prototype when it firms up).** Track EIP-8297 + EIP-8347 on forkcast and the stateless-consensus calls. Start prototyping only once (a) it gets a fork relationship (CFI at minimum, ideally SFI) and (b) the hash function decision lands — because the BLAKE3↔Poseidon2 switch is designed to be a small change for implementers *who isolated it*, and a rewrite for those who didn't. Budget for the swap fork being your real migration trigger: mainnet state roots will change commitment format at one specific block, and your service needs a coordinated cutover, not a scramble.
4. **Isolate the hash function** inside each backend from day one — this is the single highest-leverage piece of future-proofing given the explicit TBD.

## Bottom line

- The approach Ethereum's state layer is genuinely heading toward is the **hash-based binary tree (EIP-8297 PBT)** — build your *abstraction* around that trajectory.
- The format you must actually verify against **today and for roughly the next two years is the MPT** — build your *shipped backend* around that, and only that.
- **Verkle: no.** Deprioritized for post-quantum and ZK reasons; client teams are actively removing it.
- Treat PBT as a **tracked dependency, not a committed one**: Draft status, unscheduled, hash function TBD, realistic mainnet swap 2028+. Re-evaluate at every fork scope announcement; the concrete trigger to start building the PBT backend is SFI status plus a settled hash function.

### Sources checked (Sept 23, 2026)

- forkcast.org API: EIP-8297/8347 Draft, no fork relationships; EIP-7928 & 8037 Scheduled for Glamsterdam (projected ~Dec 2026); Hegotá planning, projected ~mid-2027
- EIP-7864, EIP-8297, EIP-8347 specs (hash-function TBD / "Do not assume BLAKE3 is a final decision"; migration via anchor block + BAL replay; breakage of in-EVM MPT proof verification)
- EF Protocol, "The Hegotá EIP Opinion Post and Tier List" (Sept 7, 2026): only trie-migration prep (EIP-8253) under consideration for Hegotá
- ethresear.ch, "How Hegotá can influence the state roadmap" (Sept 3, 2026): "the PBT migration is expected later, in fork I\*"
- Stateless consensus call notes (hackmd): Verkle "low chance of being used"; binary tree intended as the final tree; Poseidon2 security analysis ongoing
- geth PRs #32365 / #35436: binary tree replacing Verkle in the codebase; PBT implementation work in progress
