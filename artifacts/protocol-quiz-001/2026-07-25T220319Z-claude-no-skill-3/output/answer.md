# State-proof format recommendation for the light client

*Written 2026-07-25. Everything below is stated as of that date; the watch list at the end
is what would change the answer.*

## Bottom line

**Build the verifier against today's hexary Keccak Merkle-Patricia Trie proofs (EIP-1186 /
`eth_getProof`), and structure the proof pipeline so the state-proof backend is a
fork-versioned, swappable module whose *next* implementation is EIP-7864's unified binary
tree.**

Do not build anything Verkle-shaped. Do not take a hard dependency on the binary tree
either — it is real and it is the genuine direction of travel, but it is not scheduled into
either of the next two hard forks, its hash function is still undecided, and it arrives
behind a gradual state conversion rather than a flag day.

The short version of the reasoning: the format Ethereum is moving *toward* is a binary
Merkle tree over a zk-friendly hash, and the format it is moving *away from* is Verkle. But
"moving toward" here means 2027 at the earliest, so the format you must actually ship
against today is the MPT. The design work worth doing now is the abstraction boundary, not
the future verifier.

## Where the state layer actually stands today

Mainnet state is still a hexary Merkle-Patricia Trie, Keccak-256 hashed, RLP-encoded, keyed
by `keccak256(address)` for accounts and `keccak256(slot)` for storage (a "secure trie").
Proving a storage slot is a two-hop operation and this is what `eth_getProof` (EIP-1186)
returns:

1. An account proof: RLP-encoded trie nodes from the block's `stateRoot` down to the
   account leaf, yielding `{nonce, balance, storageHash, codeHash}`.
2. A storage proof: trie nodes from that account's `storageHash` down to the slot.

Nothing in the recent or scheduled fork sequence touches this:

| Fork | Timing | State-tree impact |
|---|---|---|
| Fusaka | Live on mainnet 2025-12-03 | None. Headliner was PeerDAS (EIP-7594) — blob DA, not state. |
| Glamsterdam | H2 2026 (final devnets ran June 2026) | None. Headliners are ePBS (EIP-7732) and Block-Level Access Lists (EIP-7928), plus a gas/state repricing cluster. |
| Hegotá | Late 2026 / early 2027 | None announced. Headliner is FOCIL (EIP-7805), with account abstraction in the minor set. |

So for every block your verifier will see between now and, realistically, 2027+, the state
commitment is the MPT. The MPT is not a legacy format you are grudgingly supporting — it is
the only format that verifies mainnet state, and it will remain so past any planning horizon
you can responsibly commit to.

One thing that helps you: MPT proofs are *self-verifying* against a `stateRoot` you obtained
independently. An untrusted RPC provider cannot lie to you about a slot; it can only refuse
to serve. That means your trust-minimization property is already achieved today with the
current format, and the binary tree buys you proof *size* and *proving cost*, not
trustlessness you don't already have.

## Where it is genuinely going: binary Merkle, not Verkle

Verkle trees were, for several years, the stated answer — a unified tree with polynomial
(vector) commitments, ~1–2 KB witnesses instead of ~150 KB, aimed at statelessness. That
plan has been abandoned in favor of a binary Merkle tree. The evidence is consistent across
sources:

- **EIP-6800** ("Ethereum state using a unified verkle tree") sits at status **Stagnant**.
  Its companion EIPs (4762 access events, 7612 overlay transition, 7748 conversion) are all
  written against Verkle and have not been carried forward.
- **EIP-7864** ("Ethereum state using a unified binary tree", draft since 2025-01-20) is the
  live proposal, with active client work and reference implementations.
- The transition was presented publicly as a direction change, not a parallel track — e.g.
  the EthCC[9] talk "Completing the Circle: Transitioning from Verkle to Binary Trees in
  Ethereum."
- The EF's Feb 2026 protocol priorities describe state scaling as "repricing and history
  expiry in the short term, and a move to **binary trees** and statelessness in the long
  term." Verkle is not mentioned.

Two reasons drove the switch, and both matter for how durable the new direction is:

1. **Post-quantum.** Verkle's commitments rest on elliptic-curve assumptions
   (IPA over Bandersnatch). A binary Merkle tree rests only on a hash function, which is
   quantum-safe under standard assumptions. Ethereum's broader "Lean" direction — replacing
   BLS validator signatures with hash-based ones (leanXMSS), SNARK-aggregated via a minimal
   zkVM — is explicitly hash-only. Verkle was structurally out of step with that.
2. **Proving.** STARK/SNARK throughput improved enough that hashing inside a circuit became
   viable, which was the original reason Verkle looked necessary. A binary tree with a
   zk-friendly hash is now the cheaper thing to prove, and it composes with the L1 zkEVM work.

