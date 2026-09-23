# Recommendation: build around MPT proofs today, commit to the hash-based binary tree (EIP-8297 PBT) as the target — and do **not** build on Verkle

## TL;DR

1. **Ship now on Merkle-Patricia Trie (MPT) proofs** (Keccak, RLP, `eth_getProof`-style account + storage witnesses), anchored to a state root you get from a consensus-layer light client. This is the *only* format that is live on mainnet today, and it stays valid until the binary-tree activation fork — which is not yet scheduled.
2. **Design your verifier's proof backend as a swappable commitment scheme whose target is the Partitioned Binary Tree (PBT), EIP-8297** — the successor to EIP-7864's unified binary tree — with migration to it specified in EIP-8347. This is the direction Ethereum's state layer is genuinely heading.
3. **Do not take a hard dependency on the PBT format today.** EIP-8297 and EIP-8347 are both **Draft**, the merkelization hash is explicitly **not final** (BLAKE3 in the reference implementation, with Poseidon2 and Keccak still candidates), and no mainnet fork date exists. Treat PBT as your committed target, not as a wireable production dependency yet.
4. **Explicitly rule out Verkle trees (EIP-6800).** Verkle is the design the protocol is moving *away* from. If any part of your pipeline was going to be wired to EIP-6800 witnesses, cut that now.

## Where Ethereum's state layer stands today (September 2026)

- Mainnet's `stateRoot` header field is still computed from the **hexary Keccak/RLP Merkle-Patricia Trie**. Nothing that has shipped or is shipping changes this: the next fork, **Glamsterdam** (Devnet 9 running, testnet forks floated for Sept 28, 2026), carries ePBS, parallel execution, gas-limit work, Block-Level Access Lists (EIP-7928) and history-expiry work — **not** a state-tree change.
- The only state-proof format you can verify against a real mainnet state root today is the **MPT witness**: an account-trie branch (giving you `storageRoot`, balance, nonce, codeHash) plus a storage-trie branch for the slot. This is what `eth_getProof` (EIP-1186) returns and what in-EVM bridges verify. Any trust-minimized design today (Helios-style CL light client for the header → header gives `stateRoot` → verify MPT witnesses against it from an *untrusted* RPC) is sound and live.
- Verkle trees are **not** the current direction, despite older roadmap pages. The 2024–2025 pivot, confirmed on the Stateless Implementers Calls ("Verkle trees have a low chance of being used"; future devnets "probably will be Binary"), was driven by two things: (a) Verkle's elliptic-curve stack is not post-quantum secure while a **hash-based** tree is, and NIST guidance points at retiring ECC by ~2030; and (b) SNARK/STARK proving performance improved fast enough that "binary Merkle tree + wrap witnesses in a STARK" matches Verkle's main advantage (small, fast proofs) without the new crypto stack. Geth's binary-tree PR literally renames the Verkle codebase to PBT. Verkle would also have forced a *second* tree conversion for quantum resistance; the binary tree is intended to be the final state tree.

## Where it is genuinely going

- **EIP-7864** (Jan 2025, "unified binary tree") was the first concrete proposal; it has been succeeded by **EIP-8297 "Partitioned Binary Tree"** (created June 2026, status **Draft**): a single hash-based binary tree replacing the "tree of trees", with RLP gone, contract code chunkified into the tree, account data co-located under shared key prefixes ("stems") to shrink branch openings, and code content-addressed so identical contracts share bytecode. Keys are variable-length and prefix-free; the first key byte partitions the tree into zones (account headers / code / storage) so a category can be synced, proven, or expired independently — the structure later state-expiry and partial-statelessness proposals build on.
- **EIP-8347** (created July 2026, status **Draft**) specifies the **migration**: the full MPT state at a finalized anchor block is converted *offline*, distributed as a byte-canonical verifiable snapshot, caught up to the chain tip by replaying Block-Level Access Lists (EIP-7928 over `eth/71`/EIP-8159), observed via a signed "shadow root" period, and made canonical at a **single coordinated EL+CL hard fork (`PBT_ACTIVATION_FORK`)** that is *not yet scheduled*. Crucially, this offline design was chosen over the EIP-7748/EIP-7612 overlay approach *specifically to avoid hybrid proof verifiers*: the header carries exactly one root at all times — MPT before the fork, PBT after.
- The endgame this enables is the "SNARKification of L1" / the Verge: PBT witnesses wrapped in STARK proofs, small enough to verify single-slot, hash-only and post-quantum. Expect production PBT state proofs to eventually arrive **pre-wrapped in a STARK/SNARK**, not as raw sibling paths — the eventual verification primitive is "verify a succinct proof against the header root", not "re-hash a witness".
- Post-Glamsterdam upgrade(s) ("Hagoda" and later) are where this would land. Nothing is scheduled.

