# State-proof format for a trust-minimized L1 storage-slot light client

**Recommendation (short version):** build the verifier around **Merkle-Patricia-Trie
(MPT) proofs as specified by EIP-1186 / `eth_getProof`, verified against the
`stateRoot` of a header you authenticate yourself via the beacon-chain
sync-committee light-client protocol** — but put the trie/commitment logic behind a
narrow interface, because Ethereum's state layer is genuinely moving to the
**EIP-7864 unified binary tree**, and that migration will change key derivation,
proof shape, and the hash function.

**Do not build on Verkle trees.** Verkle is the design the protocol is moving away
from — it was removed from the roadmap. Wiring a proof pipeline to IPA/Banderwagon
polynomial commitments today is exactly the mistake you asked to avoid.

---

## 1. Where the state layer actually stands today (Sept 2026)

Mainnet state is still a **hexary, Keccak-hashed, RLP-encoded Merkle Patricia Trie**,
in the two-level "secure trie" arrangement it has had since Frontier:

- Account key = `keccak256(address)`, path through the world-state trie whose root is
  `stateRoot` in the execution payload header.
- The account leaf is `[nonce, balance, storageRoot, codeHash]`.
- Storage is a **separate trie per account**, keyed by `keccak256(slot)`, rooted at
  that account's `storageRoot`.

So a slot proof today is inherently **two chained proofs**: address → account leaf →
`storageRoot` → slot leaf. That is what `eth_getProof` returns (`accountProof` and
`storageProof` arrays), and it is what every existing verified-RPC client (Helios,
etc.) checks.

This is not a legacy path you're grudgingly adopting: it is the only format that
exists on mainnet, and it will remain the format for every block you can query for
at least the next year, probably longer (see §3).

## 2. Where it is genuinely going

### Verkle: dead, not delayed

Verkle trees (EIP-6800 unified Verkle tree, EIP-7612 overlay, EIP-7748 conversion)
were the plan through 2024. They were dropped. Two reasons drove it:

1. **Post-quantum.** Verkle's vector commitment is elliptic-curve based (IPA over
   Banderwagon). It is not post-quantum secure, and the EF's roadmap has since moved
   PQ readiness up to a first-class priority.
2. **Proving.** STARK proving got fast enough that a plain binary Merkle tree over a
   proof-friendly hash beats Verkle for the zkEVM/stateless use case, while being
   dramatically simpler and hash-only.

The Verkle devnets were wound down; Verkle is off the roadmap. Treat any Verkle-shaped
witness format as a dead end.

### The successor: EIP-7864, "Ethereum state using a unified binary tree"

This is the real direction. Authored by Buterin, Ballet, Feist and others (created
Jan 2025). What changes that matters to you:

- **One unified tree** for accounts *and* storage. The two-level
  account-trie-then-storage-trie structure goes away. A slot proof becomes a *single*
  Merkle branch, not a chained pair.
- **Binary, not hexary.** Branches are roughly 4× shorter than today's — a direct win
  for a bandwidth-sensitive light client.
- **Stem/suffix key layout.** Keys are 32 bytes: a 31-byte *stem* derived from
  `(address, tree_index)` plus a 1-byte suffix, so 256 related sub-keys (account
  metadata, and *adjacent storage slots*) share a stem. Proving several nearby slots
  of one contract collapses to near the cost of proving one.
- **Hash function is explicitly not decided.** The draft uses BLAKE3 "to reduce
  friction for EL clients experimenting"; the EIP says outright *do not assume BLAKE3
  is final*. Keccak and Poseidon2 are the other candidates, and the EF has pulled back
  from Poseidon for L1 on cryptanalysis/PQ-margin grounds, leaning toward a
  conventional hash (SHA/BLAKE family) and adapting the proof system to it instead.

**EIP-7864 is still Draft.** It is not in Glamsterdam, and it is not confirmed for
Hegotá.

### The other line: L1 zkEVM — relevant, but not your proof format

The L1-zkEVM 2026 roadmap (EIP-8025, optional execution proofs / zkAttesters) is real
and moving. Be clear about what it does and doesn't give you: it proves *block
validity* — that the state transition was executed correctly. It does **not** answer
"slot S of contract C equals V". You still need an inclusion proof against a state
commitment. Validity proofs may eventually cheapen how you follow the header chain;
they do not replace the witness format you're choosing now. Keep them out of the
critical path.

## 3. Timing — how hard a dependency you can safely take

This is the part that constrains the decision:

