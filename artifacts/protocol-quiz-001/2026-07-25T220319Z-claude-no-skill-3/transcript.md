Written to `answer.md`. The recommendation:

**Build on today's MPT proofs (EIP-1186 `eth_getProof`), behind a fork-versioned interface whose next implementation targets EIP-7864's binary tree. Write zero Verkle code.**

**Where things stand.** Mainnet state is still the hexary Keccak MPT, and nothing in the scheduled fork sequence changes that: Fusaka (live Dec 2025) was PeerDAS; Glamsterdam (H2 2026) is ePBS + block-level access lists; Hegotá (late 2026/early 2027) is FOCIL + account abstraction. The MPT is your production format for every block you'll see for years.

**Where it's genuinely going.** Verkle is dead, not paused — EIP-6800 is *Stagnant*, and the live proposal is EIP-7864, a unified binary tree merging accounts/code/storage with ~4× shorter branches. The switch was driven by post-quantum concerns (Verkle rests on elliptic curves; a binary tree rests only on a hash) and by proving systems improving enough that in-circuit hashing became viable. One trap flagged in the doc: `ethereum.org/roadmap/verkle-trees/` is stale and still reads as though Verkle is on track — don't let anyone validate the decision against it.

**Timing — soft dependency only.** EIP-7864's *hash function isn't chosen yet* (BLAKE3 placeholder; Poseidon2 gated on the EF cryptanalysis initiative, Phase 2 concluding Dec 2026). Not scheduled for either of the next two forks; EF's own Feb 2026 priorities put binary trees in the "long term" bucket. Earliest plausible mainnet is 2027, arriving behind a months-long dual-tree conversion window, not a flag day. Rule of thumb in the doc: don't ship a binary verifier until the hash is final and it's SFI'd in a named fork.

**The thing that will break you first isn't the state tree.** Glamsterdam's ePBS removes `ExecutionPayload` from `BeaconBlockBody`, which moves the SSZ generalized indices you walk to reach the execution `stateRoot` and introduces payload-withheld slots. That's H2 2026 and mandatory. I flagged it as verify-against-`consensus-specs` rather than the EIP, since light-client details live there and were still moving through devnets in June 2026.

Design guidance included: take the abstraction at `(address, slot)` not at a pre-hashed key (MPT secure-trie hashing and EIP-7864's `tree_key` are fundamentally different), parameterize the hash function, and version proof bytes from day one if dApps will hold them as durable attestations.
