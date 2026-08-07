# State-proof format for a trust-minimized L1 light client

**Date of research: 2026-07-25.** All fork/EIP statuses below were checked against primary
sources on that date (ethereum/pm `all-forks.json`, the Glamsterdam and Hegotá meta-EIPs in
ethereum/EIPs, ethereum/consensus-specs, and the ACD call artifacts published in
ethereum/forkcast). Protocol status decays fast — re-check before you freeze the design.

---

## Recommendation

**Build the verifier around Merkle-Patricia Trie (MPT) proofs — keccak256, RLP, hexary —
i.e. `eth_getProof`-shaped account + storage proofs verified against the execution header's
`stateRoot`. Anchor those headers with the beacon-chain sync-committee light client, not with
an RPC provider.**

Put that behind a narrow `StateProof` interface with an explicit proof-type tag from day one,
so a second backend (binary tree) can be added later without touching the rest of the
pipeline. That is ~200 lines of isolation, not an architecture.

The thing you actually need to engineer against in the next 12–18 months is **not** the tree.
It is a set of confirmed and near-confirmed changes to *where the state root lives and which
block it describes*. Those are detailed in section 4 and are the real design risk.

---

## 1. Where the state layer stands today

- **Live on mainnet:** Fusaka (Osaka/Fulu) activated 2025-12-03, followed by two blob-parameter-only
  forks, BPO1 (2025-12-09) and BPO2 (2026-01-07). None of these touched the state tree.
- **The account and storage tries are still the original hexary, RLP-encoded, keccak256 MPT.**
  Nothing scheduled changes that.
- **Next fork, Glamsterdam (Amsterdam/Gloas):** still in devnets. As of the ACD calls this month:
  devnet-7 launched the week of 2026-07-09 and is stable; devnet-8 targets early August;
  devnet-9 (non-finality/chaos) about a month out; **first public testnet targets September 2026**;
  all devnet-7 EIPs were ratified SFI at ACDC #183 on 2026-07-23. `all-forks.json` still lists
  Glamsterdam with `status: planned` and no activation timestamp. Realistic mainnet: **late 2026
  at the earliest, plausibly Q1 2027.**
- **Fork after that, Hegotá (Bogotá/Heze):** headliner is confirmed as FOCIL (EIP-7805, the only
  SFI in meta-EIP-8081). Non-headliner submission deadline is **2026-08-06**. Nothing state-tree
  related is even in its 28-entry "Proposed for Inclusion" list.

**Nothing in Glamsterdam's SFI list changes the state trie.** The SFI set is EIP-7708, 7732, 7778,
7843, 7928, 7954, 7976, 7981, 8024, 8037 — gas repricings, ePBS, block access lists, and EVM
odds and ends.

## 2. Verkle is dead — do not build on it

Every Verkle EIP is `Stagnant` in the EIPs repo:

| EIP | Title | Status |
|---|---|---|
| 6800 | Ethereum state using a unified verkle tree | **Stagnant** |
| 7736 | Leaf-level state expiry in verkle trees | **Stagnant** |
| 6873 | Preimage retention | **Stagnant** |
| 7748 | State conversion to Verkle Tree | Draft (orphaned — the conversion EIP for a dead target) |

The reasons are recorded in EIP-7864's rationale: Verkle "introduce[s] a new cryptography stack
to the protocol, which relies on elliptic curves that aren't post-quantum secure," against
expert estimates that quantum machines become real in the 2030s and NIST guidance to stop using
ECC by 2030. Verkle was also a poor fit for the ZK-proving direction the execution layer took.
If you find a 2023–2024 design doc telling you to build for Verkle polynomial-commitment
witnesses, it is stale.

## 3. The binary tree is the genuine direction — and has zero fork commitment

**EIP-7864, "Ethereum state using a unified binary tree"** is where the state layer is genuinely
heading. It is real work, not a rumour: created 2025-01-20, and last edited 2026-06-24, so it is
actively maintained. It replaces the hexary keccak MPT with a binary tree over a proving-friendly
hash, unifies account header / code / storage into one tree (no more "tree of trees"), and drops
RLP node encoding. Merkle branches get roughly 4× shorter, which is exactly the property a light
client wants. Its own rationale cites post-quantum safety: it depends only on hash functions.

But you cannot take a dependency on it, for four independent reasons:

1. **It is not scheduled anywhere.** It does not appear in meta-EIP-7773 (Glamsterdam) at all —
   not SFI, not CFI, not even in the *declined* list. It does not appear in meta-EIP-8081
   (Hegotá) — not SFI, not CFI, not among the 28 PFI entries. Status is still `Draft`.
2. **The hash function is undecided.** The EIP says so in bold: BLAKE3 is a placeholder "to reduce
   friction for EL clients experimenting with this EIP," with Keccak and Poseidon2 also candidates,
   and *"**Do not** assume BLAKE3 is a final decision."* If Poseidon2 wins, further specification
   is still needed for field selection and 32-byte-value encoding. Your verifier's hash primitive,
   circuit costs, and proof sizes all hang off this unresolved choice.
