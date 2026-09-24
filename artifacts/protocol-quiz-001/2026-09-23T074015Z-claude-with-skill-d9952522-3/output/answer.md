# State-proof format for a trust-minimized L1 light client

**Date of research: 2026-09-23.** All status claims below were checked against live sources
(listed at the end), not from memory.

## Recommendation in one line

**Build the verifier on today's live format — Merkle-Patricia Trie (MPT) proofs from
`eth_getProof`, verified against an execution `stateRoot` that you anchor via the consensus
sync committee — but put it behind a narrow `StateProofBackend` interface from day one, with
the binary tree (EIP-7864) as the planned second implementation.**

Do **not** wire your pipeline directly to a binary-tree witness format, and do not build
anything on Verkle. The binary tree is genuinely where Ethereum's state layer is going, but it
has *no fork relationship at all* right now, and the abstraction you need in order to adopt it
later is the *same* abstraction the migration itself will force on you.

## Where the state layer actually stands today

**Live on mainnet, and the only thing you can actually verify against right now:**

- Hexary Merkle-Patricia Trie, Keccak-256, RLP-encoded nodes. This is the state commitment in
  every mainnet block header today.
- `eth_getProof` returns account + storage MPT branches. Your verifier checks them against
  `stateRoot`.
- Altair sync committees (512 validators, rotating ~27h) let you verify a recent beacon header
  without trusting an RPC provider, then walk beacon header → execution payload header →
  `stateRoot`. This is exactly the chain of custody Helios uses, and it is the part of your
  design that satisfies "trust-minimized" — it is live, stable, and independent of which tree
  the state uses.

**Not live, and not the next fork either:**

- **Glamsterdam** has not shipped as of 2026-09-23. Mainnet activation is currently targeted at
  **2026-11-04**, with Sepolia/Hoodi testnet forks still ahead of it. Its scope is 25 EIPs SFI,
  headlined by **EIP-7732 (ePBS)** and **EIP-7928 (Block-Level Access Lists)**. **No state tree
  change is in Glamsterdam.** BALs are worth knowing about — they surface per-block state
  access up front — but they are not a state proof and do not replace `eth_getProof`.
- **Hegotá** is in scoping, target **2027-05-19**. Headliners are **EIP-7805 (FOCIL)** and
  **EIP-8141 (Frame Transactions)**. Scope today is roughly 35 PFI / 1 CFI / 2 SFI / 17 DFI.
  **EIP-7864 is not among the Hegotá proposals** — it is not PFI, not CFI, not SFI.

## Where it is genuinely going

**Verkle trees are dead. Do not build on them.**

- **EIP-6800 (unified Verkle tree) is `Stagnant`** — no active development. It has no fork
  relationship.
- The direction was abandoned for two reasons that have not reversed: pairing-based vector
  commitments are not post-quantum, and SNARK proving over simple binary Merkle structures
  matured enough to win on proving cost. Note that `ethereum.org/roadmap/verkle-trees` still
  reads as though Verkle is on track — **that page is stale and should not be used as a status
  source.** Forkcast and the EIP status headers are authoritative.

**The binary tree is the real direction — as a research/design arc, not a scheduled change.**

- **EIP-7864 (Ethereum state using a unified binary tree)** is the live proposal: one binary
  tree merging account headers, code, and storage into a uniform 32-byte key/value layout
  (`[storage_type | tree_position | sub_index]`), no RLP. Witnesses are roughly 4× shorter than
  hexary MPT branches (~768 bytes vs ~2,880 for a 2^24-element tree), which is a direct,
  material win for exactly your use case.
- **Status: `Draft`, created 2025-01-20, no fork relationship.** It has a concrete spec and a
  dedicated team, which is why it's credible as a direction — but a spec with a team is not a
  scheduled change.
- **EIP-7748** is the companion state-conversion EIP: an *overlay* strategy where the new binary
  tree starts empty and takes all new writes while the frozen MPT is converted in the
  background. Also `Draft`, also no fork relationship.
- On timing, the most authoritative statement available is the EF Protocol cluster's priorities
  post (2026-09-07): the state arc — "migrating to a new trie, sustainable state growth, and
  decentralized access to current and historical state" — is a **P3 long-horizon research arc**,
  and **"the largest design and migration work is expected to begin in I* and continues beyond
  it."** `I*` is the still-unnamed fork *after* Hegotá. The Hegotá tier list corroborates this:
  EIP-8188 is explicitly parked because it "waits for the I* trie-migration design."

