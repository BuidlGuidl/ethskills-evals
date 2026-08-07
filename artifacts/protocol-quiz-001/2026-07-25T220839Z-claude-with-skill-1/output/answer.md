# State-proof format for a trust-minimized L1 light client

**Date of research: 2026-07-25.** Protocol status changes; re-check before locking anything in.

---

## Recommendation (short version)

**Build the verifier around Merkle-Patricia Trie (MPT) proofs in the `eth_getProof` /
EIP-1186 shape, anchored to a state root you derive from the consensus-layer light
client (sync committees) — not from an RPC provider.** Put the proof format behind a
versioned interface with an explicit format discriminator so a binary-tree proof can be
added later as a second implementation.

**Do not build on Verkle.** It is the design Ethereum is actively moving *away* from.

**Do not take a hard dependency on binary trees either** — that *is* where the state
layer is genuinely heading, but it is not scheduled for any fork, so it cannot be a
launch dependency.

The near-term thing that will actually break your pipeline is not the trie. It's
**Glamsterdam's ePBS changing the light-client header so it no longer contains the
execution state root.** Budget engineering time for that; details in "Timing" below.

---

## Where the state layer actually stands today

Mainnet is post-Fusaka (activated 2025-12-03). Glamsterdam has not shipped yet.

The state layer on mainnet today is what it has always been:

- Hexary Merkle-Patricia Trie, Keccak-256 hashing, RLP node encoding.
- A "tree of trees": one account trie, plus a separate storage trie per contract, whose
  root sits inside the account leaf.
- Committed via `stateRoot` in the execution block header.
- Exposed via `eth_getProof` (EIP-1186 — formally `Stagnant` as a spec, but universally
  implemented by every EL client and every RPC provider).

This is the **only** state proof format that exists in production. There is no
alternative you could ship against today even if you wanted to.

## Where it is genuinely going: a unified binary tree

The direction is real and well-supported, but it is early-stage in fork terms.

| Design | EIP | Status (2026-07-25) | Fork status |
|---|---|---|---|
| Verkle tree state | EIP-6800 | **Stagnant** | none — abandoned |
| Verkle overlay transition | EIP-7612 | **Stagnant** | none |
| State conversion to Verkle | EIP-7748 | Draft, untouched since 2024 | none |
| Unified binary tree | EIP-7864 | Draft (created 2025-01-20) | **not CFI/SFI for any fork** |
| Partitioned binary tree | EIP-8297 | Draft (created **2026-06-11**) | **not CFI/SFI for any fork** |

**Verkle is dead as a target.** EIP-6800 and EIP-7612 are both marked `Stagnant` in the
EIPs repo, and the EF's own February 2026 protocol priorities post does not mention
Verkle at all — it describes the plan as "a move to binary trees and statelessness in
the long term." The reasons it was dropped: elliptic-curve vector commitments are
unfriendly to ZK proving circuits and are not post-quantum secure. If your architecture
docs reference Verkle, that's a 2023–2024 roadmap artifact. Delete it.

**Binary trees are the live design.** Note that EIP-7864 now has a successor/refinement:
**EIP-8297 "Partitioned Binary Tree"**, created 2026-06-11, authored by twelve people
including Vitalik Buterin, Guillaume Ballet, Dankrad Feist, Ignacio Hagopian, plus
engineers from multiple client teams (Nethermind, Besu, Lodestar). On 2026-07-23 an
EIP-8297 PR dropped its "EIP-7864 changes" section, i.e. the two specs are being
consolidated *right now*. If you read one spec, read EIP-8297, not EIP-7864 — but expect
both to keep moving.

What the binary tree changes, structurally, that matters to a verifier:

- Account trie and storage tries are **merged into one tree**. The "tree of trees" goes
  away, so the two-stage account-proof-then-storage-proof structure goes away with it.
- Contract code lives **in the same tree**, chunked.
- Keys are fixed-length and prefix-free, partitioned into *zones* (account header / code
  / storage) identified by the first key byte.
- Arity 2 instead of 16 → proofs shrink roughly 4x (EIP-8297 cites today's ~12-deep
  account trie producing `15 * 32 * 12 = 5760`-byte branches).
- **The hash function is explicitly not decided.** The spec says so in as many words:
  the reference implementation uses BLAKE3 "to reduce friction for clients
  experimenting," with Keccak and Poseidon2 still candidates. This is the single most
  important thing to *not* hardcode.

The motivation is validity proofs — making blocks cheap to prove in ZK — with
post-quantum safety as a secondary win (hash-based commitments stay safe; the pairing
crypto in Verkle does not).

## Timing — the part that constrains how hard a dependency you can take

**Binary tree: not scheduled. Earliest realistic mainnet is 2027+, and even then the MPT
does not disappear.**

