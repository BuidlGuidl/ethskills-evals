# State-proof format for a trust-minimized L1 light client

**Date of research: 2026-07-25.** Everything below is from primary sources (forkcast call
artifacts + EIP metadata, `ethereum/pm` call agendas, `ethereum/consensus-specs`,
`ethereum/EIPs`, EF blog). Protocol status changes; re-check before you freeze the design.

---

## Recommendation (short version)

**Build the verifier around hexary Merkle-Patricia Trie (MPT) proofs, keccak256, RLP —
i.e. `eth_getProof`-shaped account + storage proofs — anchored to an execution header you
obtained from a consensus-layer sync-committee light client.** That is what Ethereum's
state layer *is* today and what it will still be for every fork currently scheduled.

**Do not build around Verkle.** It is dead: EIP-6800 (verkle state tree), EIP-7612
(verkle overlay transition), EIP-7545 (verkle proof precompile) and EIP-7736 are all
`Stagnant`, with no fork relationship on any upgrade. Anyone telling you Verkle is coming
in 2026 is reading a 2023–2024 roadmap.

**The genuine direction of travel is a binary Merkle state tree** (EIP-7864, and the newer
EIP-8297 "Partitioned Binary Tree") with a proving-friendly hash. But it is **not scheduled
for any fork**, the spec is **not converged** (two competing drafts as of June 2026), and
**the hash function is explicitly undecided**. So: adopt it as a *design constraint on your
abstractions*, not as a dependency.

The single most important thing to get right is therefore **not** which tree you pick — it's
that your proof pipeline is **versioned by fork** behind an interface, because the *anchoring*
path (how you get a trustworthy state root at all) is changing in the very next upgrade, well
before the tree does. Details in "Timing" below.

---

## Where Ethereum's state layer actually stands today

| Layer | Reality as of 2026-07-25 |
|---|---|
| State tree | Hexary MPT, keccak256, RLP-encoded nodes. Unchanged since genesis. |
| Account proof | `eth_getProof` (EIP-1186 — `Stagnant` as an EIP, but universally implemented and specified in `execution-apis`) |
| Header commitment | `stateRoot` in the RLP execution header, post-state of that block |
| Anchoring, off-chain | Altair sync-committee light client protocol (`consensus-specs/specs/*/light-client/`), actively maintained — a `gloas/light-client/` spec exists and a `heze/` CL spec directory is already open |
| Anchoring, on-chain | EIP-2935 (last 8191 block hashes in a system contract; `Final`, live since Pectra) and EIP-4788 (beacon block root in the EVM; `Final`, live since Dencun) |
| Last shipped fork | Fusaka, 2025-12-03 (PeerDAS) |

Two things follow. First, the MPT is not a legacy format you'd be betting against — it is the
format the *new* proving stack is being built on. The L1-zkEVM effort (breakout call #06,
2026-07-08) is standardizing `engine_newPayloadWithWitness` execution witnesses and guest-API
standards against today's MPT state; zkEVM spec v0.50 is rebased on Glamsterdam. Nobody is
waiting for a tree change to ship real-time L1 proving.

Second, EIP-2935 + EIP-4788 mean the fully trust-minimized path already exists end-to-end today:
sync-committee light client → execution block hash → RLP header → `stateRoot` → MPT branch → slot.
No new protocol feature is required for your product to work.

---

## Where it's genuinely going

**Binary tree, unscheduled, unconverged.**

- **EIP-7864 — "Ethereum state using a unified binary tree"** — `Draft`, created 2025-01-20,
  `forkRelationships: []` on forkcast. Single logical binary tree; accounts, code and storage
  unified; ~75% shorter Merkle branches than the hexary MPT. The EIP text says outright: *"The
  hash function used in the current draft is not final. The current implementation uses BLAKE3
  to reduce friction for EL clients experimenting with this EIP, but the final decision remains
  TBD."* Candidates named: Keccak, Poseidon2.
- **EIP-8297 — "Partitioned Binary Tree"** — `Draft`, created **2026-06-11**, essentially the
  same author set (Buterin, Ballet, Feist, Hagopian, Wedderburn, …) plus Wei Han Ng and Carlos
  Perez. Different key layout: zone partitioning on the high 4 bits, storage occupying the upper
  half of the zone space rooted at depth 1. Also "hash function not final, BLAKE3 placeholder."
  Its EthMagicians thread has essentially no discussion yet.
- **EF Protocol Priorities Update for 2026** (2026-02-18) frames it exactly this way: state
  scaling is *"repricing and history expiry in the short term"* and *"a move to binary trees and
  statelessness in the long term."* No fork assignment, no date.

That a second, structurally different binary-tree spec appeared six weeks ago from the same
authors is the tell: the *direction* (binary, proving-friendly hash) is settled; the *format*
you would have to encode into a verifier is not. Key derivation, code layout, and the hash
function are all still live questions, and the hash choice is entangled with the post-quantum
proving-system work (PQ Interop #46, 2026-07-01, discussed the "Flock" binary-field system as a
*"candidate to replace Poseidon entirely"*).

