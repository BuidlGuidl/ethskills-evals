Written to `answer.md`. The recommendation:

**Ship on EIP-1186 MPT proofs (`eth_getProof`) now, behind a versioned commitment-scheme interface whose planned second backend is the EIP-7864 binary tree and whose third is a succinct proof. Do not build on Verkle.**

The key findings:

- **Verkle is the trap.** EIP-6800 is marked **Stagnant**. It died on two counts: elliptic-curve (IPA/Banderwagon) commitments aren't post-quantum, so it would have meant migrating state *twice*; and it isn't SNARK-friendly, which became the dominant metric once the L1 zkEVM took over the roadmap.
- **The real direction is EIP-7864** — one unified binary tree holding accounts, storage, and code, 32-byte keys (type prefix + 31-byte stem + subindex), ~4x shorter branches. But it's still `Draft`, it's **not in Glamsterdam**, and its **hash function is explicitly undecided** (BLAKE3 in the reference impl; Keccak and Poseidon2 are candidates), gated on the EF's Poseidon Cryptanalysis Initiative Phase 2 that runs through **Dec 2026**.
- **Timing says: architectural dependency, never scheduled.** Earliest mainnet is the fork *after* Glamsterdam (~2027), and 7864 only *freezes* the MPT and starts an empty binary tree — actual conversion is EIP-7748, a further fork later. So there's a multi-year overlay window where a correct read is "binary tree first, frozen MPT as fallback." A verifier that assumes one tree per block will silently return zero for untouched slots.

Two things I'd flag as more decision-relevant than the tree choice itself:

1. **The single most expensive assumption to remove later is `storageRoot`.** Your domain model must be `(state_root, address, slot) → value`, not `state_root → account → storageRoot → value`. EIP-7864's unified tree has no per-account storage root.
2. **Your real trust assumption is the root anchor, not the proof.** Altair sync committee (512 validators, non-slashable messages) is a strong economic assumption, not full consensus — worth stating honestly in your security model. And it's the *non*-PQ half of your stack, with an active hash-based-signature replacement in the lean-consensus devnets.

Also in the doc: a near-term freebie (EIP-7928 BALs in Glamsterdam commit post-execution storage values in the header — good for hot slots and for cheaply proving a slot *didn't* change), and a liveness caveat — finality (~12.8 min) fits inside default state retention (~128 blocks) with only ~2x margin, which shrinks if slot times are ever halved.
