# Recommendation: which state-proof format to build around

**Short answer:** Ship your verifier on today's **hexary Merkle Patricia Trie (MPT) proofs** — the only format that verifies against live mainnet state roots — but architect your proof pipeline around a pluggable tree backend whose second target is a **unified binary hash tree** (the EIP-7864 → EIP-8297 design lineage). Do **not** build on Verkle trees: that is precisely the design the protocol has moved *away* from.

---

## Where Ethereum's state layer stands today (September 2026)

**Live on mainnet: hexary MPT.** The state root in every block header commits to the hexary (16-ary) Merkle Patricia Trie, Keccak-hashed, RLP-encoded, with separate account and storage tries. Storage-slot proofs are served by `eth_getProof` and verified against `stateRoot`. Nothing in the current fork schedule changes this:

- **Glamsterdam** (next upgrade, in devnets) has a frozen scope per its meta-EIP (EIP-7773): ePBS, block-level access lists, gas repricing, etc. **No state-tree change.**
- **Hegotá** (the following upgrade, targeting ~2027) has no state-tree EIP scheduled either.

So for at least the next ~12–18 months, MPT proofs are the *only* proofs that exist on mainnet.

**Verkle is dead as the state-tree target.** This is the trap. Years of roadmaps, blog posts, and ethereum.org pages say "Verkle is coming." The primary sources say otherwise:

- **EIP-6800** (unified Verkle tree) is marked **Stagnant** in the canonical EIPs repo — no activity for 6+ months. Its companion transition EIPs (7612 overlay, 7748 conversion) are likewise dormant.
- The reasons are documented in the newer proposals themselves: Verkle's Bandersnatch/elliptic-curve commitment stack is **not post-quantum** (NIST guidance calls for retiring ECC by 2030), and it is **hard to prove inside SNARK circuits** — a problem because Ethereum's long-term plan is to prove the whole EVM with validity proofs. Meanwhile prover performance for plain hash trees improved enough to erase Verkle's main advantage (proof size).
- You will find secondary sources (e.g., a May 2026 blog post claiming "Hegotá commits to Verkle") still asserting Verkle is scheduled. Treat these as stale/unreliable — they contradict the canonical EIP statuses. Always trust the EIPs repo and forkcast.org over blog posts.

**The live direction: a unified binary hash tree.** The same author group that drove Verkle (Vitalik, Guillaume Ballet, Dankrad, etc.) is now working on:

- **EIP-7864** (Jan 2025, Draft): *unified binary tree* — merges account/storage/code tries into a single key:value tree, arity 2 (minimal proof size), no RLP, code chunked into the tree, hash-function-based (post-quantum), explicitly described as "probably the final state tree used in the protocol."
- **EIP-8297** (June 2026, Draft): *partitioned binary tree* — the current iteration of the same design. Adds "zones" (first key byte labels account headers / code / storage), content-addressed code dedup, prefix-compressed branch nodes, and keeps the stem/subindex co-location concept (256-value stems; slots 0–63 live in the account header stem). Migration is specified separately in **EIP-8347** (offline conversion, activation at one coordinated hard fork).

Both are **Draft** status — not CFI, not SFI, not scoped for any fork.

## Why the binary-tree direction is the one to bet on (and Verkle isn't)

1. **Post-quantum**: hash-only construction, no elliptic curves. Ethereum will not migrate state twice; EIP-7864 explicitly says the binary tree is intended to be the *final* state tree, whereas Verkle would itself need replacement.
2. **SNARK-friendliness**: the endgame is validity-proving the whole EVM. MPT (RLP, Keccak, 16-ary, tree-of-trees) is the worst case for circuits; Verkle's curve arithmetic is awkward in-circuit; a binary hash tree with a proving-friendly hash is the deliberate sweet spot for both native and in-circuit verification.
3. **Smaller plain Merkle proofs too**: arity 2 minimizes branch size (`~32·log₂N` bytes vs. `~120·log₂N` for 16-ary), and the unified key space makes every piece of state provable under one root with one scheme — good for exactly your use case.
4. **The transition is explicitly breaking for proof verifiers**: EIP-8297 states post-fork state roots commit to the new tree and **MPT state proofs stop working**. Whatever ships eventually will not be Verkle-flavored; it will be this binary-tree lineage or a direct descendant.

