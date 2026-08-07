# State-proof format for a trust-minimized L1 storage-slot light client

**Date of analysis: 2026-07-25**

## Recommendation in one paragraph

Build and ship on **Merkle-Patricia Trie (MPT) proofs as returned by `eth_getProof` (EIP-1186)**,
because that is the only thing mainnet actually commits to today and will remain so for years.
But architect the verifier so the proof format is a **swappable module behind a stable interface**,
and make the module you plan to add second the **EIP-7864 unified binary tree**, not Verkle.
Verkle is the design the protocol is moving *away* from — its core EIPs are Stagnant and the same
authors have moved to the binary-tree proposal. Critically, do **not** take a hard schedule
dependency on the binary tree: as of today it is a Draft EIP with an *undecided hash function*, no
finalized conversion mechanism, and it is not a headliner in either of the two named upcoming
forks. Plan for MPT to be your production path through at least 2027.

The part of your stack worth investing the most engineering in is not the tree proof at all — it is
the **anchor** (how you obtain a trustworthy `stateRoot` without an RPC provider). That layer is
stable across every tree change on the roadmap, and it is where the real trust-minimization lives.

---

## 1. Where Ethereum's state layer stands today

Mainnet state is a **hexary Merkle-Patricia Trie**, and it has properties that matter to you:

- It is a **tree of trees**: a global account trie keyed by `keccak256(address)`, whose leaves are
  RLP-encoded accounts containing a `storageRoot`, which roots a *separate* per-account storage trie
  keyed by `keccak256(slot)`.
- Nodes are **RLP-encoded** and hashed with **Keccak-256**.
- **Contract code is not in the tree** — only `codeHash` is.
- Branch nodes are 16-ary, so a proof carries 15 sibling hashes per level. EIP-7864's own motivation
  section puts the expected single-branch proof at `15 * 32 * log_16(2^32) = 3840` bytes.

So a storage-slot proof today is a **two-step verification**: verify the account against the block's
`stateRoot`, extract `storageHash`, then verify the slot against that. `eth_getProof` returns exactly
this shape (`accountProof`, `storageProof[]`), it is universally supported, and it is what production
light clients such as a16z's **Helios** verify against a sync-committee-authenticated header. That is
your near-term stack, and it works.

Nothing in the current roadmap changes this before Glamsterdam ships, and Glamsterdam does not change
it either (see §4).

## 2. Where it is genuinely going: EIP-7864, a unified binary tree

The direction of travel is a **single binary (arity-2) tree covering accounts, storage, and code**,
specified in **EIP-7864 — "Ethereum state using a unified binary tree"** (Draft, created 2025-01-20;
authors include Vitalik Buterin, Guillaume Ballet, Dankrad Feist, Ignacio Hagopian, Kevaundray
Wedderburn, Danno Ferrin, Piper Merriam). Concretely it changes:

- **One tree, not two.** Accounts and storage merge into a single `key -> bytes32` space. There is no
  per-account `storageRoot` anymore, so the two-step account-then-slot verification collapses into a
  single proof against a single root.
- **No RLP.** Keys are `[storage_type (1 byte) | stem (31 bytes) | subindex (1 byte)]`, with
  `HEADER_SUBTREE = 0`, `CODE_SUBTREE = 1`, `STORAGE_SUBTREE = 255`. Values are always 32 bytes.
- **Code is in the tree**, chunked (first 128 code chunks and first 64 storage slots co-located in the
  account's header stem to reduce branch openings).
- **Account fields are packed.** `version`, `balance`, `nonce`, `code_size` live big-endian-packed in a
  single leaf at `BASIC_DATA_LEAF_KEY = 0`. Your account decoder changes shape completely.
- **Binary arity** → far smaller branches. EIP-7864 cites ~768 bytes vs ~2,880 bytes for a hexary
  branch in a 2³² tree; roughly a 4x reduction in Merkle branch size.
- **Merkleization is trivial**: `internal = H(left || right)`, `stem_node = H(stem || 0x00 || H(left || right))`,
  `leaf = H(value)`, `empty = 0x00 * 32`. Much easier to implement correctly and to prove in-circuit
  than MPT node decoding.

### Why this, and not Verkle

Two independent reasons, and the second is the decisive one:

1. **Post-quantum posture.** Verkle's commitment scheme rests on elliptic curves (IPA over
   Banderwagon). That is not post-quantum secure and would need replacing later. EIP-7864 depends only
   on a hash function, which survives the transition. If Verkle shipped, at least one *additional*
   full state-tree conversion would be guaranteed later.
2. **SNARK proving won the argument.** The whole point of reworking the state tree now is Ethereum's
   L1 zkEVM program — making blocks verifiable by validity proof. Verkle's vector commitments are
   cheap to open out-of-circuit but expensive *in*-circuit; a binary hash tree with a proving-friendly
   hash is far better for the zkEVM path. Buterin has framed the state tree plus the VM as more than
   80% of the proving bottleneck. Verkle also hit practical problems — block-production performance
   issues in Verkle devnets led the shadow-fork effort to switch over to the binary tree.

