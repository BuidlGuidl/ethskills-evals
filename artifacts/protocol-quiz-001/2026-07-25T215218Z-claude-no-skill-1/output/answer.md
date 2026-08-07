# State-proof format recommendation for a trust-minimized L1 light client

*Written 2026-07-25. Every timing claim below has a "how to re-check" note, because the
schedule is the part most likely to move.*

## The short answer

**Ship on EIP-1186 Merkle-Patricia Trie (MPT) proofs today, but build the verifier as a
versioned, pluggable commitment-scheme interface whose second implementation is the
EIP-7864 unified binary tree, and whose third is a succinct (STARK) state proof.**

Concretely:

1. **Don't build on Verkle.** That is the design the protocol is moving away from, and it
   is the one trap in this question. EIP-6800 (unified Verkle tree) is marked **Stagnant**
   on eips.ethereum.org. It is not coming.
2. **Where it's actually going: EIP-7864**, a unified *binary* Merkle tree with a
   SNARK-friendly hash. This is the live, funded, actively-specced direction — but it is
   still `Draft`, its hash function is explicitly **not chosen**, and it is **not in
   Glamsterdam**.
3. **Therefore: no hard dependency on the binary tree.** Earliest plausible mainnet is the
   fork *after* Glamsterdam (so 2027-ish, not 2026), and even that only freezes the MPT and
   starts an empty binary tree — actual state conversion (EIP-7748) is a *further* fork
   after that. There will be a multi-year window where mainnet state lives in **two**
   commitments at once. Your verifier must be able to represent that.
4. **The thing you should invest most in is not the tree shape at all.** It's how you
   obtain a trusted `state_root` in the first place (the consensus light-client anchor).
   That is where your real trust assumption lives, it's a bigger chunk of the work, and it
   has its own migration ahead of it (post-quantum consensus signatures).

---

## Where Ethereum's state layer actually stands today (July 2026)

**Mainnet state is still the hexary Merkle-Patricia Trie over keccak256.** An account trie
keyed by `keccak(address)`, and a *separate* storage trie per account keyed by
`keccak(slot)`, whose root is the `storageRoot` field of the account leaf. The standardized
witness format is **EIP-1186 `eth_getProof`**: an `accountProof` (RLP-encoded node path from
`state_root` down to the account leaf) plus a `storageProof` array (node path from that
account's `storageRoot` down to each requested slot). Nothing shipped in Fusaka (activated
3 Dec 2025) or planned for Glamsterdam changes this.

**Glamsterdam, the next fork, does not touch the state tree.** Its headliners are EIP-7732
(enshrined PBS) and EIP-7928 (block-level access lists). It reached final devnet stage in
mid-June 2026 with a mainnet target in H2 2026. Notably, EIP-7782 (6-second slots) was
*declined* for Glamsterdam, partly because it would squeeze the real-time zk-proving budget
— relevant to you, see the freshness-window note below.

**Verkle is over.** The Verge was, for years, "switch to Verkle trees" (EIP-6800 for the
tree, EIP-4762 for witness gas accounting). Two things killed it:

- **Not post-quantum.** Verkle's vector commitments are elliptic-curve based (IPA over
  Banderwagon). Adopting them would have meant migrating the entire state tree *twice* —
  once to Verkle, again to something PQ-safe later.
- **Not SNARK-friendly.** As zkEVMs became the center of the L1 roadmap, the question
  changed from "how small is a witness?" to "how cheap is it to *prove* a state access
  inside a zkVM?" On that metric a binary Merkle tree over a fast/arithmetization-friendly
  hash beats Verkle, and the gap widened as STARK provers improved.

EIP-6800 is Stagnant as a result. EIP-4762 survives, but only as the access-event / gas
model that the binary-tree work reuses. **If a vendor or library offers you
Banderwagon/IPA witnesses, that is a dead branch.**

---

## Where it's genuinely going: EIP-7864 + succinct proofs

