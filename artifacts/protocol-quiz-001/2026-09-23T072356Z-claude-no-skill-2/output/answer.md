# State-proof format for a trust-minimized L1 light client

**Date of analysis: 2026-09-23**

## Recommendation (short version)

Build the verifier around **today's Merkle Patricia Trie (MPT) proofs** — RLP-encoded
hexary-trie inclusion proofs against the execution block header's `stateRoot`, i.e. the
`eth_getProof` / EIP-1186 shape — and put them behind a **narrow, swappable
`StateBackend` interface**.

Do **not** build around Verkle. Verkle is the design Ethereum is genuinely moving *away*
from, and it is the single most likely thing to strand your pipeline.

Do **not** take a hard dependency on binary trees (EIP-7864) either — that *is* the real
direction of travel, but it is not scheduled for any fork yet, and even its hash function
is unsettled as of this month. Treat it as the thing your abstraction must be able to
absorb, not the thing you ship against.

The part that actually delivers your trust-minimization is **not** the trie format — it's
how you obtain an authentic block header. Spend your engineering budget there; the trie
is the replaceable half of the system.

---

## Where Ethereum's state layer actually stands today

Mainnet state is, and has been since Frontier, a **hexary Merkle Patricia Trie keyed by
`keccak256`**, with a separate storage trie per account rooted at `account.storageRoot`.
A storage-slot proof is therefore two nested MPT proofs:

1. `stateRoot → account RLP` (key = `keccak256(address)`), yielding
   `[nonce, balance, storageRoot, codeHash]`
2. `storageRoot → slot value` (key = `keccak256(slot)`)

This is what `eth_getProof` returns, and it is the **only** state commitment mainnet has
ever committed to. Nothing in the fork pipeline changes that in the near term:

- **Fusaka** (Dec 2025) — PeerDAS and friends; no state-tree change.
- **Glamsterdam** — currently targeted H2 2026, headliners EIP-7732 (ePBS, CL) and
  EIP-7928 (block-level access lists, EL), plus gas-repricing EIPs aimed at a 200M gas
  limit floor. **No state-tree change.**
- **Hegotá** — draft roadmap expects ~Q2 2027 (explicitly *not* confirmed); currently
  scheduled EIPs are FOCIL (EIP-7805) and Frame Transaction (EIP-8141).
  **EIP-7864 is not on the scheduled list.**

So: the hexary MPT is mainnet's state commitment today, and on any honest reading of the
fork calendar it remains the *live* commitment for at least the next several forks. An
MPT verifier you ship this quarter has a multi-year runway.

## Where it is genuinely going

**Verkle is dead as an L1 direction.** Verkle (EIP-6800 + the stateless bundle) was the
2023–2024 plan, and there is still a `ethereum.org/roadmap/verkle-trees` page floating
around, which is why people still wire proof pipelines to it. It lost on two grounds
that are not going to reverse:

- **Post-quantum exposure.** Verkle's vector commitments are IPA over the Banderwagon
  elliptic-curve group. That is a *binding* assumption resting on discrete log — a
  cryptographically relevant quantum computer forges state proofs. Hash-based Merkle
  commitments have no such exposure. Ethereum's whole late-roadmap posture (lean
  consensus, hash-based signatures, PQ-safe everything) is incompatible with committing
  state under an ECC assumption.
- **SNARK-unfriendliness.** Verkle proofs are expensive to verify *inside* a
  zkVM, which is exactly what the L1-zkEVM direction needs. Hash-based binary Merkle
  proofs are cheap to prove; meanwhile SNARK/STARK provers improved fast enough that the
  "Verkle gives small proofs without SNARKs" argument stopped being decisive.

**The replacement is EIP-7864, "Ethereum state using a unified binary tree."** Draft since
Jan 2025. Key properties that matter to you:

- A **single unified tree**: accounts, storage, and code collapse into one uniform
  32-byte-key / 32-byte-value space. Your current two-level (state trie → storage trie)
  proof shape disappears; a storage slot becomes *one* path in *one* tree.
- **Binary, not hexary** — branches roughly 4x shorter than today's, which is a direct
  bandwidth win for exactly your use case (this is cited explicitly as a light-client /
  Helios benefit).
- **Migration is two-step**: EIP-7864 starts the binary tree *empty* and freezes the MPT,
  with only new writes landing in the binary tree; a later fork (**EIP-7748**) migrates
  the frozen MPT contents over at a fixed stride of key-values per block.