## Timing: how hard a dependency can you safely take?

**You cannot take a hard dependency on the new format yet.** Concretely:

- EIP-8297 is a June 2026 **Draft**. The design is still moving (it already materially changed from EIP-7864: key layout, zones, content-addressed code).
- **The hash function is explicitly undecided** — candidates are BLAKE3 (reference implementation), Keccak, and Poseidon2 (security analysis ongoing via the EF cryptography initiative). Committing verifier code to any one of these today is a guess.
- No fork relationship: not CFI for Hegotá or anything after. Realistic mainnet activation is **2027 at the absolute earliest, plausibly later** — and state-tree migrations are among the riskiest changes Ethereum can make, so expect slippage.
- **MPT is a safe dependency for ~12–18+ months.** It is the consensus format today, survives Glamsterdam, and the tree swap (EIP-8347) is designed as a single coordinated hard fork with a finalized anchor block — you will have long, loud advance notice, not a surprise.

## What we recommend building

1. **Proof-format abstraction as the core architectural seam.** Your verifier should treat "resolve (address, slot) → tree key, then verify branch against root" as an interface with two backends:
   - **Backend 1 (ship now): MPT** — account proof + storage proof against `stateRoot` (the `eth_getProof` shape). This is what makes the product work on mainnet today.
   - **Backend 2 (track, don't ship): binary tree per EIP-8297's embedding** — zone byte + `key_hash`-derived stem + sub-index key derivation; compressed-branch binary proof verification. Write this against the EIP as a draft implementation behind the same interface, and expect to revise it as the EIP evolves.
2. **Bet on the durable concepts, not the constants.** Across 7864 → 8297, these survived: single unified key:value tree, arity 2, 32-byte values, 256-wide stem grouping, header co-location of the first 64 storage slots, chunked content-addressed code, hash-based (no ECC) merkelization. Design data structures around those; keep zone bytes, hash choice, and exact key derivation behind configuration.
3. **Do not write any Verkle code.** No Bandersnatch, no Pedersen/polynomial commitments. That stack is stagnant and the protocol's own authors have stated it would need replacing even if shipped.
4. **Watch the right signals.** Track forkcast.org for EIP-8297/8347 moving to CFI (that is the point where a hard dependency becomes defensible) and for the hash-function decision on the EthMagicians thread. Re-evaluate this commitment at each ACD cycle, and re-check EIP statuses — Stagnant/Draft/Final — against the EIPs repo rather than any roadmap diagram or blog post.
5. **Plan for the flag day.** When the binary-tree fork eventually lands, `stateRoot` semantics change in one block and MPT proofs against post-fork blocks become invalid. Your abstraction seam means that day is a backend swap plus re-anchoring on the fork block — not a rewrite of the product.

**Bottom line:** MPT proofs are the only correct target for anything shipping in the next year-plus; the binary hash tree (EIP-7864/EIP-8297 lineage) is the genuinely-committed long-term direction; Verkle is the design being abandoned. Build for the first, design for the second, ignore the third.

## Sources

- EIP-8297: Partitioned Binary Tree (Draft, June 2026) — eips.ethereum.org/EIPS/eip-8297
- EIP-8347: binary-tree migration/activation (referenced by EIP-8297)
- EIP-7864: Ethereum state using a unified binary tree (Draft, Jan 2025) — eips.ethereum.org/EIPS/eip-7864
- EIP-6800: Ethereum state using a unified Verkle tree (**Stagnant**) — eips.ethereum.org/EIPS/eip-6800
- EIP-7773: Glamsterdam meta-EIP (SFI list contains no state-tree change)
- Vitalik, "Possible futures of the Ethereum protocol, part 4: The Verge" (Oct 2024) — first public statement of the Verkle-vs-binary-tree decision point
- forkcast.org — upgrade/devnet tracker (checked Sept 2026)
