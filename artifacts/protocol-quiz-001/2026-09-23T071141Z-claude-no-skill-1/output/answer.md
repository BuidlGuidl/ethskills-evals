# State-proof format for a trust-minimized L1 light client

**Date of analysis: 2026-09-23**

## Recommendation in one paragraph

Build the verifier around **today's hexary Merkle-Patricia Trie proofs (EIP-1186 / `eth_getProof`)**, but put them behind a **tree-agnostic state-access interface**, and treat the **EIP-7864 unified binary state tree** as the destination you will migrate that interface to. Do **not** build anything around **Verkle trees** — that is precisely the design the protocol has moved away from. And do **not** take a hard dependency on the binary tree's *timing*: it is not in Glamsterdam, it was not selected as a Hegotá headliner, and its hash function is still formally undecided. The one place you *can* take a hard, long-lived dependency is the **header-authentication layer** (beacon-chain sync-committee light client + `EIP-4788` / `EIP-2935` for on-chain header anchoring), which is independent of the state tree format entirely.

---

## Where the state layer actually stands today

Ethereum mainnet state is still, in September 2026, a **hexary Merkle-Patricia Trie over RLP-encoded nodes, hashed with keccak256**, committed to via the `stateRoot` field of the execution block header. Nothing on mainnet has changed this. A storage-slot proof is still:

1. an **account proof**: MPT branch from `stateRoot` to `keccak256(address)` yielding the RLP account `(nonce, balance, storageRoot, codeHash)`;
2. a **storage proof**: MPT branch from that `storageRoot` to `keccak256(slot)` yielding the RLP-encoded value.

This is what `eth_getProof` returns, it is what Helios and every production light client verifies, and it will remain the only mainnet state commitment for at least the next two hard forks. That is a fact about *now*, not a prediction.

## Where it is genuinely going

**Verkle is dead.** Verkle trees (EIP-6800 and friends) were the official "Verge" plan for several years and were, as late as 2024, the leading candidate for a 2026 fork. They are no longer on the roadmap. Two things killed them:

- **Quantum risk.** Verkle's vector commitments rest on elliptic-curve assumptions (Banderwagon/IPA). The rest of the roadmap has been moving hard toward hash-based, post-quantum primitives; a state commitment that breaks under a CRQC is a bad thing to enshrine for a decade.
- **Provability.** The zkEVM push made "how cheap is this tree to open *inside a proof system*" a first-class requirement, and elliptic-curve openings are awkward to prove recursively. Hash-based binary Merkle trees are not.

**The successor is EIP-7864, "Ethereum state using a unified binary tree."** Authored by Vitalik Buterin, Guillaume Ballet, Ignacio Hagopian and others (created January 2025, still **Draft**). Its shape matters for your verifier:

- A genuinely **binary** tree of `InternalNode(left, right)`, terminating in **`StemNode`s that hold 256 leaf values** indexed by the final key byte. So branches are binary, but the last level is a 256-wide group.
- **Unified** key space: no more separate account trie and per-account storage tries. Keys are `storage-type-prefix (0 = header fields, 1 = code, 255 = storage) || hash(address) || subindex`, with slots past the header group keyed as `hash(address) + hash(address || storage_key_prefix)` to prevent key-grinding.
- **Co-location**: an account's basic fields, its **first 64 storage slots**, and its **first 128 code chunks** all live in one stem. For a light client this is a real win — proving a low-numbered slot of a contract becomes roughly *one* branch opening rather than two independent trie walks.
- Claimed effect: roughly **~75% smaller Merkle proofs** and 3–4× shorter branches versus the hexary MPT.