**Translation of that timing into planning terms:** design work starts in the fork after the one
targeted for May 2027. Activation is later than that, and the conversion period after activation
is measured in months. There is no defensible date. **Treat binary-tree state proofs as
something you will support, on an unknown schedule, not something you can plan a release
around.**

## Why this shape of design, concretely

Three things make the abstraction mandatory rather than merely tidy:

1. **The hash function is not settled.** EIP-7864 states plainly that "the hash function used in
   the current draft is not final" — BLAKE3 is the reference implementation, with Keccak and
   Poseidon2 still live candidates. If your verifier hardcodes a hash, you are betting on an
   open decision. Keep the hash a parameter of the backend.
2. **The overlay migration means both trees are live at once.** Under EIP-7748 there is an
   extended window where a given slot may be proven against the new binary tree (if written
   since the fork) *or* against the frozen MPT (if not yet converted). A verifier that can only
   speak one format is broken *during the transition*, not just before it. So you need
   dual-format support regardless — the abstraction is the migration path, not optional polish.
3. **The trust-minimization layer is orthogonal and stable.** Sync-committee → beacon header →
   payload header → `stateRoot` does not change when the tree changes. Only the last hop
   (`stateRoot` → slot value) does. Draw your module boundary exactly there and the tree change
   touches one component.

### Concrete interface boundary

```
verify_slot(anchor: VerifiedExecutionHeader, address, slot, proof: Witness) -> Option<U256>
```

Everything above this line (checkpoint sync, sync-committee signature verification, header
chain, `stateRoot` extraction) is tree-agnostic and is what you should be investing in now.
Below the line, ship `MptBackend` today; add `BinaryTreeBackend` when EIP-7864 reaches SFI in a
named fork and its hash function is final. Make `Witness` an enum with an explicit format tag
rather than a bare byte blob, so a mixed-format overlay period is representable in your types
from the start.

## What to avoid

- **Don't ship a zk-proof-of-state-transition dependency yet.** EIP-8025 (Optional Execution
  Proofs) is `Draft`, created 2025-09-17, A-tier in the Hegotá opinion post — promising, and
  explicitly opt-in ("does not change consensus validity rules"). But opt-in means *no
  guarantee anyone is producing proofs you can consume*. Watch it; don't depend on it.
- **Don't assume archive access stays free.** Your "recent block" framing is right and you
  should hold it. History expiry pressure means proofs against old blocks get harder to source
  independent of any tree change. Keep your proof window short and explicit.
- **Don't treat `eth_getProof` as guaranteed.** It's a de-facto standard, not a consensus
  requirement, and not every provider exposes it. Source from at least two providers; your
  verification makes them untrusted, but availability still matters.

## Re-check triggers

The plan above stays valid whether or not EIP-7864 ships. Re-evaluate when any of these occur:

- EIP-7864 gets a fork relationship on forkcast.org (PFI → CFI → SFI) — CFI on a named fork is
  the earliest point at which prototyping the backend is justified; **SFI plus a final hash
  function** is the point to build it for real.
- The EIP-7864 hash function is finalized.
- The `I*` fork gets a name and a scope.
- EIP-7748's conversion parameters (duration, per-block conversion rate) land — those set how
  long your dual-format window must be supported.

## Sources checked (2026-09-23)

- [forkcast.org](https://forkcast.org) — fork scope tracker (client-rendered; scope figures via
  [eipsinsight.com/upgrade/schedule](https://eipsinsight.com/upgrade/schedule))
- [EIP-7864 (binary tree)](https://eips.ethereum.org/EIPS/eip-7864) — `Draft`, no fork relationship
- [EIP-6800 (Verkle)](https://eips.ethereum.org/EIPS/eip-6800) — `Stagnant`
- [EIP-7748 (state conversion)](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-7748.md) — `Draft`
- [EIP-8025 (Optional Execution Proofs)](https://eips.ethereum.org/EIPS/eip-8025) — `Draft`
- [EF Protocol: Current and Emerging Priorities (2026-09-07)](https://blog.ethereum.org/2026/09/07/protocol-priorities) — state arc / `I*`
- [EF Protocol: The Hegotá EIP Opinion Post and Tier List (2026-09-07)](https://blog.ethereum.org/2026/09/07/protocol-hegota-eips)
- [Hegotá Upgrade EIP Proposal Timelines](https://blog.ethereum.org/2025/12/22/hegota-timeline)
- [Binary Tree — Ethereum stateless book](https://stateless.fyi/trees/binary-tree.html) — Verkle → binary rationale
- [ethereum.org/roadmap/verkle-trees](https://ethereum.org/roadmap/verkle-trees) — **stale, contradicted by EIP-6800's status**
