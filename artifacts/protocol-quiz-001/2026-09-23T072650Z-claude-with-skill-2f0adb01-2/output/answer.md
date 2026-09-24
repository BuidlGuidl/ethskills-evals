# State-proof format for the light client

**Date of research: 2026-09-23.** Protocol status changes; re-check before you freeze anything.

## Recommendation

**Build on Merkle-Patricia-Trie (MPT) proofs today — `eth_getProof`-shaped account + storage proofs verified against the `stateRoot` of a header you independently trust — but put them behind a versioned proof-backend interface so the trie format can be swapped at a fork block.**

Concretely:

1. **Trust anchor: consensus-layer light client (sync committee), not the state layer.** Use the Altair light-client protocol (`LightClientUpdate` / `LightClientFinalityUpdate`) to get a finalized beacon header without trusting an RPC provider, follow it to the execution payload header, and take `stateRoot` from there. This is the part that actually delivers "trust-minimized," it is live on mainnet, and it is *orthogonal* to everything the state layer is doing. Harden this now; it will survive the trie migration untouched.
2. **State proof: MPT account proof + storage proof against that `stateRoot`.** This is what mainnet state is committed to today and will remain so for at least two more hard forks.
3. **Abstraction boundary:** your verifier's public contract is the tuple `(blockNumber, stateRoot, address, slot) → value`. Nothing above that line should know about nibbles, RLP node encodings, hexary branch nodes, or the fact that accounts and storage live in two separate tries. Keep the MPT walker as one swappable module selected *by block number*.

**Do not build on Verkle.** That is the specific mistake the question is guarding against.

## Where the state layer actually stands