**The hash function is not chosen yet.** The reference implementation uses **BLAKE3** to let EL clients experiment; **Keccak** and **Poseidon2** remain candidates. Notably, the EF **walked away from Poseidon for L1 in August 2026** — not because it was broken (the March review's consensus was "unbroken, repairable") but because round-skipping results shrank its security margin at the same time that binary-field proof systems (the Binius line) removed the premise that conventional hashes are unaffordable in-circuit. The live expectation is a conventional hash (SHA/BLAKE family). This is the single most important reason you cannot freeze a binary-tree verifier today: **your hash is not yet a known constant.**

**Transition is an overlay, not a flag-day.** EIP-7864 introduces the binary tree *empty*, alongside the existing MPT, which is **frozen and read-only** — new writes go to the binary tree, reads fall back to the MPT. Actual migration of the frozen MPT data is a *separate, later* EIP (**EIP-7748**, state conversion), in a *separate, later* fork. The direct consequence for you: **there will be a multi-year period, possibly years long, in which correctly reading a mainnet storage slot requires both a binary-tree verifier and an MPT verifier, plus overlay fallback logic.** This is the biggest single constraint on your architecture and it is often missed.

**The parallel track: L1 zkEVM.** Real-time proving targets were met in December 2025 (block proofs from ~16 minutes to ~16 seconds, ~45× cost reduction; SP1 proving ~93% of live mainnet blocks in under 12s). 2026 shifted from speed to *security*: soundcalc integration by Feb 2026, ≥100-bit provable security by May 2026, 128-bit with sub-300 KB proofs by end of 2026, with EIP-8025 letting validators verify blocks by proof instead of re-execution. This matters to you strategically: **the eventual endgame for a light client is not walking a trie at all, but verifying a succinct proof of the state transition.** It is not something you can consume as a protocol-provided artifact today.

## Timing — how hard a dependency you can take

This is the part that should govern your decision.

| Fork | Timing | Contains a state-tree change? |
|---|---|---|
| **Glamsterdam** | Sepolia fork targeted ~Oct 6 2026; mainnet target ~Nov 4 2026, realistically Q4 2026 | **No.** Headliners are EIP-7732 (ePBS) and EIP-7928 (block-level access lists). |
| **Hegotá** | Headliners finalized Feb 2026; targeted "by end of 2026," realistically 2027 | **No.** Headliners are EIP-7805 (FOCIL) and EIP-8141 (Frame Transactions). Of 62 EIPs evaluated, 2 must-ship, 15 expected, 28 declined; the binary tree is not among the headliners, and scope was explicitly trimmed to keep the fork on schedule. |
| **Fork after that** | — | Earliest *plausible* home for EIP-7864. Then **another** fork later for EIP-7748 conversion. |

The EF's own 2026 priorities framing puts it plainly: repricing and history expiry are the **short-term** state-scaling levers; **binary trees and statelessness are long-term**. EIP-7864 has been Draft since January 2025 with no CFI for a scheduled fork and an unresolved hash choice.

**Therefore: the binary tree is the right thing to build *toward* and the wrong thing to build *on* right now.** Realistic mainnet arrival is 2028 at the earliest for the overlay, later still for full conversion. A verifier shipped today against EIP-7864 would be a verifier against a Draft spec with an unchosen hash and no mainnet data to prove against.

---

## What to actually build

**1. Make the tree format a plugin, not an assumption.** Your verifier's public contract should be:

```
verify(headerCommitment, address, storageKey) -> Option<U256>
```

with the tree walk behind a `StateProofBackend` trait. Ship `MptBackend` now. Add `BinaryTreeBackend` when the hash is frozen and a devnet exists. Crucially, design for **both being live at once** — the overlay period demands an `OverlayBackend` that tries binary-tree-first and falls back to the frozen MPT, and that composition should already be expressible in your types on day one.

**2. Keep MPT-specific concepts out of everything above the backend.** RLP encoding, hex nibbles, the two-level account-trie-then-storage-trie structure, `keccak256` as *the* hash, and the very notion of a per-account `storageRoot` are all MPT artifacts that **do not survive** into EIP-7864's unified key space. If `storageRoot` appears in your caching layer, your API types, your on-chain verifier contract, or your test fixtures, you have already coupled to the losing design. Model your cache key as `(address, storageKey)` — a flat, tree-agnostic pair that maps cleanly onto both designs.

**3. Put your hard dependency on header authentication, which is stable.** Trust-minimization comes from *how you learn a trustworthy `stateRoot`*, not from the tree shape. The beacon-chain **Altair sync-committee** protocol (512 validators resampled every 256 epochs ≈ 27h, signing every header) is a stable, long-lived consensus-layer artifact orthogonal to the execution state tree. Use it. For on-chain verification, **EIP-4788** exposes the parent beacon block root in the EVM and **EIP-2935** gives you 8192 (~27h) of historical execution block hashes. None of these change when the state tree changes. This is where you should spend your "commit now" budget.

**4. Be explicit about the freshness/finality tradeoff.** Sync-committee optimistic heads are near-tip but reorg-able; finalized roots lag ~13 minutes. "As of a recent block" needs to be a per-query policy knob, not a hardcoded choice — and it's a separate axis from proof format entirely.

**5. Watch, don't wire, the zkEVM path.** If you build (1) correctly, swapping the backend for "verify a validity proof of the block, with the state read proven inside" is another backend implementation rather than a rewrite. Track the 128-bit / sub-300 KB end-of-2026 milestone and EIP-8025 as leading indicators. Do not make it load-bearing yet.

**6. Note the operational dependency you keep either way.** You still need someone to *serve* the witness. `eth_getProof` is an untrusted data source in your model — that's fine, the proof is self-verifying — but availability and recent-state retention limits at providers are real. Portal Network state proofs are the trust-minimized alternative for witness *retrieval*; worth designing the fetch layer to accept multiple sources.

## Summary

The protocol's state layer is going **hexary keccak MPT → unified binary Merkle tree (EIP-7864), hash-based and post-quantum-oriented, with a long frozen-MPT overlay period before EIP-7748 conversion**. Verkle is off the roadmap; building on it would be exactly the mistake you're trying to avoid. But the binary tree is not in Glamsterdam (Q4 2026), is not a Hegotá headliner, is still a Draft with an undecided hash function, and is 2028+ on any honest reading. So: **ship MPT now, abstract the tree, anchor hard on sync-committee header authentication, and budget explicitly for a long dual-tree overlay period rather than a clean cutover.**

## Sources

- [EIP-7864: Ethereum state using a unified binary tree](https://eips.ethereum.org/EIPS/eip-7864)
- [EIP-7864 discussion — Fellowship of Ethereum Magicians](https://ethereum-magicians.org/t/eip-7864-ethereum-state-using-a-unified-binary-tree/22611)
- [Binary Tree — Ethereum stateless book](https://stateless.fyi/trees/binary-tree.html)
- [EIP-7612 / state conversion — Ethereum stateless book](https://stateless.fyi/state-conversion/eip-7612.html)
- [Ethereum Roadmap Drops Poseidon for SHA or BLAKE](https://postquantum.com/security-pqc/ethereum-roadmap-drops-poseidon/)
- [Why Ethereum Walked Away from Poseidon — ZKM](https://www.zkm.io/blog/why-ethereum-walked-away-from-poseidon)
- [Ethereum L1 drops Poseidon in post-quantum move — crypto.news](https://crypto.news/ethereum-l1-drops-poseidon-in-post-quantum-move/)
- [EF Protocol: The Hegotá EIP Opinion Post and Tier List](https://blog.ethereum.org/2026/09/07/protocol-hegota-eips)
- [EF Protocol: Current and Emerging Priorities](https://blog.ethereum.org/2026/09/07/protocol-priorities)
- [Protocol Priorities Update for 2026](https://blog.ethereum.org/2026/02/18/protocol-priorities-update-2026)
- [Hegota Upgrade EIP Proposal Timelines](https://blog.ethereum.org/2025/12/22/hegota-timeline)
- [Ethereum's Glamsterdam upgrade: what changes for infrastructure — Chainstack](https://chainstack.com/ethereum-glamsterdam-upgrade/)
- [Glamsterdam Enters Final Devnet Phase — The Defiant](https://thedefiant.io/news/blockchains/ethereum-glamsterdam-final-devnet-200m-gas-limit-target)
- [Shipping an L1 zkEVM #1: Realtime Proving](https://blog.ethereum.org/2025/07/10/realtime-proving)
- [zkEVM for L1 block verification — ethereum.org](https://ethereum.org/roadmap/zkevm/)
- [Towards Stateless Clients: Benchmarking Verkle vs Binary Merkle Trees with SNARKs (arXiv 2504.14069)](https://arxiv.org/pdf/2504.14069)
- [Helios light client — a16z](https://github.com/a16z/helios)
