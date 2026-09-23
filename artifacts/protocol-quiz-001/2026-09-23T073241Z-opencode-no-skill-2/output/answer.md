# Recommendation: which state-proof format to build around

## Short answer

**Build your verifier against Merkle Patricia Trie (MPT) proofs today — the `eth_getProof`-style account + storage-slot proof verified against a state root you obtain trust-minimized from the consensus layer (sync committee / beacon light client) — and put the proof format behind a narrow abstraction so the witness type can be swapped.**

Do **not** hard-commit your pipeline to Verkle proofs (EIP-6800). Verkle was the stated direction of Ethereum's state layer for years ("The Verge"), but as of 2026 the protocol has genuinely pivoted away from it toward a **hash-based binary state tree** (EIP-7864, now being concretized as the "Partitioned Binary Tree," EIP-8297). The only proof format that is verifiable against mainnet state *right now* — and that will remain verifiable for all historical state — is the MPT proof. The future format is a binary Merkle proof (possibly SNARK-wrapped), not a Verkle polynomial-commitment proof.

## Where Ethereum's state layer actually stands (September 2026)

**In production today:** All mainnet state lives in the hexary Keccak Merkle Patricia Trie. A storage-slot proof is a two-level MPT proof (account proof against `stateRoot`, then storage proof against the account's `storageRoot`), exactly what `eth_getProof` returns. This is the only state-proof format any live network produces, and it is what every trust-minimized light client that verifies L1 state (Helios-style consensus light client + MPT proofs) uses. MPT's known weakness — witnesses too large for stateless validation (~3.5 MB per 1,000 leaves vs. ~150 kB for Verkle) — is a problem for *protocol-level statelessness*, not for your use case, where a single-slot proof is a few KB.

**Where it was going:** For ~4 years the plan was Verkle trees (EIP-6800, with overlay tree EIP-7612 and conversion EIP-7748): replace MPT with a KZG/polynomial-commitment tree to shrink witnesses ~23x and enable stateless clients. Devnets (Kaustinen, Verkle Gen) ran for years, but Verkle never made it into a shipped fork's final scope.

**Where it is genuinely going now:** Two forces moved the protocol off Verkle in 2025–2026:

1. **Post-quantum pressure.** Verkle relies on elliptic-curve commitments (KZG/IPA), which are not post-quantum. The EF now has a dedicated PQ team and a "Lean Ethereum" roadmap targeting PQ readiness by ~2029; NIST guidance is to move off ECC by 2030. Shipping Verkle would guarantee at least one more full state-tree migration later, which core devs explicitly want to avoid.
2. **SNARK progress.** Proving systems got fast enough that a plain hash-based binary Merkle tree with a SNARK-friendly hash can deliver acceptable witness/proof characteristics — especially combined with the push toward SNARK-ified L1 execution (execution proofs, e.g. EIP-8025-style optional execution proofs).

The result: **EIP-7864 ("Ethereum state using a unified binary tree")** — a single binary tree (no separate account/storage tries, no RLP, code chunked into the tree, 31-byte stems + 1-byte suffix grouping 256 values) — became the reference design, and it has since been refined into **EIP-8297, the Partitioned Binary Tree (PBT)**, which is the current state-migration target. Per the EF's September 2026 state-roadmap discussion, the PBT migration is expected in **fork I\*** (the fork after Hegotá), via an offline migration (EIP-8347) that converts state at a finalized anchor and replays Block Access Lists (EIP-7928, shipped in Glamsterdam) until the new tree catches up.

## Timing flags — how hard a dependency you can take

- **The migration is not in the next fork.** Hegotá's locked scope is FOCIL (EIP-7805) + Frame Transactions (EIP-8141); the trie migration is explicitly deferred to I\*. Realistically that means **2027 at the earliest**, and the EF itself calls the fork cadence through 2029 "quite aggressive." Plan on MPT being the live state format for at least the next 12–18 months, probably longer.
- **The target spec is not frozen.** EIP-8297/7864 are drafts. The hash function is explicitly TBD (BLAKE3 in current drafts; Poseidon2 if it clears the EF's ongoing security assessment; Keccak as fallback). Proof serialization, stem layout, and migration mechanics can all still change. A verifier hard-coded to today's binary-tree draft is a verifier you will rewrite.
- **Verkle specifically is a dead end for new dependencies.** Whatever the final tree looks like, it will be hash-based and binary, not polynomial-commitment-based. Don't wire KZG/IPA verification into your stack.
- **The transition itself is a hazard window.** Migration designs (frozen MPT + overlay, or offline PBT conversion) mean that during a multi-month transition, proofs may need to span two trees, and in-EVM/off-chain proofs of *historical* state break or change meaning at the boundary. If your service verifies state "as of a recent block," you must handle proofs against both pre- and post-migration roots during that window.
- **The longer arc is execution proofs, not merkle proofs.** Once real-time zkEVM/execution proofs land (the "Lean Execution" direction), the trust-minimized way to verify a piece of L1 state may be "verify a validity proof of the block that touched it" rather than "verify a Merkle branch." That's further out than the tree migration, but it's another reason to keep your proof layer pluggable rather than married to any one witness format.

## What this means concretely for your design

1. **Ship on MPT proofs now.** Verify the account proof and storage proof against `stateRoot` from an execution header, and anchor that header in consensus via the sync committee (beacon light client) so you're not trusting the RPC that served the proof. This is fully trust-minimized, works today, and is the only option that works today.
2. **Hide the proof format behind an interface.** Something like `verify(state_root, key) -> value`, with MPT as the first implementation. Keep proof parsing, hashing, and root-anchoring in separate modules.
3. **Track EIP-8297 (PBT) as the successor implementation**, not EIP-6800. When the binary tree lands, your swap is: new key-derivation (stem/suffix layout), new hash function, shallower binary-branch verification — same verifier skeleton. The good news: a binary Merkle proof is *simpler* than MPT (no RLP, no extension/nibble encoding, no two-level trie), so the migration direction reduces your verifier's complexity.
4. **Do not take a schedule dependency on I\*.** Treat the binary-tree migration as "coming, format not final, date not committed." If your product roadmap needs a proof format guarantee more than ~12 months out, the only safe guarantee is MPT-for-history plus an abstraction for whatever ships next.

**Bottom line:** Ethereum's state layer is heading to a hash-based binary tree (EIP-7864 → EIP-8297 PBT), having moved away from Verkle for post-quantum and SNARK-friendliness reasons — but that migration is a 2027-or-later event with an unfrozen spec. Build on MPT proofs (the only live, and permanently historically-valid, format), behind an abstraction sized for a binary-Merkle successor, and do not take a hard dependency on Verkle or on the migration timeline.
