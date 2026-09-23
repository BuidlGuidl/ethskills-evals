# Recommendation: build around Merkle Patricia Trie (MPT) proofs, behind a pluggable proof-format abstraction

**Bottom line:** Build your verifier around Ethereum's *current* state-proof format — the hexary Merkle Patricia Trie (Keccak) proofs served by `eth_getProof`, verified against the `stateRoot` of a block header that you authenticate via the consensus-layer light-client protocol (sync committee). Do **not** build around Verkle trees, and do **not** take a hard dependency on the binary-tree design either. Both are unscheduled; the binary-tree direction is real but its concrete format is still unsettled. Abstract your proof interface so the future tree migration is a swappable component, not a rewrite.

## Where the state layer actually stands (checked against live sources, Sept 2026)

**Live today, and for the next two forks: MPT.** The canonical L1 state tree is still the Keccak-based Merkle Patricia Trie. Neither of the two upcoming upgrades changes that:

- **Glamsterdam** (SFI — scheduled; forkcast projected activation 2026-12-02, an estimate, not an announced date): headliners are ePBS (EIP-7732) and Block-Level Access Lists (EIP-7928). No state-tree EIP is scheduled or even considered.
- **Hegotá** (planning; projected 2027-06-16, also an estimate): headliners are FOCIL (EIP-7805) and Frame Transactions (EIP-8141). Again, no state-tree change is in scope.

So the MPT is guaranteed to remain the state commitment format at least through Hegotá — i.e., realistically through ~2027 at minimum, even if everything after that goes perfectly for the tree-transition camp.

**Verkle is dead as a shipping direction.** EIP-6800 ("Ethereum state using a unified verkle tree") and its companion transition EIPs (7612, 7545, 7748) are marked **Stagnant** in the EIP repo with **no fork relationship** — not CFI, not proposed, for any fork. The research community has moved away from Verkle, largely because its polynomial-commitment (elliptic-curve) basis is not post-quantum friendly and the protocol's priorities shifted toward ZK-provable state. Wiring a new proof pipeline to Verkle today would be wiring it to an abandoned design.

**The genuine direction is a binary tree — but it's a Draft with no schedule and an unsettled hash function.** The successor proposals are EIP-7864 ("unified binary tree") and EIP-8297 ("partitioned binary tree", the currently favored structural design in core-devs discussion, e.g. the "PBT migration" referenced at ACDE #244 in Aug 2026). Both are **Draft** status with **no fork relationship** — they are not CFI for Hegotá or any named fork. Critically for you, even the *hash function* of this future tree is undecided: the post-quantum/ZK track was exploring Poseidon, but recent Post-Quantum Transaction Signature breakouts (Sept 2026) record the direction moving **away from Poseidon toward Blake/SHA** via binary-field proving systems ("Flock"). A design whose hash function is still being swapped is not a design you can commit a verifier to.

**The stateless work that *is* shipping runs on top of the MPT.** The actively progressing stateless track — execution witnesses, the optional-execution-proofs EIP-8025 (Proposed for Hegotá), the L1-zkEVM breakout's execution-witness spec/test releases (now at v0.8x with Hive compliance dashboards across clients) — all produce witnesses *over the existing MPT*. One caveat: the witness wire format (`debug_executionWitness`) is still divergent across clients (Geth vs Reth/Nethermind/Erigon) and not yet standardized in execution-apis, so if you consume execution witnesses, pin a specific client implementation rather than assuming a stable cross-client format.

## What this means for your design

1. **Verify MPT proofs against a header you don't have to trust an RPC for.** Use `eth_getProof`-style account + storage proofs (a list of RLP-encoded trie nodes) and walk them up to the block's `stateRoot`. Authenticate the header via the beacon chain's light-client sync-committee protocol (Altair light-client updates, live since 2022) rather than trusting a provider's header. This is fully buildable with today's deployed mainnet infrastructure and will keep working through at least Glamsterdam and Hegotá.

2. **Keep reorg/recency handling in mind.** "Recent block" proofs need a finalized or k-deep header from the light-client chain; prove against finalized roots to avoid serving proofs for orphaned blocks.

3. **Put the proof format behind an interface.** Define an internal abstraction like `StateProof { prove(root, key) -> path; verify(root, key, value, path) -> bool }` with the MPT implementation as the only backend today. When (if) the binary-tree transition lands, you add a second backend keyed by fork. The tree transition will be a flag-day hard fork with a different proof shape, so your service must be able to serve both anyway during any migration window.

4. **Do not pre-build for binary trees.** No fork relationship, Draft status, undecided hash function — per Ethereum governance reality, nothing here is committed, and there is no announced date to plan against. Treat it as a monitoring item (watch forkcast for EIP-7864/8297 gaining a CFI status) rather than a dependency. If it never ships, your design is unaffected; if it ships, you adapt one module.

5. **Optionally, track execution witnesses (EIP-8025 et al.) as a future optimization**, not a foundation. If optional execution proofs ship (Proposed for Hegotá, not yet Scheduled), zk-verified state could eventually compress your trust assumptions further — but that is also unscheduled, so treat it the same way: monitor, don't depend.

## Sources checked

- forkcast.org `/api/eips.json`: EIP-6800 **Stagnant**, no fork relationships; EIP-7864 and EIP-8297 **Draft**, no fork relationships; EIP-8025 Proposed for Hegotá.
- forkcast.org `/api/upgrades.json`: Glamsterdam Upcoming (projected 2026-12-02, estimate), Hegotá Planning (projected 2027-06-16, estimate).
- forkcast EIP fork relationships: Glamsterdam and Hegotá scheduled/considered EIP lists contain no state-tree EIP.
- forkcast call summaries (`/search-light.json`): ACDE #244 (PBT as migration context), PQTS Breakout #14 (Poseidon dropped in favor of Blake/SHA — hash unsettled), L1-zkEVM breakouts #1–8 (execution-witness spec progress over MPT), RPC Standards #26–34 (execution-witness wire format not standardized).