**The longer-horizon direction is zk verification of execution itself** — the L1-zkEVM
track, with EIP-8025 letting validating nodes check block validity from proofs rather
than re-execution, against real-time proving targets (~10s latency for 99% of blocks,
<300 KiB proofs, ≤$100k / <10 kW hardware). This is research-stage, not in clients. It
matters to you only as a hint about the *eventual* endgame interface: a light client may
one day verify a succinct proof of the state root rather than walk a trie. Don't build
for it now; just don't architect in a way that forecloses it.

## Timing — how hard a dependency you can safely take

This is the part that should actually constrain your design:

1. **EIP-7864 has no fork.** Not in Glamsterdam. Not scheduled in Hegotá. The earliest
   plausible activation is a fork *after* Hegotá, i.e. realistically 2028+, and Hegotá's
   own ~Q2 2027 date is marked unconfirmed. Any schedule you hear is soft.
2. **The hash function is not chosen.** Current test implementations use **BLAKE3** to
   reduce client friction, with Keccak and Poseidon2 as other candidates and the decision
   explicitly TBD. More pointedly: in **August 2026** the EF (Justin Drake) announced it
   is **dropping Poseidon for L1** in favour of SHA/BLAKE-family hashes. (Poseidon was
   not broken, and the announcement carried no migration directive for existing rollups
   or zkVMs — but for L1 state it's settled the other way.) A proof verifier is a
   *hash-function-shaped* artifact: you cannot pre-build against a tree whose hash is
   still open.
3. **EIP-7748's conversion period is the real hazard, not the switch.** During migration
   there is an extended window where part of the state is in the frozen MPT and part is
   in the binary tree, with the stride able to pause mid-account (mid-storage, mid-code,
   mid-header). A verifier that assumes "one root, one tree, one proof" will be wrong for
   the entire conversion, which spans many blocks and possibly more than one fork.
   **Design the interface now so a slot lookup can resolve against either tree** — even
   though you won't implement the second backend for years.

Conclusion on dependency hardness: **take a hard dependency on MPT, a soft
(interface-level) dependency on binary trees, and no dependency at all on Verkle or on
zk-state-proofs.**

---

## What to actually build

### 1. Get the header trust-minimized — this is the real work

Verifying a storage slot against a `stateRoot` is worthless if you got the `stateRoot`
from the RPC you're trying not to trust. The trust anchor is the beacon chain:

- Run the **beacon light client sync-committee protocol** (Altair). You track sync
  committee handoffs from a weak-subjectivity checkpoint and verify BLS signatures from
  a supermajority of the 512-member committee over each finalized/optimistic header.
  This is the Helios model and it's the right one.
- From the verified beacon block, take `execution_payload_header` → `block_hash` and
  `state_root`. Post-Capella the execution payload header is in the beacon block body,
  so you get the execution `stateRoot` with no extra trust.
- If any part of your verifier runs **on-chain**, use **EIP-4788** (parent beacon block
  root exposed in the EVM) as the anchor instead, and **EIP-2935** for historical
  execution block hashes.
- Note that **ePBS (EIP-7732) in Glamsterdam restructures how the execution payload is
  committed on the CL side** — that is a Glamsterdam-timeframe (H2 2026) change to your
  *header* pipeline, and it lands far sooner than any state-tree change. Budget for it.

This layer is unchanged by any tree migration. That's why it's where the durable value is.

### 2. Define the swappable interface

```
trait StateBackend {
    // Verify a storage slot against a header-derived commitment.
    fn verify_slot(
        commitment: StateCommitment,   // not "stateRoot" — see below
        address: Address,
        slot: H256,
        proof: Witness,
    ) -> Result<H256 /* value, zero if proven-absent */>;
}
```

Three design rules, each of which is specifically about surviving EIP-7864/7748:

- **`StateCommitment` must be a struct, not a `bytes32`.** Model it as
  `{ mpt_root: Option<H256>, binary_root: Option<H256>, fork: ForkId }`. During the
  EIP-7748 conversion both are live. A `bytes32` state root in your public API is the
  single hardest thing to unwind later.
- **`Witness` must be an enum/tagged union**, versioned by fork, not a bare
  `Vec<Vec<u8>>` of RLP nodes. Today: `Witness::Mpt { account_proof, storage_proof }`.
  Later: `Witness::Binary { stem, subtree_proof }`. Serialize with an explicit
  discriminant from day one so old proofs remain parseable.
- **Don't leak the two-level (account trie → storage trie) shape into your API.** Under
  EIP-7864 accounts and storage share one tree; `storageRoot` as a distinct concept goes
  away. Callers should ask for `(address, slot) → value`, never for `storageRoot`.

Keep the keccak/RLP MPT verification itself in one small, well-tested module. It's a few
hundred lines. When binary trees land, you write a sibling module — you do not rewrite
the light client.

### 3. Sourcing proofs without an archive node

`eth_getProof` against a *recent* block (within the ~128-block window every full node
retains) works from an ordinary full node — you do not need an archive node for a
"recent block" product, which is what you described. Design around that window
deliberately:

- Pin every proof to a specific block number/hash and verify it against the
  sync-committee-derived header for *that* block. Never accept "latest."
- Fan out `eth_getProof` to 2–3 unaffiliated providers. Note that this is a liveness
  measure only — correctness already comes from the header, so a single honest-but-
  unavailable provider is the only failure mode multi-sourcing fixes.
- Handle proven-absence (null account, zero slot) explicitly in tests; MPT exclusion
  proofs are where light-client verifiers most often have bugs, and the binary-tree
  version of exclusion will differ.

### 4. What to explicitly not do

- **Don't implement Verkle.** Any Verkle code you write is a write-off.
- **Don't pre-implement EIP-7864.** The hash is undecided (BLAKE3 is a placeholder;
  Poseidon was dropped for L1 in Aug 2026). Anything you build now gets rewritten.
  Re-evaluate when a hash function is chosen *and* the EIP is CFI'd for a named fork.