### The tree: EIP-7864, unified binary tree

- **One tree, not one-plus-N.** Accounts, storage slots, and contract code chunks all live
  in a *single* tree. **There is no per-account `storageRoot` anymore.** This is the
  single biggest structural change for your code — see the API note below.
- **Keys are 32 bytes**: a 1-byte type prefix + a 31-byte *stem* + a 1-byte subindex, so
  256 related keys share a stem and co-locate in one "big branch" (contiguous storage
  slots, an account's header fields, sequential code chunks). Node kinds are
  `InternalNode`, `StemNode`, `LeafNode`, `EmptyNode`.
- **Proofs get materially smaller.** The EIP cites an expected branch of ~768 bytes for a
  2^24-element tree — roughly 4x shorter than the equivalent hexary MPT branch, because a
  hexary node forces you to carry 15 sibling hashes per level while a binary node carries 1.
- **Status: `Draft`**, created 20 Jan 2025, actively developed (there's a Python executable
  spec, `jsign/binary-tree-spec`). It is *not* in Glamsterdam.

### The hash function is genuinely undecided

The EIP says outright that the hash function in the current draft **is not final**. The
reference implementation uses **BLAKE3** to reduce friction for EL client teams
experimenting with it; **Keccak** and **Poseidon2** are the other candidates. Poseidon2 is
the high-upside option (order-of-magnitude proving wins) and is exactly why the EF is
running the **Poseidon Cryptanalysis Initiative**: Phase 1 wrapped Dec 2025, **Phase 2 runs
through December 2026**. Recent Gröbner-basis / subspace-trail results against
Poseidon-family permutations are precisely the kind of thing that process exists to surface.

**Read this as a hard scheduling fact:** the protocol cannot finalize its state-tree hash
before that analysis concludes, so a mainnet binary tree in 2026 is essentially off the
table. Also note the hash function choice changes your *key derivation*, not just your node
hashing — the tree keys are derived using the chosen hash.

### The migration is two forks, not one

EIP-7864 by itself uses the "overlay" pattern (inherited from EIP-7612/EIP-6800): a new
binary tree starts **empty**, only new state changes go into it, and **the MPT continues to
exist but is frozen**. Moving the ~billion existing state entries across is a *separate*
proposal, **EIP-7748**, targeted at a later fork.

The consequence for you is specific and easy to get wrong: **during the overlay period, a
correct read of a storage slot is "look in the binary tree; if absent there, look in the
frozen MPT."** A verifier that assumes one tree per block will silently return wrong
answers (typically "slot is zero") for any slot that hasn't been touched since the fork.
Write that dual-lookup rule into your design doc now, even though you can't implement it
for a couple of years.

### Why the protocol wants this: the L1 zkEVM

The state tree change is the state-layer half of making L1 blocks cheaply provable. That
program is well past the hand-wavy stage:

- 2025 target **real-time proving was met**: block proving latency fell from ~16 minutes to
  ~16 seconds, with 99% of mainnet blocks proven inside 10s on target hardware.
- The **2026 roadmap pivoted from speed to provable security**: all zkEVM teams integrated
  into the EF's `soundcalc` evaluation tool (Feb 2026); ≥100-bit provable security with
  proofs <600 KB around the Glamsterdam timeframe; **128-bit security with sub-300 KB proofs
  by end of 2026**.

Vitalik's framing is that the state tree and the VM are the two dominant proving
bottlenecks, together ~80% of the overhead — and of the two, **the binary tree is the
concrete, in-progress one**; the RISC-V VM replacement is still speculative and lacks broad
client-team consensus. Don't design around the VM change. Do design around the tree change.

**The endgame artifact for a light client is therefore not a Merkle branch at all — it's a
succinct proof**: a STARK asserting *"in state root R, slot S of contract C holds value
V."* Constant-ish size, constant-ish verification, and completely indifferent to whether
the underlying tree is hexary or binary. You can already buy this today from third-party
proving services against the MPT; the binary tree is what makes it cheap enough to be the
default.

---

## What this means for your verifier

### 1. Put the commitment scheme behind a versioned interface, from day one

The whole recommendation reduces to one API decision:

```rust
/// Resolved against a state root the *consensus* light client already verified.
fn verify_slot(
    state_root: B256,
    address: Address,
    slot:    B256,
    proof:   &StateProof,
) -> Result<Option<U256>, VerifyError>;   // None == provably absent/zero

enum StateProof {
    /// EIP-1186 eth_getProof: RLP node paths, keccak256, hexary, secure-trie.
    MptV1 { account_proof: Vec<Bytes>, storage_proof: Vec<Bytes> },

    /// EIP-7864 unified binary tree. Hash function is a *parameter*, not a constant.
    BinaryV1 { hash: TreeHash, branch: Vec<B256>, /* ... */ },

    /// Overlay period: binary tree first, frozen MPT as fallback.
    Overlay { binary: Box<StateProof>, frozen_mpt: Box<StateProof> },

    /// The endgame. Stub it now; it costs you nothing and it disciplines the API.
    Succinct { system: ProofSystem, proof: Bytes, public_inputs: PublicInputs },
}
```

Then enforce three rules:

- **Nothing above this boundary may know about keccak, RLP, nibbles, or hexary branching.**
- **Nothing above this boundary may know about `storageRoot`.** Your domain model must be
  `(state_root, address, slot) -> value`, *not* `state_root -> account -> storageRoot ->
  value`. The intermediate storage root does not exist in EIP-7864. This is the assumption
  most likely to be load-bearing in a naive implementation, and the most expensive to remove
  later.
- **Select the variant from a fork-schedule table keyed by block number/timestamp**, not
  from a compile-time constant. You'll be editing that table repeatedly over the next three
  years.

### 2. Ship `MptV1` now, and don't apologize for it

It's the only format that exists on mainnet, it's standardized (EIP-1186), it's universally
supported by RPC providers, it's what Helios uses, and it will remain the *canonical* format
through Glamsterdam and for at least one fork *past* the binary-tree fork (because 7864
freezes the MPT rather than converting it). MPT is not a legacy choice you're settling for —
it's the correct choice with a known, staged exit.

### 3. Spend your effort on the root anchor, not the tree

A storage proof only proves membership under a root. If you get that root from an RPC
provider you trust, the proof buys you nothing. The real work is the **Altair light-client
sync protocol**: follow the 512-validator sync committee (rotating ~every 27 hours), verify
its aggregate BLS signature over beacon headers, walk to a finalized header, and take
`ExecutionPayloadHeader.state_root` from it. Use **Helios** (a16z) or a Helios-derived core
rather than writing this yourself.

Two honest caveats to document for your users:

- **The sync committee is a weaker assumption than the full validator set.** It's a random
  512-validator sample, and sync-committee messages are not slashable. It's a strong
  *economic* assumption, not a full-consensus one. Say so in your security model rather than
  marketing "trustless."
- **This is the non-post-quantum part of your stack.** Ironically: Verkle was rejected *for*
  being non-PQ, so your binary Merkle path verification will be PQ-safe by construction —
  but the BLS signatures you use to anchor the root are not. The lean-consensus workstream is
  actively replacing them with hash-based signatures (XMSS/Winternitz-style, `leanSig` /
  `leanMultisig`, aggregation devnets running through 2026). Expect your header-verification
  code to be rewritten on that timeline, independently of the tree.

### 4. Plan for "can't fetch a proof" as a first-class, expected failure

Verification frees you from *trusting* an RPC; it does not free you from *reaching* one.
`eth_getProof` at a given block requires that node to still hold that block's state trie.
Default full nodes retain roughly the last 128 blocks of state (~25 min today), not an
archive.

Finality is ~2 epochs ≈ 64 slots ≈ 12.8 minutes, so *"prove against the latest finalized
block"* fits comfortably inside the retention window today — but with only ~2x margin. That
margin is not guaranteed forever: EIP-7782 (6-second slots) was declined for Glamsterdam but
is not dead, and halving slot time roughly halves the wall-clock retention window. So:

- Prove against **finalized** (or a small fixed lag behind head), never against an old block.
- Query **≥2 independent providers**; a proof is self-verifying, so a second source costs
  you nothing in trust and buys you liveness.
- Treat **"no provider can serve a proof for the root I want"** as a distinct error from
  **"proof failed verification."** The first is an ops problem; the second is an attack.
- Track the **Portal Network state sub-network** as an eventual second source. Portal's
  *history* network is live and reliable; the *state* network is the less mature piece —
  worth watching, not worth depending on yet.

### 5. Cheap near-term win: block-level access lists (Glamsterdam)

EIP-7928 puts a `block_access_list_hash` in the block header committing to every account and
storage slot touched in that block **along with post-execution values** (plus balance, nonce,
and code changes). Once Glamsterdam is live, for any block where your slot was *written*,
you can read the new value straight out of a header-committed structure — no trie proof at
all. And because the BAL is complete for the block, the *absence* of your slot from a
BAL you've hash-checked against the header proves the slot **did not change** in that block,
which lets you cheaply roll a previously-proven value forward.

Caveats, so this doesn't become a trap: BALs cover only *touched* state, they're per-block
rather than cumulative, they can be large (you need the whole BAL to check the header hash
and to reason about absence), and EIP-7928 is still in peer review. Treat this as an
optimization for hot slots (an oracle updated most blocks) layered on top of the proof path,
not as a replacement for it.

### 6. Store values, not proofs

Persist `(beacon_block_root, execution block number, state_root, address, slot, value,
verified_at)` plus enough of the light-client header chain to re-derive the result. **Do not
treat serialized proofs as your archival record** — an `MptV1` blob is uninterpretable after
a tree change, and worse, a naive re-verification against a future root will fail in ways
that look like corruption.

---

## Timing summary — how hard a dependency each item can carry

| Thing | Status (Jul 2026) | Realistic mainnet | How hard a dependency |
|---|---|---|---|
| MPT / EIP-1186 `eth_getProof` | Live, canonical | Now → past the 7864 fork | **Hard. Build on it.** |
| Consensus LC anchor (Altair sync committee) | Live | Now | **Hard**, but expect a PQ-signature rewrite |
| BALs (EIP-7928) | Peer review, Glamsterdam headliner, final devnet Jun 2026 | H2 2026 | **Soft** — optional optimization only |
| Binary tree (EIP-7864) | `Draft`, hash TBD, **not in Glamsterdam** | Fork *after* Glamsterdam → ~2027+ | **Soft.** Design for it; don't schedule against it |
| Tree hash function | BLAKE3 (reference only); Keccak / Poseidon2 candidates | Gated on Poseidon Phase 2, ends **Dec 2026** | **None.** Keep it a runtime parameter |
| State conversion (EIP-7748) | Draft, separate later fork | After the 7864 fork | **None.** Just handle the overlay period |
| Succinct/zkEVM state proofs | Real-time proving met 2025; 2026 is a security-hardening year (128-bit, <300 KB proofs by end-2026) | Progressive, third-party first | **Soft** — stub the interface now |
| Verkle (EIP-6800 / Banderwagon-IPA) | **Stagnant** | Never | **Do not build.** |

**The one-line version:** MPT today, EIP-7864 binary tree as the planned second backend,
succinct proofs as the designed-for endgame, Verkle never — and because the binary tree's
hash function and fork slot are both still open, the dependency you take on it should be
*architectural* (a clean commitment-scheme boundary with no `storageRoot` in your domain
model) and never *scheduled*.

## Re-check triggers

Revisit this document if any of these fire:

- Poseidon Cryptanalysis Initiative Phase 2 concludes (due Dec 2026) → the EIP-7864 hash
  gets decided.
- EIP-7864 moves `Draft` → `Review`, or is proposed as a headliner for the post-Glamsterdam
  fork on All Core Devs.
- Glamsterdam ships → BAL optimization becomes available; re-measure your proof bandwidth.
- EIP-7782 (or any slot-time reduction) is picked up for a fork → re-derive your
  finality-vs-state-retention margin.
- Any lean-consensus PQ signature scheme is proposed for mainnet → your header-anchoring
  code needs a migration plan.

## Sources

- [EIP-7864: Ethereum state using a unified binary tree](https://eips.ethereum.org/EIPS/eip-7864)
- [EIP-6800: Ethereum state using a unified verkle tree (Stagnant)](https://eips.ethereum.org/EIPS/eip-6800)
- [EIP-4762: Statelessness gas cost changes](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-4762.md)
- [EIP-7928: Block-Level Access Lists](https://eips.ethereum.org/EIPS/eip-7928)
- [EIP-7864 discussion — Fellowship of Ethereum Magicians](https://ethereum-magicians.org/t/eip-7864-ethereum-state-using-a-unified-binary-tree/22611)
- [Binary tree spec (jsign/binary-tree-spec)](https://github.com/jsign/binary-tree-spec)
- [Ethereum stateless book — Binary Tree](https://stateless.fyi/trees/binary-tree.html)
- [Poseidon Cryptanalysis Initiative](https://www.poseidon-initiative.info/)
- [Poseidon and Neptune: Gröbner Basis Cryptanalysis Exploiting Subspace Trails](https://eprint.iacr.org/2025/954.pdf)
- [Vitalik: Possible futures of the Ethereum protocol, part 4 — The Verge](https://vitalik.eth.limo/general/2024/10/23/futures4.html)
- [Vitalik lays out a two-part plan to overhaul the execution layer — The Block](https://www.theblock.co/post/391681/vitalik-buterin-lays-out-a-two-part-plan-to-overhaul-ethereums-execution-layer-from-the-ground-up)
- [L1-zkEVM Roadmap 2026 — Fellowship of Ethereum Magicians](https://ethereum-magicians.org/t/l1-zkevm-roadmap-2026-integrating-zkevm-proofs-into-ethereums-core-protocol/27595)
- [EF details zkEVM advances and 2026 roadmap](https://mpost.io/ethereum-foundation-details-zkevm-advances-and-roadmap-for-2026/)
- [Towards Stateless Clients: Benchmarking Verkle Trees and Binary Merkle Trees with SNARKs](https://arxiv.org/pdf/2504.14069)
- [Glamsterdam — ethereum.org](https://ethereum.org/roadmap/glamsterdam/)
- [OPINION: Glamsterdam's Headliner — Sigma Prime](https://sigmaprime.io/blog/glamsterdam-headliner/)
- [EIP-7782: The case for 2x shorter slot times in Glamsterdam](https://ethereum-magicians.org/t/eip-7782-the-case-for-2x-shorter-slot-times-in-glamsterdam/24616)
- [Fusaka — ethereum.org](https://ethereum.org/roadmap/fusaka/)
- [Partial history expiry announcement — EF Blog](https://blog.ethereum.org/2025/07/08/partial-history-exp)
- [Altair Light Client — Sync Protocol (consensus-specs)](https://ethereum.github.io/consensus-specs/specs/altair/light-client/sync-protocol/)
- [Building Helios: Fully trustless access to Ethereum — a16z crypto](https://a16zcrypto.com/posts/article/building-helios-ethereum-light-client/)
- [State of light clients, and how Portal can help](https://blog.ethportal.net/posts/light-clients)
- [Lean Consensus Roadmap](https://leanroadmap.org/)