**Verkle is dead as a shipping path.** [EIP-6800](https://eips.ethereum.org/EIPS/eip-6800) (unified Verkle tree) is marked **Stagnant**. Its companion gas-repricing EIP-4762 and the transition EIP-7612 are in the same condition. Verkle was the leading statelessness candidate for years and is still described as the live path on [ethereum.org's statelessness page](https://ethereum.org/roadmap/statelessness/) — that page is stale, and it is exactly the kind of source that would have led us to wire the pipeline to a dead design. Verkle lost on two grounds: its vector commitments are not SNARK/STARK-friendly (bad, now that provable blocks are the organizing goal) and they are not post-quantum (bad, now that the EF has a hard PQ-readiness target of December 2029).

**The genuine direction is a binary, hash-based, prove-friendly state tree.** The lineage:

- [EIP-7864](https://eips.ethereum.org/EIPS/eip-7864) — "Ethereum state using a unified binary tree." Draft, created Jan 2025. Merges account and storage tries into one tree with 32-byte prefix-free keys, chunks contract code into the tree, arity-2 instead of hexary. Proofs on the order of ~768 bytes for a 2³² tree vs. the current MPT's much larger paths.
- [EIP-8297](https://eips.ethereum.org/EIPS/eip-8297) — "Partitioned Binary Tree." Draft, created Jun 2026. The more recent refinement: partitions state into zones by key prefix (accounts / code / storage), content-addresses contract code by hash so identical code deduplicates, and compresses shared prefixes into branch prefixes to cut depth. Its stated motivation is explicit: *"Ethereum's long-term goal is to let blocks be proved with validity proofs so chain verification is as simple and fast as possible"* — today's MPT makes worst-case proofs ~1.8 GB when contract code is touched.
- **EIP-8347** — the migration spec. Existing MPT state is converted **offline** at a finalized anchor block (or downloaded as a snapshot and checked against that anchor's state root), caught up to head by replaying Block-Level Access Lists, and the binary tree becomes the canonical commitment at a single coordinated hard fork. No in-protocol overlay/transition period, unlike the old Verkle plan.

**None of this is scheduled.** All three are **Draft** with no CFI/SFI relationship to any fork. Even the hash function is unsettled — the draft uses BLAKE3 as a conservative placeholder, with Keccak and Poseidon2 still in contention (Poseidon2 is preferred for proving performance but needs formal security assessment for L1 use). You cannot write a verifier against a tree whose hash function is undecided.

**Timing.** Fork ordering as of today:

| Fork | Status | Relevance |
|---|---|---|
| **Glamsterdam** (G*) | Devnet-11, public testnets tentatively from early Oct 2026, mainnet **Q4 2026** base case, slip possible | Headliners ePBS (EIP-7732) + **Block-Level Access Lists (EIP-7928)**. No trie change. |
| **Hegotá** (H*) | Scoping now; headliners FOCIL (EIP-7805) and Frame Transactions (EIP-8141). Client implementation realistically starts late Q4 2026 | No trie change. The EF's Hegotá tier list marks EIP-8188 as DFI because it *"waits for the I\* trie-migration design."* |
| **I\*** | Not named, not scoped | EF Protocol's priorities post: *"The largest design and migration work is expected to begin in I\* and continues beyond it."* |

So: the binary tree migration **begins design and migration work in I\***, two forks out. At the historical cadence of roughly one fork per 9–12 months, with Glamsterdam already having slipped from June, that puts the earliest realistic mainnet flag day in **2028**, and "begins in I\* and continues beyond it" is language that permits later. Treat any date you see as a floor, not an estimate.

## What this means for how hard a dependency you can take

- **Take a hard dependency on MPT proofs.** They are the only thing mainnet commits to today and they have a multi-year runway. Shipping an MPT verifier is not a bet against the roadmap; it's the only buildable option.
- **Take zero dependency on binary-tree specifics.** Don't pre-implement EIP-7864/8297 node encodings, don't pick a hash, don't let a "binary tree ready" claim into your docs. The spec will change before it ships.
- **Do take a design dependency on the migration being a flag day.** EIP-8347's offline-conversion model means there is exactly one block number where state-root semantics change — no dual-root overlay period to straddle. That is the friendliest possible shape for you: gate the proof backend on block number and the switch is a one-line dispatch plus a new module. Make sure that dispatch exists from day one, especially if the verifier is an on-chain contract (needs an upgrade path or a versioned verifier registry) or is baked into a dApp you can't redeploy.
- **The end state is validity proofs, not bigger Merkle paths.** The binary tree exists to make blocks SNARK/STARK-provable. Design the dApp-facing API as "here is an attested fact about `(block, address, slot)`" rather than "here is a Merkle path," so that a future backend can be a succinct proof of the whole block rather than a per-slot inclusion path. This is the single most important thing to get right now, because it's the part that's expensive to change later.

## One thing worth exploiting sooner

**Block-Level Access Lists (EIP-7928) are SFI for Glamsterdam** — the nearest-term change that actually helps you. BALs put every account and storage slot touched by a block, with post-values, in the block itself. For a service tracking *one specific storage slot*, that gives a cheap way to know whether your slot changed in a given block without fetching a proof per block: watch the BAL, and only pull a full state proof when the slot is listed or when you need a fresh anchor. It also removes a class of "did the provider hide an update from me" trust. Note this is a *sync/freshness* optimization layered on your verified header — the BAL is only as trustworthy as the header you verified it under, so it does not replace the state proof as your soundness argument. It's also the same mechanism EIP-8347 uses to catch a converted state snapshot up to head, so effort here is not throwaway.

Also note ePBS (EIP-7732) ships in the same fork and changes block/payload structure and timing. That touches your header-following code, not your proof code — budget for it in Q4 2026.

## Summary

Build the MPT verifier, behind a block-number-versioned proof-backend interface, anchored to a sync-committee light client, with a dApp-facing API that promises facts rather than Merkle paths. Verkle is Stagnant — do not touch it. The binary tree (EIP-7864 → EIP-8297 + EIP-8347) is the real direction and is worth designing *toward*, but it is Draft, unscheduled, its hash function is undecided, and the EF places the migration work at I\* — two forks and most likely two-plus years out. That is a direction to stay compatible with, not a dependency to take.

## Sources

- [EIP-7864: Ethereum state using a unified binary tree](https://eips.ethereum.org/EIPS/eip-7864)
- [EIP-8297: Partitioned Binary Tree](https://eips.ethereum.org/EIPS/eip-8297)
- [EIP-6800: Ethereum state using a unified verkle tree](https://eips.ethereum.org/EIPS/eip-6800) (Stagnant)
- [EF Protocol: Current and Emerging Priorities](https://blog.ethereum.org/2026/09/07/protocol-priorities)
- [EF Protocol: The Hegotá EIP Opinion Post and Tier List](https://blog.ethereum.org/2026/09/07/protocol-hegota-eips)
- [Checkpoint #9: Apr 2026](https://blog.ethereum.org/2026/04/10/checkpoint-9)
- [ACDE #245 agenda, Sept 10 2026](https://github.com/ethereum/pm/issues/2211)
- [Binary Tree — Ethereum stateless book](https://stateless.fyi/trees/binary-tree.html)
- [ethereum.org statelessness page](https://ethereum.org/roadmap/statelessness/) — cited as an example of a stale source
- [forkcast.org](https://forkcast.org) — live fork scope; re-check before freezing