## What this means for your dependency, specifically

**MPT is a safe dependency for at least the next ~1–2 years, and arguably longer:**

- `PBT_ACTIVATION_FORK` has no date; before it can even be scheduled, EIP-8297's hash function must be finalized and EIP-8347's anchor/shadow-root rehearsal has to run. Realistically mainnet activation is a **2027+** event.
- Even after activation, MPT proofs remain the correct format for any **pre-fork block**, and the EIP-8347 design means the switch is a clean, known-block-height cutover — you will need exactly **two** verifier backends (MPT, PBT), not a hybrid.

**PBT is the right target, but a soft dependency only, because:**

- Both EIPs are **Draft**. EIP-8297 says outright: *"the hash function used in this draft is not final... Do not assume BLAKE3 is a final decision."* The hash choice (BLAKE3 vs Poseidon2 vs Keccak) changes merkelization end-to-end — wiring circuit-level or byte-level assumptions now would be building on sand.
- Geth's implementation PR is marked "temporary, not for merge."
- The proof *encapsulation* is also unsettled: raw binary witnesses today, STARK-wrapped proofs on the roadmap, and there is standing interest in a state-proof verification precompile (EIP-7545 exists for general stateless-proof verification) rather than hand-rolled in-Solidity checks.

**Verkle is the one wrong answer:** it is the approach the protocol is abandoning, and building on EIP-6800 witnesses would mean wiring your pipeline to a format that will never produce a mainnet state root.

## Concrete plan

1. **Now (production):** CL light client (sync-committee-based, Helios-style) → authenticated `stateRoot` for a recent block → fetch MPT account + storage proofs from arbitrary untrusted RPCs → verify locally. Keep serving this until `PBT_ACTIVATION_FORK`, and keep it forever for pre-fork blocks.
2. **Abstraction:** define an internal interface roughly `verify(block, address, slot) -> value` with a pluggable `(commitment_root_type, witness_format, verifier)` tuple. The MPT and PBT backends should be two implementations of it; the switch at the activation fork should be a config/known-block rule, not a rewrite.
3. **PBT backend (prototype now, harden as spec solidifies):** implement against EIP-8297's reference tests / devnets (EthereumJS has an early binary-tree implementation; geth's is in review). Leave the hash function parameterized. Decide whether your product verifies raw PBT witnesses or, once available, STARK-wrapped proofs — prefer the latter if your verifier runs on-chain or in a browser.
4. **Watch list / upgrade triggers:**
   - EIP-8297 moving Draft → Review, and the **hash function decision** (this is the big one — treat it as the earliest safe point to harden a PBT backend).
   - EIP-8347 anchor-block selection and shadow-root period start (the dress rehearsal; a good time to have your PBT path running against a second source).
   - `PBT_ACTIVATION_FORK` being scheduled in a fork-meta EIP — this is your hard cutover date, and per EIP-8347 it will be a single known block.
   - Any state-proof precompile proposal (would let you replace in-contract verification entirely).
   - Glamsterdam/Hagoda scope decisions on ACDE — the state-tree change is not in Glamsterdam; watch what lands in Hagoda.

## One-line summary

Ethereum's state proofs are heading to a **hash-based, STARK-friendly binary tree (EIP-8297 PBT, migrated via EIP-8347)** — not Verkle, which is being abandoned. But nothing of it is live or scheduled yet, so ship on MPT proofs now, commit architecturally to the binary tree as the target, and keep the PBT dependency soft until the EIP's hash function and fork schedule are finalized.