### The status evidence (checked today against the EIPs repo)

| EIP | Title | Status |
|---|---|---|
| **7864** | Ethereum state using a unified binary tree | **Draft** (active) |
| 6800 | Ethereum state using a unified verkle tree | **Stagnant** |
| 7612 | Verkle state transition via an overlay tree | **Stagnant** |
| 7748 | State conversion to Verkle Tree | Draft (needs a binary re-spec) |
| 4762 | Statelessness gas cost changes | Draft |
| 7709 | Read BLOCKHASH from storage | Stagnant |

That table is the cleanest available signal: **the two EIPs that actually define the Verkle state tree
and its migration have gone Stagnant, while the binary-tree EIP is the live one.** This is the single
most important fact for your decision.

**A warning about your own research process:** a lot of secondary coverage — including
`ethereum.org/roadmap/verkle-trees/` itself, and a large share of 2026 news articles about the Hegotá
upgrade — still describes Verkle as the plan and claims Verkle trees are coming in a 2026 fork. That
material is stale. Verify against the EIPs repo and All Core Devs notes, not roadmap pages or
aggregator news.

### The third horizon: validity proofs

Longer term the state proof may stop being the thing you verify at all. Under the L1-zkEVM program,
a verifier can check a **succinct proof of the whole block** rather than a Merkle branch. The EF's
real-time-proving targets are ≤10s latency for 99% of mainnet blocks, ≤300KB proof size, ≥128-bit
security. This is early — the first L1-zkEVM workshop was February 2026 — but it reinforces the same
architectural advice: keep "*how I learned this state root is canonical*" separable from "*how I
proved this value sits under that root*," so a zk attestation can be dropped into either slot later.

## 3. What is still genuinely undecided in EIP-7864

Do not treat the binary tree as a frozen spec you can pre-implement today:

- **The hash function is not chosen.** The spec uses BLAKE3 "to reduce friction for EL clients
  experimenting with this EIP" and says in bold: *"Do not assume BLAKE3 is a final decision."*
  Candidates are BLAKE3, Keccak, and Poseidon2 — and Poseidon2 is pending an ongoing EF cryptography
  security review. If Poseidon2 wins, additional spec work is needed for field selection (BN254 scalar
  field vs 31-bit fields) and for encoding 32-byte values into field elements. **This changes both
  your hashing and your address→key derivation.**
- **The conversion mechanism is unresolved.** The overlay approach (freeze the MPT, write new state to
  a fresh tree laid over it, convert the remainder in the background, then flatten) is the leading
  pattern, drawn from EIP-2584/EIP-7612 — but the Verkle version of it went Stagnant and a binary
  analogue of EIP-7748 has not landed. **Assume a live transition period in which state is split
  across two trees under one committed root, with a precedence rule you must implement exactly.**
- **Parameters and embedding details are still moving** as client feedback arrives.

## 4. Timing — how hard a dependency you can safely take

This is the part that should constrain your planning:

- **Fusaka has shipped** (PeerDAS / data availability sampling).
- **Glamsterdam** is the next fork, targeted 1H–mid 2026 but slipping in practice (Devnet-7 landed
  2026-07-08). Its headliners are **EIP-7732 (ePBS)** and **EIP-7928 (Block-Level Access Lists)**.
  **Neither is a state-tree change.**
- **Hegotá** is the following fork, loosely targeted for late 2026 / 2H 2026 with **FOCIL (EIP-7805)**
  as its leading headliner. The binary tree is a *candidate* for it at best, and given the undecided
  hash function it is not credible as a near-term Hegotá deliverable.
- Historically, state-tree replacement is the single most-delayed item on the Ethereum roadmap:
  Verkle was "next fork" material for roughly four years and never shipped.

**Practical conclusion: assume MPT is your production format through at least 2027, and treat the
binary tree as a migration you will execute on ~6–12 months of notice, not a foundation you can build
on now.** Anyone telling you to build the pipeline directly on EIP-7864 today is asking you to
implement against a spec whose hash function is explicitly marked TBD.

## 5. What this means for your architecture

**Layer 1 — the anchor (build this properly; it survives every tree change).**
Get the `stateRoot` without trusting a provider: follow the beacon-chain light client protocol
(sync-committee signatures over beacon block headers, 512 validators rotating ~27h), read
`ExecutionPayloadHeader.state_root` from the authenticated header, and only then verify a proof
against it. This is the Helios model and it is the actual source of your trust minimization. Note
honestly in your threat model that sync-committee security is *weaker* than full validation — it is a
1/2-to-2/3 honest-majority assumption over a small committee plus a weak-subjectivity checkpoint, not
full consensus verification.

**Layer 2 — the proof verifier (make this pluggable).**
Define one interface and implement MPT behind it now:

```
verify_slot(
    state_root: B256,
    address:    Address,
    slot:       B256,
    proof:      StateProof,     // format-tagged
) -> Result<Option<B256>>       // None = proven-absent
```

Requirements to bake in from day one:

