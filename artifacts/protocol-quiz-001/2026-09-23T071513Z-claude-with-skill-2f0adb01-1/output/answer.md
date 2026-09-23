# State-proof format for a trust-minimized L1 light client

**Date of this analysis: 2026-09-23.** Protocol status changes; re-check
[forkcast.org](https://forkcast.org) before acting on the timing claims below.

## Recommendation in one line

**Ship on the Merkle Patricia Trie (`eth_getProof` / EIP-1186-shaped account+storage
proofs verified against the header `stateRoot`), behind a proof-format abstraction
designed so an EIP-7864 unified *binary* Merkle tree backend can be dropped in later.
Do not build on Verkle.**

That is: MPT is what mainnet actually is and will remain for the whole horizon you can
plan against; the binary tree is where the state layer is genuinely going; Verkle is the
design the protocol moved *away* from, and is exactly the trap you asked to avoid.

---

## Where the state layer actually stands today

- **Mainnet is still a hexary Keccak Merkle Patricia Trie.** Accounts in one trie,
  each contract's storage in its own subtrie, code committed by `codeHash`. Nothing in
  any shipped fork (Dencun 2024, Pectra May 2025, Fusaka Dec 2025) changed this, and
  nothing in the next fork changes it either.
- **Glamsterdam** (next fork, targeting roughly Q3–Q4 2026, no `EIP-7773` mainnet
  timestamp locked in yet) has headliners **ePBS (EIP-7732)** and **Block-Level Access
  Lists (EIP-7928)**. Neither touches the state tree. BALs tell you *which* state a
  block touched; they are not state proofs and do not replace `eth_getProof`.
- **Hegotá** (the fork after, ~2027) has **FOCIL (EIP-7805)** as its sole confirmed
  headliner, with Frame Transactions (EIP-8141) and account abstraction in the
  conversation. Again: no state tree change.

So the MPT is the live format through at least two more hard forks.

## Where it is genuinely going: EIP-7864, a unified binary tree

[EIP-7864 "Ethereum state using a unified binary tree"](https://eips.ethereum.org/EIPS/eip-7864)
is the live successor design:

- One **binary** tree replacing the hexary MPT, with accounts, storage and code merged
  into a single uniform 32-byte key → 32-byte value space.
- Node types: internal (left/right hash), **stem** (stem value + left/right), leaf,
  empty. Key layout is `[storage-type byte][stem bytes][subindex byte]`, colocating 256
  related keys under one stem so a proof over a contract's adjacent slots collapses into
  one stem branch instead of 256 independent paths.
- Motivation is explicitly **ZK-provability and post-quantum safety**: a hash-based tree
  with a SNARK-friendly hash is cheap to prove inside a validity proof, and hash-based
  commitments survive quantum adversaries.

**Verkle (EIP-6800/6900) is the deprecated branch.** It was the statelessness favourite
for years, and its proofs are genuinely smaller — but its polynomial/IPA commitments are
*not* post-quantum and are expensive to verify inside a SNARK. During 2024–2025 core dev
attention shifted to binary trees for exactly those two reasons. Verkle survives only in
old stateless-client prototypes. Building your verifier around banderwagon/IPA multiproof
verification in 2026 would be wiring your pipeline to a dead design — and it is the most
expensive possible mistake here, because a Verkle verifier shares essentially zero code
with either MPT or binary-tree verification.

## Timing: how hard a dependency you can take on 7864

Do **not** take a hard dependency. Concretely:

1. **EIP-7864 is `Draft`, Standards Track (Core). It has no fork scope.** It is not SFI
   or CFI for Glamsterdam, and it is not in Hegotá's headliner set. Spec, Python spec
   (`jsign/binary-tree-spec`), a Rust PoC and client prototyping exist, but "a team is
   driving it" is not a fork slot.
2. **The hash function is undecided, and it is load-bearing for you.** The draft uses
   **BLAKE3** purely to reduce friction for EL client experiments. Real candidates are
   Keccak and **Poseidon2**, the latter still under EF cryptanalysis. The stated blocker
   is finding a hash that is both secure and has enough proving throughput. Your verifier's
   hot loop *is* that hash function — so the single most consequential parameter of the
   design you'd be committing to is the one that isn't settled. This alone rules out
   building the 7864 path as your production backend now.
3. **The migration is not a flag day, and the transition state is the nastiest case for a
   verifier.** The approach is an overlay: the new binary tree starts **empty**, new state
   writes go into it, and the MPT is **frozen** and continues to exist; a later fork
   migrates the remaining MPT data across (EIP-7748, which is deliberately agnostic to the
   target tree). During that window, the slot your dApp cares about may live in *either*
   structure, and your verifier must handle both and know the precedence rule. Budget for
   a dual-proof period, not a cutover.
4. **Realistic earliest exposure: a fork after Hegotá — 2028 or later** for activation,
   and later still for conversion to complete. Treat any date more precise than that as
   speculation.

## What this means for your build

**Backend A — ship this (MPT).**
`eth_getProof(address, [slots], blockNumber)` → RLP node list for the account proof to
`stateRoot`, plus a per-slot storage proof to `storageRoot`. Verify by re-hashing the path
with Keccak-256. Well-specified (EIP-1186), universally supported, and you can cross-check
against multiple independent RPCs cheaply while you're at it.

**Backend B — stub it (binary tree).** Keep it behind the same interface, track EIP-7864,
but do not invest in the hash-dependent inner loop until the hash is chosen.

**The abstraction to define now**, because it's what makes the swap cheap:

```
verify(slot_key, block_header, proof_blob) -> Option<value>
```

with the header's state commitment as the *only* trusted input, and `proof_blob` opaque.
Keep the hash function pluggable, don't assume hex nibble paths or a two-level
account→storage structure anywhere outside the MPT backend (7864 is flat and binary), and
allow `verify` to return a value for a slot resolved from *either* tree during the
overlay period.

**Also worth knowing: the tree is not your hardest problem.** A state proof only buys
trust-minimization if the block header you check it against is itself trustworthy. That
anchoring comes from the consensus layer's sync-committee light-client protocol (the
Helios model): follow the beacon chain light client, get a verified execution payload
header, take `stateRoot` from it. That machinery is stable, orthogonal to the state tree
debate, and unchanged by 7864. Get it right first — a perfect MPT proof against an
attacker-supplied header proves nothing.

**One forward-looking note.** The reason Ethereum picked a binary tree with a
SNARK-friendly hash is to make *whole-block validity proofs* practical. If that lands,
the cheapest trust-minimized read may eventually be "verify one validity proof" rather
than "walk a Merkle path" — which is another argument for keeping `verify` an opaque
`(commitment, proof_blob) -> value` interface rather than baking Merkle-path semantics
into your API surface.

## Summary

| Option | Verdict |
|---|---|
| Verkle (EIP-6800/6900) | **No.** Deprioritized over post-quantum and ZK-provability concerns; dead end. |
| MPT (EIP-1186 proofs) | **Yes, now.** It is mainnet, and stays mainnet through Glamsterdam and Hegotá. |
| Binary tree (EIP-7864) | **Yes, as the direction — but soft dependency only.** Draft, no fork scope, hash function TBD, overlay migration. Design for it; don't depend on it. |

### Sources

- [EIP-7864: Ethereum state using a unified binary tree](https://eips.ethereum.org/EIPS/eip-7864) · [EthMagicians thread](https://ethereum-magicians.org/t/eip-7864-ethereum-state-using-a-unified-binary-tree/22611) · [binary-tree-spec](https://github.com/jsign/binary-tree-spec)
- [EIP-6800 (Verkle)](https://eips.ethereum.org/EIPS/eip-6800)
- [EF Blog — Checkpoint #9, Apr 2026](https://blog.ethereum.org/2026/04/10/checkpoint-9) · [EF Protocol — Hegotá EIP tier list, Sep 2026](https://blog.ethereum.org/2026/09/07/protocol-hegota-eips)
- [Hegotá headliner proposal: FOCIL / EIP-7805](https://ethereum-magicians.org/t/hegota-headliner-proposal-focil-eip-7805/27604)
- [Glamsterdam roadmap](https://ethereum.org/roadmap/glamsterdam/) · [forkcast.org](https://forkcast.org)
- [Ethereum stateless book — binary tree](https://stateless.fyi/trees/binary-tree.html)

Fork status above was checked against forkcast/EF sources plus web search on 2026-09-23.