3. **The post-quantum decision it depends on is deliberately unresolved.** At ACDC #183
   (2026-07-23), EIP-8321 (hash-chain RANDAO) was refused PFI, with the recorded consensus that
   "full PQ approach must be decided before enshrining any iteration." The same logic gates the
   tree's hash choice.
4. **Even after it ships, the MPT does not go away for years.** EIP-7864 explicitly starts an
   *empty* binary tree, freezes the existing MPT, and defers migration to a *later* hard fork
   (a EIP-7748-style conversion, which currently only exists in its Verkle form). So there is a
   multi-fork window where state is split across both trees, plus a permanent need for MPT proofs
   over historical blocks.

**Timing conclusion:** it missed Glamsterdam, and it is not proposed for Hegotá whose submission
deadline is 2026-08-06 — so the earliest conceivable inclusion is the fork *after* Hegotá, with
conversion a fork or more after that. **A fully converted binary state tree on mainnet before
2028 would be fast.** Treat it as a plug-in backend to add later, never as a launch dependency.

## 4. What will actually break your verifier — anchor plumbing, not the tree

This is the part most light-client designs get wrong. These are the changes to track:

### Confirmed (SFI Glamsterdam) — ePBS changes the light-client header shape

EIP-7732 (enshrined PBS) rewrites the CL light-client protocol. In
`specs/gloas/light-client/sync-protocol.md`:

```python
class LightClientHeader(Container):
    beacon: BeaconBlockHeader
    execution_block_hash: Hash32      # [New in Gloas:EIP7732]
    execution_branch: ExecutionBranch # [Modified in Gloas:EIP7732]
    # `execution` (the full ExecutionPayloadHeader) is REMOVED
```

Two consequences you must design for:

- **You can no longer read `state_root` out of the light-client header.** You get only a block
  hash. The verifier must fetch the RLP execution header from an untrusted source, check
  `keccak256(rlp(header)) == execution_block_hash`, and only then use its `stateRoot`. That's a
  small extra step, but it must exist in your pipeline from the start.
- **The proven hash is `signed_execution_payload_bid.message.parent_block_hash`**
  (`EXECUTION_BLOCK_HASH_GINDEX_GLOAS = 2856`) — the *parent's* block hash. The EL block you can
  authenticate lags the beacon slot by one. Budget that into your "recent block" SLA.

### Confirmed (CFI Glamsterdam) — generalized indices move

EIP-7688 (forward-compatible / stable containers) changes the gindices the sync-committee proofs
use: `FINALIZED_ROOT` 169 → 735, `CURRENT_SYNC_COMMITTEE` 86 → 2945, `NEXT_SYNC_COMMITTEE`
87 → 2946, and the spec now selects them via `*_gindex_at_slot(slot)` helpers. **Never hardcode a
gindex.** Make every one of them a function of the slot's fork.

### Proposed for Hegotá — which block does `state_root` describe?