**A stale-source warning specifically worth flagging:** `ethereum.org/roadmap/verkle-trees/`
still reads as though Verkle is on track ("Verkle tree testnets are already up and
running..."). That page has not been updated to reflect the direction change. If anyone on
your team validates this decision against that page, they will reach the wrong conclusion.
Ground it in the EIP statuses and the EF priorities post instead.

### What EIP-7864 actually looks like

Worth knowing now, because it determines where your abstraction boundary should sit:

- One **unified** tree. Account header data, code, and storage all live in the same tree —
  no separate per-account storage trie, so no second-hop `storageHash`.
- Keys are 32 bytes in a prefix-free layout: 1 byte storage type (header = 0, code = 1,
  storage = 255) + 31-byte stem + 1-byte subindex (0–255).
- Related data is co-located: an account's basic data (version, balance, nonce, code size),
  its first 16 code chunks, and its first 4 storage slots share a stem — so proving a "hot"
  slot costs roughly one branch, not two.
- Node hashing: internal nodes are `hash(left || right)`; stem nodes are
  `hash(stem || 0x00 || subtree_hash)`.
- Arity 2 instead of 16 shortens branches ~3–4× and cuts proof size roughly 75% vs. the MPT.

The hash function is **not decided**. The reference implementation uses BLAKE3 to reduce
friction for client teams experimenting; Keccak and Poseidon2 are the other candidates.
Poseidon2 is the one that delivers the large proving-efficiency win, and its security review
is gated on the EF's Poseidon Cryptanalysis Initiative — Phase 1 wrapped December 2025,
Phase 2 runs through December 2026. **You cannot write the leaf-hashing code until that
lands.**

## What this means for your verifier, concretely

### 1. Ship MPT now, behind an interface

One boundary, selected by fork/block number rather than by a config flag:

```
verify_storage(state_root, address, slot, proof, fork) -> Option<U256>
```

Take the boundary at `(address, slot)` — **not** at a pre-hashed key. The MPT hashes keys
(`keccak256(address)`) as a secure-trie property; EIP-7864 derives keys through a completely
different `tree_key(address, type, index)` construction and merges storage into the same
tree. An interface that accepts "hashed key + proof" bakes in an MPT-only assumption and
will not survive the transition. An interface that accepts an address and a slot will.

### 2. Parameterize the hash, don't hardcode Keccak

Keccak-256 appears in your trie walker in two distinct roles today (node hashing and key
derivation) and both change. Thread the hash in as a parameter so that swapping to
BLAKE3/Poseidon2 later is a wiring change, not a rewrite.

### 3. Version every proof you persist or cache

Tag proofs with `(format_id, fork, block_number)`. A proof is only meaningful against the
state root of a specific block under a specific format. If you're planning to hand proofs to
dApps as durable attestations, that format tag needs to be in the wire format from day one —
retrofitting a version byte after you have integrators is the expensive kind of mistake.

### 4. Write zero Verkle code

No IPA, no Bandersnatch, no polynomial-commitment dependency. If any library you're
evaluating advertises Verkle-readiness as a feature, that is not a point in its favor.

### 5. Plan for a dual-format window, not a flag day

The transition design (per EIP-7864's own framing and the conversion approach in EIP-7748)
is: freeze the MPT, start the new tree empty, write new/touched state into it, and sweep the
frozen MPT across into it over many blocks with a bounded per-block stride. That means a
window — likely months — where a given slot may live in either structure and your verifier
needs both backends live simultaneously, with a rule for which to consult. Budget for that
window as a distinct project phase; it is more work than the binary verifier itself.

Note that EIP-7748 as currently written is Verkle-worded and unrevised since July 2024. The
mechanism carries over conceptually, but the actual conversion spec for the binary tree does
not exist in final form yet. Don't plan against its details.

### 6. The thing that will actually break you first is ePBS, not the state tree

This is the near-term item worth more of your attention than the binary tree. Glamsterdam
(H2 2026) enshrines proposer-builder separation via EIP-7732, which **removes
`ExecutionPayload` from `BeaconBlockBody`**, replacing it with a builder's
`SignedExecutionPayloadHeader` commitment; the payload is revealed separately and its
timeliness is attested by a Payload Timeliness Committee.

Your light client gets the execution `stateRoot` by taking a sync-committee-verified beacon
block root and walking an SSZ Merkle proof down to the execution payload header. That path
changes under ePBS: the generalized indices move, and there is a new state in which a beacon
block exists but its payload has not been revealed. Two implications:

- Treat SSZ generalized indices as **fork-parameterized constants**, the same way you're
  treating the state-proof backend. Hardcoded indices are a guaranteed Glamsterdam outage.
- Your "state as of the recent head" semantics need a defined behavior for payload-withheld
  slots.

I'd flag this one as *verify before you build*: confirm the exact light-client changes
against the final `consensus-specs` light client protocol updates for Glamsterdam rather
than against the EIP text, since the light-client-facing details are specified there and
were still moving through devnets as of June 2026.

### 7. Don't neglect the header-trust half

The state proof is only as good as the `stateRoot` you check it against. That comes from the
Altair sync-committee light client protocol — 512 validators, rotating every ~27 hours. Its
known weakness is that it is a committee signature, not full consensus: for anything
high-value, prefer finality updates over optimistic head updates, and consider requiring
agreement across independent providers for the update itself (proofs are self-verifying;
*updates* are the part where a provider can mislead you). This module is also on a change
path — sync-committee BLS is slated for replacement by hash-based signatures in the Lean
direction — so it deserves the same fork-versioned treatment.

### 8. Two practical notes

- `eth_getProof` against a full node only serves roughly the last 128 blocks of state. Since
  your requirement is "a recent block," you're fine without archive nodes — but pin an
  explicit max-staleness and fail closed past it rather than silently falling back.
- If any part of this verification needs to happen on-chain, EIP-2935 (shipped in Pectra)
  exposes the last 8191 block hashes to contracts, which gives you an in-EVM anchor without
  trusting an oracle for block hashes.

## Timing: how hard a dependency can you take?

**Soft. Design toward the binary tree; do not build against it yet.**

- It is not scheduled for Glamsterdam (H2 2026) and not scheduled for Hegotá (late 2026 /
  early 2027). The EF's own Feb 2026 framing places binary trees and statelessness in the
  "long term" bucket, behind repricing and history expiry.
- The hash function decision is gated on Poseidon cryptanalysis Phase 2, which concludes
  December 2026 at the earliest. A core spec parameter that isn't chosen yet is not something
  to write code against.
- After a decision, the sequence is: spec finalization → multi-client implementation →
  devnets → testnets → fork inclusion → mainnet → a months-long state conversion.

Earliest plausible mainnet activation is the fork *after* Hegotá — 2027 — and given the
sequence above, slipping past that is more likely than hitting it. Ethereum's state tree has
been "about to change" since 2021; the direction is now credible in a way Verkle's late
stages were not, but the schedule deserves no more confidence than any other multi-fork
protocol change.

Practical rule: **do not ship a binary-tree verifier until the hash function is final and
EIP-7864 is Scheduled-for-Inclusion in a named fork with running devnets.** Until then the
correct investment is the abstraction boundary, which costs you days now and saves a rewrite
later.

### The third backend, further out

Longer term, the natural endpoint for a client like yours isn't a Merkle branch at all — it's
verifying a validity proof over the block, with the L1 zkEVM. The EF is advancing the zkEVM
attester client "from prototype toward production readiness," and Glamsterdam's timing
changes are partly about widening the window real-time proving needs. That would let you
verify state without walking any tree. It's a third backend to keep the interface honest
about — not something to build now, but a reason not to assume "Merkle branch" is a permanent
shape in your type signatures.

## Watch list

Things that would change this recommendation, in rough order of how much:

1. **Hash function decision** for EIP-7864 (ACD calls; gated on Poseidon Initiative Phase 2,
   Dec 2026). Unblocks writing the binary verifier.
2. **EIP-7864 CFI/SFI into a named fork** — the first real timing signal.
3. **A binary-specific conversion EIP** replacing/superseding the Verkle-worded EIP-7748.
   Determines the shape of your dual-format window.
4. **Glamsterdam light-client changes in `consensus-specs`** — near-term and mandatory for
   you regardless of anything above.
5. **zkEVM attester client reaching production** — would open the validity-proof path.

## Sources

- [EIP-7864: Ethereum state using a unified binary tree](https://eips.ethereum.org/EIPS/eip-7864)
- [EIP-6800: Ethereum state using a unified verkle tree](https://eips.ethereum.org/EIPS/eip-6800) (status: Stagnant)
- [EIP-7748: State conversion](https://eips.ethereum.org/EIPS/eip-7748) (Verkle-worded, unrevised since 2024)
- [EIP-7732: Enshrined Proposer-Builder Separation](https://eips.ethereum.org/EIPS/eip-7732)
- [Protocol Priorities Update for 2026 — Ethereum Foundation](https://blog.ethereum.org/2026/02/18/protocol-priorities-update-2026)
- [Checkpoint #9: Apr 2026 — Ethereum Foundation](https://blog.ethereum.org/2026/04/10/checkpoint-9)
- [Fusaka Mainnet Announcement — Ethereum Foundation](https://blog.ethereum.org/2025/11/06/fusaka-mainnet-announcement)
- [Binary Tree — Ethereum stateless book](https://stateless.fyi/trees/binary-tree.html)
- [Completing the Circle: Transitioning from Verkle to Binary Trees in Ethereum — EthCC[9]](https://ethcc.io/archives/completing-the-circle-transitioning-from-verkle-to-binary-trees-in-ethereum)
- [Poseidon Cryptanalysis Initiative](https://www.poseidon-initiative.info/)
- [Lean Consensus Roadmap](https://leanroadmap.org/)
- [Glamsterdam headliners finalised — EtherWorld](https://etherworld.co/glamsterdam-headliners-finalised/)
- [Ethereum developers name post-Glamsterdam upgrade 'Hegota' — The Block](https://www.theblock.co/post/383275/ethereum-developers-name-post-glamsterdam-upgrade-hegota-as-2026-roadmap-takes-shape)
- [Building Helios: Fully trustless access to Ethereum — a16z crypto](https://a16zcrypto.com/posts/article/building-helios-ethereum-light-client/)