- **Glamsterdam** (Gloas + Amsterdam) scope is effectively locked. As of the ACDE #241
  call on 2026-07-16, devnet-7 is running and client teams were asking to promote the
  devnet-7 EIP set to SFI. Headliners are EIP-7732 (ePBS) and EIP-7928 (Block-Level
  Access Lists), plus gas repricings (EIP-8037, EIP-7976, EIP-7981) and EIP-7954
  (contract size). **No state tree change.** Internal working target has been discussed
  as ~end of August 2026, but ePBS has been "trickier than anticipated" and past forks
  take 2–4 months of public testnet seasoning after that — treat Q4 2026 as the
  realistic window and don't plan around a specific date.
- **Hegota** (Bogota + Heze, the fork after): CL headliner is FOCIL (EIP-7805). The EL
  headliner slot did not go to a state tree change — Frame Transactions (EIP-8141) was
  rejected as headliner on the 2026-03-26 ACDE call and given plain CFI. The
  non-headliner window has closed as of the July calls. **Binary tree is not in Hegota.**
- So the earliest possible inclusion is the fork *after* Hegota, i.e. 2027 at the very
  earliest, with the usual caveat that unscheduled Draft EIPs slip.

**The good news for your bet:** the migration is specified to be *gradual and
coexisting*, not a flag day. EIP-7864's approach is that the new tree starts empty and
"the MPT continues to exist but is frozen," with conversion handled by a separate EIP
(the EIP-7748 pattern: convert a fixed number of key-values per block). Whatever the
final shape, there will be an extended period where both structures are live and the
header still commits to a state root. **MPT proofs are not a cliff you fall off.** They
are the only thing shippable now, and they will keep working through the transition.

### The actual near-term break: Glamsterdam's ePBS changes your anchor

This is the timing risk people miss, and it hits the *anchor*, not the trie. From
`consensus-specs/specs/gloas/light-client/sync-protocol.md`:

```python
class LightClientHeader(Container):
    beacon: BeaconBlockHeader
    # [Modified in Gloas:EIP7732]
    # Removed `execution`
    # [New in Gloas:EIP7732]
    execution_block_hash: Hash32
    execution_branch: ExecutionBranch
```

Three concrete consequences:

1. **You lose direct access to `state_root`.** Today `LightClientHeader.execution` is a
   full `ExecutionPayloadHeader` containing `state_root` — you read it straight out of
   the verified header. Post-Gloas that field is gone, replaced by a bare
   `execution_block_hash`. Your pipeline must now fetch the RLP execution block header
   from somewhere, check `keccak256(rlp(header)) == execution_block_hash`, and *then*
   read `stateRoot`. That's a new (untrusted-input, self-verifying) fetch step you don't
   have today.
2. **You anchor one slot behind.** `EXECUTION_BLOCK_HASH_GINDEX_GLOAS` points at
   `signed_execution_payload_bid.message.parent_block_hash` — the *parent* payload's
   hash. Combined with ePBS's delayed execution, "as of a recent block" gets ~one extra
   slot of latency. If your product promises a freshness bound, it needs to widen.
3. **Hardcoded generalized indices break at the fork epoch.** EIP-7688 shifts them:
   `FINALIZED_ROOT_GINDEX` 169 → 735, sync committee 86/87 → 2945/2946. The spec makes
   these slot-conditional (`finalized_root_gindex_at_slot`). Write yours slot-conditional
   from day one or your client hard-stops at the fork.

Also worth tracking, both adjacent to your use case:

- **EIP-7928 (BALs, shipping in Glamsterdam)** gives a second, cheaper verification path:
  the block header commits to the block access list, which exposes per-slot *post-values*
  for everything touched in that block. For a hot slot written frequently, that can beat
  a full MPT proof. It does not replace state proofs — it only covers slots actually
  touched in that block.
- **EIP-8268 (storage roots in BALs)** was proposed for Hegota on the 2026-07-16 ACDE
  call, with a working go-ethereum implementation. It adds post-block storage trie roots
  to BAL entries so partially-stateful nodes can assemble account leaves without holding
  full storage tries. Directly relevant if you ever want to serve proofs yourself rather
  than only consume them.

---

## What to actually build

**Anchor (this is the trust-minimization, not the proof format):**
Run a consensus-layer light client — Altair sync committees, Helios as the reference
implementation. Sync committee signatures → finalized beacon header → execution block
hash → execution header → `stateRoot`. Never accept a state root from an RPC endpoint.
The proof format is interchangeable; the anchor is what makes the system trust-minimized,
and it is where your engineering effort should concentrate.

**Proof:**
EIP-1186 MPT account proof + storage proof, verified against that `stateRoot`.

**Design so the binary tree is a drop-in, not a rewrite:**