- **Format-tag every proof and every cached artifact** with `(fork/format version, block number)`.
  Never store a bare proof blob.
- **Keep key derivation pluggable.** MPT uses `keccak256(address)` and `keccak256(slot)`;
  EIP-7864 uses `get_tree_key(storage_type, hash(address32), sub_index)` with an as-yet-unchosen hash
  and a 12-zero-byte address left-pad to `Address32`. This is the function most likely to change.
- **Do not leak `storageHash` into your public API.** It disappears entirely under EIP-7864 (one tree,
  one root). If your API or on-chain verifier exposes a two-step account→storage shape, you will have
  to break it. Expose `(block, address, slot) -> value` and nothing more.
- **Support exclusion proofs** in the interface signature from the start — both trees need them, and
  retrofitting `Option` semantics later is painful.
- **Plan for the dual-tree transition window**: the verifier interface should be able to represent
  "value proven under the frozen legacy root" vs "value proven under the new root," with the
  precedence rule applied above the format modules.

**Layer 3 — on-chain verifier, if you have one.**
Make it **upgradeable or versioned per block range**. EIP-7864's own Backwards Compatibility section
is explicit that *"tree structure change makes in-EVM proofs of historical state no longer work."*
An immutable on-chain MPT verifier becomes permanently unable to verify post-fork state.

**Operational note.** Your MPT path depends on `eth_getProof` being served. Support multiple
independent providers and treat proof-serving availability as a liveness dependency (the proof is
still trustless — a lying provider is caught by verification — but a provider that simply stops
serving proofs takes you down). The Portal Network is the relevant long-term decentralized
alternative for proof retrieval.

## 6. What not to do

- **Do not build on Verkle.** No IPA/Banderwagon commitments, no Verkle-specific proof plumbing. The
  defining EIPs are Stagnant and the authors moved on.
- **Do not pre-implement EIP-7864 against BLAKE3** and treat it as done. The spec says in bold not to
  assume that hash is final.
- **Do not hardcode RLP/Keccak node parsing across your codebase.** Confine it to one module.
- **Do not gate your product launch on a fork.** Ship on MPT.
- **Do not archive proofs long-term without a format version and block number**; they will not be
  re-verifiable across the transition.

---

## Sources

- [EIP-7864: Ethereum state using a unified binary tree](https://eips.ethereum.org/EIPS/eip-7864) (Draft) — and the [raw spec in the EIPs repo](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-7864.md)
- [EIP-6800: Ethereum state using a unified verkle tree](https://eips.ethereum.org/EIPS/eip-6800) (Stagnant)
- [EIP-7612: Verkle state transition via an overlay tree](https://eips.ethereum.org/EIPS/eip-7612) (Stagnant)
- [EIP-2584: Trie format transition with overlay trees](https://eips.ethereum.org/EIPS/eip-2584)
- [EIP-7864 discussion thread, Fellowship of Ethereum Magicians](https://ethereum-magicians.org/t/eip-7864-ethereum-state-using-a-unified-binary-tree/22611)
- [Shipping an L1 zkEVM #1: Realtime Proving — Ethereum Foundation Blog](https://blog.ethereum.org/2025/07/10/realtime-proving)
- [zkEVM for L1 block verification — ethereum.org](https://ethereum.org/roadmap/zkevm/)
- [Checkpoint #8: Jan 2026 — Ethereum Foundation Blog](https://blog.ethereum.org/2026/01/20/checkpoint-8) (Fusaka shipped; Glamsterdam headliners ePBS + BALs; Hegotá / FOCIL)
- [Ethereum developers name post-Glamsterdam upgrade 'Hegota' — The Block](https://www.theblock.co/post/383275/ethereum-developers-name-post-glamsterdam-upgrade-hegota-as-2026-roadmap-takes-shape)
- [Vitalik Buterin lays out a two-part plan to overhaul Ethereum's execution layer — The Block](https://www.theblock.co/post/391681/vitalik-buterin-lays-out-a-two-part-plan-to-overhaul-ethereums-execution-layer-from-the-ground-up)
- [Binary Tree — Ethereum stateless book](https://stateless.fyi/trees/binary-tree.html) and [Verkle Tree](https://stateless.fyi/trees/vkt-tree.html)
- [Ethereum Binary Tree notes — Ignacio Hagopian](https://hackmd.io/@jsign/binary-tree-notes)
- [Building Helios: Fully trustless access to Ethereum — a16z crypto](https://a16zcrypto.com/posts/article/building-helios-ethereum-light-client/) and [a16z/helios](https://github.com/a16z/helios)
- [State of light clients, and how Portal can help](https://blog.ethportal.net/posts/light-clients)
- [Towards Stateless Clients in Ethereum: Benchmarking Verkle Trees and Binary Merkle Trees with SNARKs (arXiv)](https://arxiv.org/pdf/2504.14069)
- Stale-but-widely-cited, listed as a caution: [ethereum.org/roadmap/verkle-trees](https://ethereum.org/roadmap/verkle-trees/)