- **EIP-7862, "Delayed State Root"** (PFI'd for Hegotá at ACDE #240, 2026-07-02): `header.state_root`
  becomes the post-state of block *n−1*, i.e. the pre-state of block *n*. No new header fields —
  the *semantics* of an existing field change. The EIP states it plainly: *"Light clients
  experience one slot of additional latency for state proofs."*
- **EIP-8341, "Partial Execution Payload Commitments"** was presented at ACDC #183 (2026-07-23) as
  a competing alternative — the builder bids all EL header fields except the state root. Per the
  discussion on that call, it costs light clients no delay but gives provers less time.

Either could land. **So: make "which block does this root belong to" an explicit, fork-scheduled
function in your code, not an ambient assumption.** If EIP-7862 lands and your verifier assumes
`header[n].stateRoot` describes block *n*, you will silently serve off-by-one state.

### Confirmed (SFI Glamsterdam) — Block-Level Access Lists, and their limits

EIP-7928 adds `block_access_list_hash` to the header and gives per-block post-values for every
changed slot. EIP-8268 (PFI Hegotá) extends each changed account's BAL entry with its **post-block
storage trie root**, so partially-stateful nodes can rebuild the state-trie leaf.

Useful to you as a **verified change-feed** — you can learn, trustlessly, whether your slot moved
in a given block. But **it is not a compact proof format**: the header commits to
`keccak256(rlp(block_access_list))` over the *whole* list, with no Merkle branch into individual
entries, so verifying one slot means downloading and hashing the entire BAL for that block.
Use it as a freshness/invalidation signal alongside MPT proofs, not instead of them.

Note also that EIP-8268 — written in May 2026, proposed for the fork after next — specifies
"post-block **storage trie** root" in RLP. The protocol is still actively building MPT-shaped
machinery. That is your strongest single signal about the near-term direction.

### SSZ-ification (Pureth) — happening, but not to the state trie

EIP-7919 (Pureth Meta), EIP-6404 (SSZ transactions), EIP-6466 (SSZ receipts), and EIP-7745
(trustless log index) were all **Declined for Inclusion** in Glamsterdam. The successor,
EIP-8304 ("Trustless log and transaction index", created 2026-06-17), is PFI for Hegotá, and a
dedicated SSZ breakout call series runs biweekly — but its current scope is the Engine API and
transaction/receipt/log containers, not the account/storage trie. **Relevant only if you later
need to prove logs or receipts; irrelevant to storage-slot proofs.**

### L1 zkEVM — also being built on today's MPT

The L1-zkEVM breakout (spec v0.50, rebased on Glamsterdam devnet-6) is standardizing
**execution witnesses** and tracking Geth/Besu/ethrex witness compliance in Hive. The stateless
witness format that actually exists today is MPT-based. Meanwhile EIP-8025 ("Optional Execution
Proofs") is **Stagnant** — do not plan around in-protocol execution proofs arriving on a schedule.

## 5. Concrete design

**Proof core (build now):**
- Account proof: MPT branch from `header.stateRoot` to the account leaf → yields `storageRoot`.
- Storage proof: MPT branch from `storageRoot` to the slot.
- Wire format: `eth_getProof`. Proofs are self-verifying, so the RPC serving them is untrusted —
  that is the whole point, and you get it today with zero protocol dependency.

**Trust anchor (build now):**
- Beacon sync-committee light client (Helios-style), with fork-aware gindices.
- Bridge block hash → EL header via `keccak256(rlp(header))`, since that becomes mandatory
  post-Gloas and is harmless before it.
- On-chain anchoring, if a contract must verify: EIP-4788 (beacon block roots, live since Dencun)
  and EIP-2935 (historical block hashes in state, live since Pectra).

**Isolation boundary (build now, use later):**
```
StateProof {
  anchor: { block_number, block_hash, root, root_semantics }  // root_semantics: SELF | PARENT
  proof_type: MPT_KECCAK_HEXARY | BINARY_<hash>               // tagged, versioned
  path, nodes
  verify(anchor) -> Option<value>
}
```
Keep RLP decoding, nibble handling, and keccak node hashing strictly behind this. Three rules:
- **Exclusion proofs are the trap.** Proving a slot is *unset* works completely differently in the
  MPT (extension/branch-node reasoning) versus a binary tree. Do not let MPT node concepts leak
  into your public API or your "slot is zero" semantics.
- **Tag every cached/persisted proof with `proof_type` and the fork it was produced under.** During
  the eventual conversion window, both trees are live simultaneously *by design* (EIP-7864 freezes
  the MPT and starts an empty binary tree), so you will need to serve both at once.
- **Hardcode nothing** about gindices, header field positions, or the root→block mapping.

**Non-goals:** don't build a Verkle path; don't build a binary-tree path yet (the hash function
isn't chosen, so anything you write today is guesswork); don't rely on BALs as your proof format.

## 6. Trigger conditions to revisit

Re-evaluate when any of these happens — checking forkcast and the meta-EIPs directly, not blog posts:

1. EIP-7864 appears in a fork meta-EIP (PFI/CFI in the fork after Hegotá) — the first real signal.
2. The hash function is finalized (BLAKE3 vs Keccak vs Poseidon2) with test vectors — until then a
   binary-tree verifier cannot be written.
3. A binary-tree *conversion* EIP replaces the Verkle-era EIP-7748.
4. EIP-7862 or EIP-8341 gets CFI'd for Hegotá — that's when the root-semantics work becomes urgent.
5. Glamsterdam gets a mainnet activation timestamp in `all-forks.json` — that's your ePBS
   light-client-header deadline.

## Sources

Primary sources, all checked 2026-07-25:

- [ethereum/pm `all-forks.json`](https://github.com/ethereum/pm/blob/master/all-forks.json) — canonical fork activation status
- [EIP-7773 (Glamsterdam meta)](https://eips.ethereum.org/EIPS/eip-7773) · [EIP-8081 (Hegotá meta)](https://eips.ethereum.org/EIPS/eip-8081)
- [EIP-7864 (binary tree)](https://eips.ethereum.org/EIPS/eip-7864) · [EIP-6800 (verkle, Stagnant)](https://eips.ethereum.org/EIPS/eip-6800) · [EIP-7748 (verkle conversion)](https://eips.ethereum.org/EIPS/eip-7748)
- [EIP-7928 (BALs)](https://eips.ethereum.org/EIPS/eip-7928) · [EIP-8268 (storage roots in BALs)](https://eips.ethereum.org/EIPS/eip-8268) · [EIP-7862 (delayed state root)](https://eips.ethereum.org/EIPS/eip-7862)
- [consensus-specs `specs/gloas/light-client/sync-protocol.md`](https://github.com/ethereum/consensus-specs/blob/dev/specs/gloas/light-client/sync-protocol.md)
- ACD call artifacts via [forkcast.org](https://forkcast.org): ACDE #240 (2026-07-02), ACDE #241 (2026-07-16), ACDT #88 (2026-07-20), ACDC #183 (2026-07-23), L1-zkEVM breakout #6 (2026-07-08), SSZ Engine API breakout #3 (2026-07-24)

Two web searches were run at the start of this research; their results (news-site coverage of
EIP-7864) were not relied on for any claim above — everything is sourced from the repos and call
artifacts listed here.