**Corroborating signals that this is not near-term:**

- The prerequisites for a tree transition were pulled out of Glamsterdam on 2025-10-23 (ACDE #223):
  **EIP-6873 (preimage retention)** and **EIP-7667 (raise gas costs of hash functions)** both
  `Withdrawn`. Preimage retention is a hard prerequisite for converting the existing state —
  without it, conversion can't start.
- The **Stateless Implementers call** series has met only 6 times in 2026, dropped to monthly,
  and its last scheduled meeting was **#52 on 2026-06-01** — nothing scheduled in the ~8 weeks
  since. Its agendas were about EIP-8188 (last-written-block metadata, aimed at state expiry) and
  32-byte addresses, **not** tree conversion.
- Hegotá's headliner selection concluded in February 2026: **FOCIL (EIP-7805)** is the headliner;
  Frame Transactions and native AA are CFI'd. No tree EIP was even proposed as a headliner.

**Also not happening: SSZ-ification of execution data.** If you were considering betting on
SSZ-based proofs (the "Pureth" pitch — cryptographic proofs with every RPC response), don't.
EIP-7919 (Pureth Meta) is `Stagnant`, declined for Fusaka and withdrawn from Glamsterdam;
EIP-6404 (SSZ transactions) and EIP-6466 (SSZ receipts) were **declined** for Glamsterdam
(ACDE #225, 2025-12-04); EIP-7807 (SSZ execution blocks) was **declined** for Hegotá
(ACDE #232, 2026-03-12). The execution header stays RLP for the foreseeable future.

---

## Timing — and the dependency that will actually bite you

The tree change is a 2028+ concern at the earliest. Here is the arithmetic. Binary tree is not
in Glamsterdam (scoping complete, devnet-7 running). It is not in Hegotá (headliner selection
closed in February; the non-headliner submission deadline is **2026-08-06**, and no tree EIP has
been proposed against Meta EIP-8081). So the earliest possible fork is the one after Hegotá.
Glamsterdam is tracking for late 2026 / early 2027 — devnet-7 launched the week of 2026-07-14,
devnet-8 is planned before testnet graduation, and forkcast's own phase model puts ~74 days
between last devnet and mainnet via Sepolia and Hoodi. Forkcast lists Hegotá activation as
**2027**. Fork N+2 therefore lands 2028 at the earliest — *and that assumes the spec converges,
a hash is chosen, and a multi-month state conversion (EIP-7748-style) is designed, none of which
has a champion pushing a date right now.*

**But three things land much sooner, and two of them break a naive pipeline:**

**1. Glamsterdam / ePBS changes what a light client can prove — this one is real and close.**
This is the finding that should drive your architecture. In `consensus-specs/specs/gloas/light-client/sync-protocol.md`,
`LightClientHeader` is modified:

```python
class LightClientHeader(Container):
    beacon: BeaconBlockHeader
    # [Modified in Gloas:EIP7732]
    # Removed `execution`
    # [New in Gloas:EIP7732]
    execution_block_hash: Hash32
    execution_branch: ExecutionBranch
```

Today, a sync-committee light client hands you an `ExecutionPayloadHeader` containing
`state_root` **directly**. After Glamsterdam it hands you only `execution_block_hash` — and
that hash is proven against `signed_execution_payload_bid.message.parent_block_hash`, i.e. it
is learned from the **next** slot's bid, because under ePBS the payload is no longer in the
beacon block body.

Consequences for you, on the next fork, not in 2028:
- You must fetch the **full RLP execution header**, keccak it, check it against
  `execution_block_hash`, and read `stateRoot` out of it yourself. Your trusted-root extraction
  code changes shape.
- Your **freshness guarantee degrades by roughly one slot**. If "as of a recent block" is in
  your product spec or SLA, write the number down now with a post-Glamsterdam margin.

**2. Block-Level Access Lists (EIP-7928) — SFI for Glamsterdam, a bonus path.** Adds
`block_access_list_hash` to the execution header (keccak of the RLP-encoded BAL), recording every
touched account/slot with **post-transaction values**. For any slot *written* in a block, that's
a header-committed value you can verify without an MPT branch. Caveat: the BAL is hashed as one
blob, so verifying it means downloading the whole BAL — there's no per-slot branch. **EIP-8268
("Storage Roots in Block Access Lists")** would add per-account post-block storage roots
specifically so partially-stateful nodes can verify; it was PFI'd for Hegotá on 2026-07-16
(ACDE #241). Treat BALs as a possible optimization for hot, frequently-written slots — not as
your primary format.

One nuance on Glamsterdam status: per ACDE #241, the Glamsterdam EIPs have **not formally been
moved to SFI** yet — Pooja is confirming four testing milestones with the testing team first.
Scope is settled in practice (devnets are running these EIPs), but the paperwork isn't.

**3. EIP-7862 "Delayed State Root" — PFI for Hegotá, and a direct threat to your invariant.**
Proposed at ACDE #240 (2026-07-02): the header would carry the **pre-state** root instead of the
post-state root, so builders and provers don't have to hash state across thousands of candidate
blocks. If this ships, `header[N].stateRoot` no longer commits to the state *after* block N — you
would need `header[N+1]` to verify a slot as of block N. Related: **EIP-8341** (Partial Execution
Payload Commitments, PFI'd 2026-07-23) would strip the state root out of the ePBS bid commitment
entirely. Both are `Proposed`, neither is confirmed, Hegotá is a 2027 fork — but if your verifier
hardcodes "state root of block N = state after block N," write that assumption down as a named,
testable invariant rather than letting it diffuse through the codebase.

---

## What this means concretely for the build

1. **Ship MPT/keccak/RLP now.** `eth_getProof`-shaped account proof + storage proof, verified
   against `stateRoot`. This is correct today and stays correct through Glamsterdam and Hegotá.

2. **Put a versioned interface between "trusted root" and "proof verification."** Something like
   `verify(slot, proof, anchor) -> value`, where `anchor` carries a fork identifier. Two seams,
   both of which the protocol will actually exercise:
   - *Anchor acquisition:* pre-Gloas reads `state_root` from the light client header;
     post-Gloas resolves `execution_block_hash` → full header → `state_root`. **Write this seam
     before Glamsterdam ships.**
   - *Proof verification:* MPT today; a binary-tree verifier slots in later without touching
     the anchoring code.

3. **Keep the hash function a parameter, not a hardcode.** The one thing every binary-tree draft
   agrees on is that the hash is undecided. `keccak256` is your only implementation today; make
   it a named, swappable primitive rather than an assumption baked into node decoding.

4. **Don't put an immutable verifier on-chain.** If part of the verifier is a deployed contract,
   make it upgradeable or replaceable. Glamsterdam alone changes the anchoring path.

5. **Name your freshness invariant.** "State root of block N is the post-state of block N" and
   "a light client can see block N's state root during slot N" are both assumptions the protocol
   is actively discussing changing (EIP-7862, EIP-7732). Encode them as explicit, tested
   invariants so the failure is a red test rather than silently stale data.

6. **Ignore SSZ-based execution proofs and Verkle entirely** for this design cycle.

7. **Optional, later:** BAL-derived values (EIP-7928) for written slots post-Glamsterdam.
   Revisit if EIP-8268 gets CFI'd for Hegotá.

**What to track, with trigger conditions:**

| Watch | Trigger to act |
|---|---|
| Glamsterdam mainnet date + `gloas/light-client` spec | Anchoring-path rewrite. **Start now**, not at fork time |
| Hegotá non-headliner scope (deadline **2026-08-06**, decisions on ACDE through autumn) | EIP-7862 reaching CFI → your post-state invariant breaks |
| EIP-7864 vs EIP-8297 convergence + hash-function decision | Two drafts merging into one, or a hash being chosen, is the first real signal the tree is moving |
| Stateless Implementers call series restarting with conversion on the agenda | Tree work is live again |
| EIP-6873 (preimage retention) getting proposed for any fork | Hard prerequisite for conversion — if it isn't scheduled, the tree isn't either |

The way to be wrong here is to spend engineering effort now on a binary-tree verifier for a spec
that doesn't exist yet, while the sync-committee anchoring path silently breaks under ePBS in the
very next fork. Build MPT, build the seam, watch the list.

---

## Sources

- [forkcast.org](https://forkcast.org) — EIP fork relationships and ACD call artifacts
  (repo: [ethereum/forkcast](https://github.com/ethereum/forkcast), data current to 2026-07-25;
  ACDE #240 2026-07-02, ACDE #241 2026-07-16, ACDC #183 2026-07-23, PQ Interop #46 2026-07-01,
  L1-zkEVM breakout #06 2026-07-08)
- [ethereum/consensus-specs — `specs/gloas/light-client/sync-protocol.md`](https://github.com/ethereum/consensus-specs/blob/dev/specs/gloas/light-client/sync-protocol.md)
- [ethereum/pm](https://github.com/ethereum/pm) — call agendas (Stateless Implementer's Call #47–#52)
- [EIP-7864](https://eips.ethereum.org/EIPS/eip-7864), [EIP-8297](https://ethereum-magicians.org/t/eip-8297-partitioned-binary-tree/28776),
  [EIP-7928](https://eips.ethereum.org/EIPS/eip-7928), [EIP-2935](https://eips.ethereum.org/EIPS/eip-2935),
  [EIP-1186](https://eips.ethereum.org/EIPS/eip-1186)
- [Protocol Priorities Update for 2026 — EF Blog, 2026-02-18](https://blog.ethereum.org/2026/02/18/protocol-priorities-update-2026)
- [Checkpoint #8 — EF Blog, 2026-01-20](https://blog.ethereum.org/2026/01/20/checkpoint-8)