1. **Version the wire format from day one.** Tag every proof with an explicit
   discriminator (`mpt-keccak-v1`). `binary-v1` then becomes additive, and you can serve
   both during the conversion period — which you *will* have to do, since conversion is
   gradual.
2. **Make the verifier interface `(address, slot) → value`, not "account proof plus
   storage proof."** The two-level structure is an MPT artifact; the binary tree merges
   both into one proof over one tree. If that nesting leaks into your API, the migration
   becomes a rewrite. Take a list of requested keys and return values.
3. **Don't hardcode the hash function.** Keccak today; BLAKE3, Keccak, or Poseidon2
   tomorrow — genuinely undecided per the spec text. Parameterize it.
4. **Don't hardcode key derivation.** MPT paths are `keccak(address)` / `keccak(slot)`
   into separate tries; the binary tree uses zone-prefixed keys in one tree. Keep this in
   one swappable module.
5. **Make gindices slot-conditional** (see ePBS point 3 above).
6. **Multi-source the proof data.** Proofs are self-verifying, so the residual risk from
   a provider is *availability and censorship*, not correctness — a lying provider gets
   caught by your verifier. Query 2+ independent providers; watch the Portal Network's
   state network as a P2P source, though don't depend on it yet.
7. **Don't design for deep historical proofs from public RPC.** History expiry has
   already removed pre-Merge data from full nodes. Recent-block proofs (your stated use
   case) are fine; archive-depth proofs are a different, harder product.

**Sequencing:** ship MPT now → do the Glamsterdam light-client upgrade when Gloas hits
testnets (this is real, near-term, scheduled work) → add the binary-tree verifier as a
second format only once EIP-8297 reaches CFI for a named fork and the hash function is
settled.

---

## What would change this recommendation

- EIP-8297 (or EIP-7864) reaching **CFI** for a named fork on forkcast — that's the
  signal to start the second verifier implementation.
- The hash function decision landing (BLAKE3 vs Keccak vs Poseidon2) — until then, any
  binary-tree code you write is provisional.
- The 7864/8297 consolidation resolving into one canonical spec.
- The Glamsterdam light-client spec changing again before mainnet — the gloas
  `sync-protocol.md` is in the `dev` branch of consensus-specs and can still move.

Track: [forkcast.org](https://forkcast.org) for CFI/SFI status, the ACDE agenda issues in
[ethereum/pm](https://github.com/ethereum/pm), and `specs/gloas/light-client/` in
[consensus-specs](https://github.com/ethereum/consensus-specs).

---

## Sources

Primary (checked directly):
- [ethereum/consensus-specs — `specs/gloas/light-client/sync-protocol.md`](https://github.com/ethereum/consensus-specs/blob/dev/specs/gloas/light-client/sync-protocol.md)
- [ethereum/pm ACDE #241 (2026-07-16) and #242 (2026-07-30) agendas](https://github.com/ethereum/pm/issues/2157)
- [ethereum/pm ACDE #233 (2026-03-26) — Hegota headliner selection](https://github.com/ethereum/pm/issues/1970)
- [EIP-8297: Partitioned Binary Tree](https://eips.ethereum.org/EIPS/eip-8297)
- [EIP-7864: Ethereum state using a unified binary tree](https://eips.ethereum.org/EIPS/eip-7864)
- [EIP-7748: State conversion to Verkle Tree](https://eips.ethereum.org/EIPS/eip-7748) (Draft, stale)
- EIP status fields via the ethereum/EIPs repo: EIP-6800 (Stagnant), EIP-7612 (Stagnant), EIP-7928 (Review), EIP-7805 (Draft), EIP-1186 (Stagnant), EIP-7688 (Review), EIP-7862 (Draft)
- [EIP-8268 discussion: Storage roots in Block Access Lists](https://ethereum-magicians.org/t/eip-8268-storage-roots-in-block-access-lists/28585)
- [EF: Protocol Priorities Update for 2026](https://blog.ethereum.org/2026/02/18/protocol-priorities-update-2026)
- [EF: Checkpoint #9, Apr 2026](https://blog.ethereum.org/2026/04/10/checkpoint-9)

Secondary (web search — used for dates and call outcomes, lower confidence):
- [Glamsterdam final devnet stage / timing](https://cryptobriefing.com/ethereum-glamsterdam-upgrade-final-devnet/)
- [Frame transactions declined as Hegota headliner](https://cryptonews.com/news/vitalik-frame-transactions-hegota-headliner/)
- [Hegota roadmap coverage](https://www.theblock.co/post/383275/ethereum-developers-name-post-glamsterdam-upgrade-hegota-as-2026-roadmap-takes-shape)

Note: forkcast.org is client-side rendered and could not be scraped, so fork status was
verified against the EIPs repo status fields, ethereum/pm call agendas, and
consensus-specs directly. Timing claims (Glamsterdam mainnet target) come from secondary
reporting and should be treated as soft.