| Fork | Status | Relevance |
|---|---|---|
| **Glamsterdam** | Targeting mainnet ~Q4 2026 (slipped from H1 2026); headliners EIP-7732 ePBS + EIP-7928 BALs | **No state-tree change.** MPT proofs unaffected. |
| **Hegotá** | Being scoped right now; ~66 proposals competing, only FOCIL (EIP-7805) confirmed; targeting 2027 | EIP-7864 is a *candidate*, not a commitment. |

Even in the optimistic case where 7864 lands in Hegotá in 2027:

- **The switch is not a flag day.** Per the EIP, the binary tree *starts empty*; only
  new state changes go into it, and **the MPT continues to exist but frozen**. A
  separate later fork (EIP-7748-style, a fixed number of key-values converted per
  block) migrates the remainder. So there is a **months-long overlay period during
  which a given slot may live in either tree**, and a correct verifier must handle
  "absence proof in the binary tree + proof in the frozen MPT."
- **MPT verification never fully retires** for you anyway, because any historical
  state root you want to verify against predates the conversion.

Net: an MPT dependency is safe for years and permanently necessary for history. A
binary-tree dependency taken *today* is a dependency on an undecided hash function in
a Draft EIP with no fork assignment — prototype-only.

## 4. What to actually build

**Split the verifier into two layers with a hard boundary.**

**Layer A — header authentication (stable, build it properly now).**
Beacon-chain light-client protocol: weak-subjectivity checkpoint → sync-committee
signatures (512 validators, rotating ~27h) → `LightClientUpdate` /
`LightClientFinalityUpdate` → execution payload header → **`stateRoot`**. This is the
part that makes you trust-minimized; it is unaffected by everything in §2, and it is
where the actual security lives. Prefer finalized headers; expose optimistic heads as
explicitly weaker if you need lower latency.

**Layer B — state commitment proof (swappable).** One interface, roughly:

```
verify_state_proof(state_root, address, slot, witness) -> Option<U256>
```

Rules for keeping this survivable:

1. **Do not leak `{accountProof, storageProof}` into your public API or your storage
   format.** That two-array shape is an artifact of the two-level MPT and does not
   survive EIP-7864's unified tree. Take an opaque `witness` blob plus a format tag.
2. **Version every persisted proof** with `{format, hash_fn, block_number}`. Don't
   hardcode Keccak into the hashing layer — the binary tree's hash is undecided.
3. **Make absence a first-class result**, not an error. You need it for MPT
   non-existence proofs today and for overlay-period "not in the binary tree" lookups
   later.
4. **Plan for a dual-backend period**, not a switch. The migration design guarantees
   it.

**MPT verification pitfalls to get right now** (these are where real bugs live):
non-existence proofs (extension/branch terminating early), embedded nodes shorter
than 32 bytes that are inlined rather than hashed, the empty-storage-root sentinel
(`keccak256(rlp(""))`), empty-code hash, and hex-prefix/nibble encoding of leaf and
extension keys. Use a well-tested implementation rather than writing one.

**Operational note on "recent block":** non-archive nodes serve `eth_getProof` for
roughly the last 128 blocks. Pin every proof request to a specific block hash you have
already authenticated in Layer A, and cache the header alongside the proof — otherwise
a provider can quietly answer at a different block.

## 5. Optional near-term optimization: BALs (EIP-7928)

Glamsterdam adds `block_access_list_hash` to the header, committing to a Block-Level
Access List that includes **post-execution storage slot values for writes**. If your
dApp cares about slots that change often, this gives a second, cheap path to "value of
slot S after block N" without a trie walk.

Caveats: it only covers slots *touched* in that block, it's RLP-encoded (not SSZ, and
not a proof against the full state), and it cannot tell you a slot is *unchanged*
since some earlier block. **Treat it as an optimization on top of Layer B, never as
the foundation.**

---

## Summary

- **Build on:** EIP-1186 MPT proofs against a sync-committee-authenticated
  `stateRoot`. It's what mainnet has, it's what mainnet will have through 2027 at
  least, and it's permanently required for historical roots.
- **Design for:** EIP-7864 unified binary tree — single tree, binary branches ~4×
  shorter, 32-byte stem/suffix keys, hash function TBD. This is where the protocol is
  actually heading.
- **Avoid:** Verkle. Removed from the roadmap over post-quantum and proving-efficiency
  concerns; not coming back.
- **Timing:** no state-tree change in Glamsterdam (~Q4 2026). EIP-7864 is a Draft
  candidate for Hegotá (2027), not confirmed, with an undecided hash function and a
  frozen-MPT-plus-overlay migration that stretches across at least two forks. Take a
  **hard** dependency on MPT and only an **architectural** dependency on the binary
  tree.
