# State-proof format for a trust-minimized L1 light client

**Date of analysis: 2026-09-03.** Timing claims below are the fast-moving part; the
structural claims are stable.

## Recommendation in one line

**Build the verifier on today's Merkle-Patricia-Trie (MPT) proofs (`eth_getProof`
shape), anchored to a header you obtain from the consensus-layer light client
protocol — not from an RPC — and put the trie verification behind a versioned
`StateCommitmentScheme` interface so the eventual binary-tree switch is a new
implementation, not a rewrite. Do not build on Verkle.**

The important nuance: **the trie format is not where your trust-minimization comes
from, and it is not where your migration risk is.** Both live in the anchor — how you
get an honest `stateRoot` — and that anchor is changing *sooner* than the trie is.

---

## 1. Where the state layer actually stands today

Ethereum mainnet state is, and for the near term remains, a **hexary Merkle Patricia
Trie over keccak256**, in two levels:

- **Account trie**, rooted at `stateRoot` in the execution block header, keyed by
  `keccak256(address)` (a "secure trie"), leaves being RLP `[nonce, balance,
  storageRoot, codeHash]`.
- **Storage trie**, rooted at the account's `storageRoot`, keyed by
  `keccak256(slot)`.

`eth_getProof` returns exactly this: an `accountProof` (list of RLP-encoded nodes
from `stateRoot` down to the account leaf) plus per-slot `storageProof` against
`storageRoot`. Verification is two chained walks. This is fully specified,
implemented in every client, and is the *only* thing that verifies against mainnet
today. Nothing in the pipeline for 2026 changes it.

An important property to exploit: an MPT proof is self-verifying against a root
**with no trusted party involved**. A malicious RPC cannot forge a proof for a given
`stateRoot`. It can only lie about *which* `stateRoot` is current. That is the whole
attack surface, and it is why the anchor matters more than the trie.

## 2. Verkle is dead — do not build on it

EIP-6800 (unified Verkle tree) plus EIP-4762 / EIP-7612 was the plan under "The
Verge" through ~2024. It has been superseded. Two reasons, both durable:

1. **Post-quantum.** Verkle's vector commitments are elliptic-curve based (IPA over
   Banderwagon). They are not PQ-safe. Committing the state layer — the deepest,
   hardest-to-change part of the protocol — to a non-PQ primitive was judged a bad
   trade given a 10–15 year horizon.
2. **STARK proving got good.** The original argument for Verkle was that hash-based
   Merkle proofs were too big and too slow to prove. Advances in SNARK/STARK proving
   over hash functions erased most of that gap, and a binary Merkle tree with a
   prover-friendly hash gets comparable benefits with simpler, PQ-safe crypto.

EIP-6800 has no fork slot and no active client push. Note that
`ethereum.org/roadmap/verkle-trees` is **stale** and still describes Verkle as the
plan — do not use it as a source. If you wire your pipeline to Verkle you will be
implementing IPA proof verification for a tree that will never exist on mainnet.

## 3. Where it is genuinely going: EIP-7864 unified binary tree

The live successor is **EIP-7864, "Ethereum state using a unified binary tree"**
(Draft, created 2025-01-20). It inherits much of EIP-6800's key layout but replaces
the polynomial commitment with a plain binary Merkle tree. Structurally relevant to
you:

- **Binary, not hexary.** Branches are ~4x shorter than today's, which directly cuts
  light-client bandwidth — this is one of the stated motivations.
- **Account and storage tries are merged into a single tree.** Keys are
  `storage_type_prefix (1 byte) || stem (31 bytes) || subindex (1 byte)`, where the
  stem derives from the hashed address (or address + storage key) and each stem
  covers a 256-leaf group of values usually accessed together.
- **Consequence for you: `storageRoot` goes away as a proof anchor.** Your current
  two-step "prove account, then prove slot under its `storageRoot`" collapses into a
  single proof from `stateRoot` to a leaf. This is the one part of your verifier that
  genuinely cannot be shared between schemes.
- **The hash function is not decided.** The reference implementation uses BLAKE3
  purely "to reduce friction for EL clients experimenting with this EIP"; the EIP
  explicitly says *"Do not assume BLAKE3 is a final decision."* Poseidon2 and Keccak
  are the other candidates, and Poseidon2 is gated on ongoing cryptanalysis.

**You cannot implement this today even if you wanted to.** An unresolved hash
function means the leaf and node encodings are not frozen. Any code you write now is
speculative.

## 4. Timing — the part that determines how hard a dependency you can take

This is the crux, and the answer is: **take no hard dependency on the binary tree.**

- **Fusaka** shipped December 2025. No state tree change.
- **Glamsterdam** — targeted Q4 2026, headliners **EIP-7732 (ePBS)** and **EIP-7928
  (block-level access lists)**, plus gas repricings. Meta EIP-7773 still Draft as of
  mid-2026; devnets running. **No state tree change.**
- **Hegotá** — the fork after, headliner confirmed as **FOCIL (EIP-7805)**. **Not the
  binary tree.**

So EIP-7864 has missed two consecutive fork scoping rounds and is not the headliner
of either. Realistic earliest activation is **a 2027 fork**, and slippage is the base
rate for state-layer changes (Verkle was "next fork" for roughly four years running).

**And even activation does not end the MPT.** EIP-7864 is deliberately designed as an
*overlay*: the binary tree **starts empty**, only new state writes go into it, and the
**MPT continues to exist but is frozen**. Bulk migration of existing state is a
*separate, later* fork (**EIP-7748**, which has no slot at all).

The operational implication is the one most people miss:

> There will be an extended period — plausibly a year or more — during which a given
> mainnet storage slot lives in **either** the frozen MPT **or** the new binary tree,
> and a correct verifier must handle both and know the resolution rule (check the
> binary tree; on absence, fall back to the frozen MPT). Proving *absence* correctly
> in the binary tree becomes security-critical, because absence is what authorizes the
> MPT fallback. A bug there is a soundness bug, not a liveness bug.

Practical read: your MPT verifier has a useful life of **at minimum through 2027, and
realistically well beyond** — because even post-7864 you still need it for unmigrated
state. It is not a throwaway. Build it properly.

## 5. The change that will actually hit you first: ePBS, in Glamsterdam

This is the timing risk worth budgeting for in 2026, and it is not about the trie.

Today a light client anchors like this: sync-committee-signed `LightClientUpdate` →
beacon block → `ExecutionPayloadHeader` (which **contains `state_root` directly**) →
verify MPT proof against it. One clean chain of custody.

Under **EIP-7732**, `ExecutionPayloadHeader` is renamed and reduced to
`ExecutionPayloadBid`:

```
parent_block_hash, parent_block_root, block_hash, prev_randao, fee_recipient,
gas_limit, builder_index, slot, value, execution_payment, blob_kzg_commitments
```

**`state_root` and `receipts_root` are gone.** Only `block_hash` remains. Your
pipeline must gain a step: obtain the full execution header, check
`keccak256(rlp(header)) == block_hash`, then read `stateRoot` out of it. That is still
fully trust-minimized (it's a hash preimage check, and the RPC cannot forge it), but
it is a real code change, it adds a fetch, and it lands with **Glamsterdam in Q4
2026** — i.e. roughly a year *before* anything touches the trie.

Also note ePBS means a payload committed to at slot N may not be revealed timely; the
PTC attests to that. Your "recent block" definition needs a policy for what counts as
a usable head. Prefer finalized or at least justified headers for state queries.

## 6. Don't route around this with an L1 zkEVM proof yet

The L1 zkEVM effort (real-time proving: ~10s latency for 99% of blocks, <300 KiB
proofs, ≤$100k prover hardware) is real and progressing, and in the long run
"verify a STARK over the header chain" is a plausible endgame for light clients. But
in 2026 the 2026 workstreams are still *standardizing* the `ExecutionWitness` format
and the zkVM guest API, and the consumer being designed for is **validators opting
into stateless verification**, not third-party light clients. There is no stable,
mainnet-verifiable artifact for you to depend on. Track it; don't build on it.

---

## 7. What to actually build

**Layer 1 — anchor (this is your real trust-minimization, spend your effort here).**
Run the consensus-layer light client protocol (Altair sync committees) yourself, à la
Helios: bootstrap from a weak-subjectivity checkpoint, follow sync committee
signatures, and derive `stateRoot` from a header you verified. Never accept a
`stateRoot` because an RPC said so. Be explicit in your docs that this inherits the
sync-committee security model (a 512-validator committee, honest-majority-of-committee
assumption), which is weaker than running a full node — that is the actual residual
trust in "trust-minimized," and your users should know it.

**Layer 2 — commitment scheme (make this swappable).** One narrow interface:

```
verify(scheme_id, state_root, address, slot, proof) -> Present(value) | Absent
```

with `scheme_id` selected by the fork of the anchored block, and `Absent` as a
first-class, *proven* result rather than an error. Implement `MPT_KECCAK_HEXARY`
today. Reserve `BINARY_7864` and leave it unimplemented. When 7864 lands, the overlay
period is expressed as a composite scheme that consults binary-then-MPT — which the
interface already supports because absence is proven, not inferred.

**Layer 3 — application.** Should only see `Present(value) | Absent` plus the block
it was proven against. Nothing above layer 2 should know what a nibble or an RLP node
is.

**Things to get right now, because they're invariant across schemes:** proven absence
vs. lookup failure; refusing to serve state from a header you didn't verify; pinning
results to a specific block number/hash so callers can't be confused about *as of
when*; and a hard rule that the proof-verifying code never calls the network.

**What this costs you.** Essentially nothing versus building MPT-only, beyond one
interface boundary. The MPT verifier is not wasted work — you need it through the
overlay period regardless. And you avoid the one genuinely expensive mistake
available here, which is implementing Verkle IPA verification for a tree that will
never ship.

## Sources

- [EIP-7864: Ethereum state using a unified binary tree](https://eips.ethereum.org/EIPS/eip-7864)
- [EIP-6800: Ethereum state using a unified verkle tree](https://eips.ethereum.org/EIPS/eip-6800)
- [EIP-7732: Enshrined Proposer-Builder Separation](https://eips.ethereum.org/EIPS/eip-7732)
- [Binary Tree — Ethereum stateless book](https://stateless.fyi/trees/binary-tree.html)
- [Vitalik lays out a two-part plan to overhaul Ethereum's execution layer (The Block, 2026-03-01)](https://www.theblock.co/news/ecosystems/2026-03-01-vitalik-buterin-lays-out-a-two-part-plan-to-overhaul-ethereums-execution-layer-from-the-ground-up-391681)
- [Hegotá headliner proposal: FOCIL, EIP-7805](https://ethereum-magicians.org/t/hegota-headliner-proposal-focil-eip-7805/27604)
- [Glamsterdam: Ethereum's next hard fork explained (Kiln)](https://www.kiln.fi/post/glamsterdam-ethereums-next-hard-fork-explained)
- [Shipping an L1 zkEVM #1: Realtime Proving (EF Blog)](https://blog.ethereum.org/2025/07/10/realtime-proving)
- [zkEVM for L1 block verification (ethereum.org)](https://ethereum.org/roadmap/zkevm/)
- [Verkle trees (ethereum.org)](https://ethereum.org/roadmap/verkle-trees) — **stale**, still presents Verkle as the active plan