- **Don't design an API that assumes a single `bytes32` state root.** See above — this is
  the one irreversible mistake available to you today.

## Watch list

| Signal | What it means for you |
|---|---|
| EIP-7864 hash function finalized (SHA/BLAKE family per Aug 2026 pivot) | Start prototyping the second backend |
| EIP-7864 CFI'd for a named fork | Begin real implementation; ~1 fork of lead time |
| EIP-7748 conversion parameters (stride) fixed | Size the dual-root window; hardest integration work |
| Glamsterdam / ePBS (EIP-7732) shipping, H2 2026 | **Near-term**: affects your header pipeline, not your trie |
| EIP-8025 / L1-zkEVM leaving research | Possible future third backend; no action for years |

## Bottom line

MPT proofs today, behind an interface shaped for EIP-7864's unified binary tree tomorrow,
anchored on a sync-committee header pipeline that survives both. Verkle is the design the
protocol is moving away from and is the answer you were right to be worried about picking.
Binary trees are genuinely where it's heading — but with no fork assignment and an open
hash-function decision, "heading toward" is the most you can safely encode, and you encode
it as an abstraction boundary, not as an implementation.

## Sources

- [EIP-7864: Ethereum state using a unified binary tree](https://eips.ethereum.org/EIPS/eip-7864)
- [EIP-7864 discussion, Fellowship of Ethereum Magicians](https://ethereum-magicians.org/t/eip-7864-ethereum-state-using-a-unified-binary-tree/22611)
- [Binary Tree — Ethereum stateless book](https://stateless.fyi/trees/binary-tree.html)
- [Completing the Circle: Transitioning from Verkle to Binary Trees in Ethereum (EthCC[8])](https://ethcc.io/agenda/completing-the-circle-transitioning-from-verkle-to-binary-trees-in-ethereum)
- [Towards Stateless Clients in Ethereum: Benchmarking Verkle Trees and Binary Merkle Trees with SNARKs](https://arxiv.org/pdf/2504.14069)
- [Verkle trees | ethereum.org](https://ethereum.org/roadmap/verkle-trees)
- [Glamsterdam | ethereum.org](https://ethereum.org/roadmap/glamsterdam/)
- [Glamsterdam: Ethereum's Next Hard Fork Explained (Kiln)](https://www.kiln.fi/post/glamsterdam-ethereums-next-hard-fork-explained)
- [Ethereum's Glamsterdam Upgrade Enters Final Devnet Phase (The Defiant)](https://thedefiant.io/news/blockchains/ethereum-glamsterdam-final-devnet-200m-gas-limit-target)
- [EIP-8081: Hegotá Network Upgrade Meta Thread](https://ethereum-magicians.org/t/eip-8081-hegota-network-upgrade-meta-thread/26876)
- [Hegota Upgrade EIP Proposal Timelines (Ethereum Foundation Blog)](https://blog.ethereum.org/2025/12/22/hegota-timeline)
- [EIP-7748 Tree conversion tests (HackMD)](https://hackmd.io/@jsign/tree-conversion-tests)
- [Ethereum Roadmap Drops Poseidon for SHA or BLAKE](https://postquantum.com/security-pqc/ethereum-roadmap-drops-poseidon/)
- [zkEVM for L1 block verification | ethereum.org](https://ethereum.org/roadmap/zkevm/)
- [Vitalik Buterin lays out a two-part plan to overhaul Ethereum's execution layer (The Block)](https://www.theblock.co/news/ecosystems/2026-03-01-vitalik-buterin-lays-out-a-two-part-plan-to-overhaul-ethereums-execution-layer-from-the-ground-up-391681)
