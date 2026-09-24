# Recommendation

Build the production verifier around Ethereum's current Merkle Patricia Trie
(MPT) state proofs, using `eth_getProof`/EIP-1186-style account and storage
proofs anchored to an independently verified execution block header
`stateRoot`. Architect the verifier so the state-accumulator backend is
swappable, and make the future backend a partitioned/unified binary state tree
backend, currently best represented by EIP-8297 (Partitioned Binary Tree, PBT)
and its migration companion EIP-8347.

Do **not** build a hard long-term dependency on Verkle proofs. Verkle was the
dominant statelessness plan for years, but the live protocol is not Verkle, the
Verkle state-tree EIP is now stagnant, and current state-tree work has moved
toward binary hash trees/PBT because they fit validity-proof work better and
avoid adding elliptic-curve vector commitments that would likely have to be
replaced for post-quantum reasons.

## Where Ethereum stands today

Today, Ethereum mainnet execution state is still committed by the hexary MPT:
the block header's `stateRoot` commits to the world-state trie, accounts contain
a `storageRoot`, and a storage-slot proof is a proof through the account trie
plus a proof through that account's storage trie. `eth_getProof` returns exactly
this shape: an `accountProof`, account fields including `storageHash`, and one
or more `storageProof` entries. The EIP-1186 rationale is the same trust model
you want: a proof plus a trusted block header lets a client verify account or
storage data without trusting the RPC server.

So for a service that verifies a specific L1 contract storage slot as of a
recent block, the deployable design is:

1. Get the block header/state root through an Ethereum light-client path, not by
   trusting the same RPC provider that supplies the proof. In practice this
   means a beacon light client or another independently verified finalized/safe
   header path.
2. Ask any RPC/proof source for `eth_getProof(address, [slot], block)`.
3. Verify the MPT account proof against the header `stateRoot`.
4. Verify the storage proof against the account's `storageHash`.
5. Prefer `finalized` or `safe` blocks for product semantics. `latest` is usable
   only if the caller accepts ordinary reorg risk.

This still does not require trusting the RPC provider for correctness. It only
relies on the provider for availability and on the provider retaining the recent
state needed to construct the proof.

## Where the state layer is going

The direction is no longer "Verkle is next, wire everything to Verkle." The
current direction is "replace the MPT with a simpler single logical binary hash
tree that is friendlier to witnesses, validity proofs, and future state
management."

The relevant line of work is:

- EIP-7864: a draft unified binary state tree replacing hexary Patricia tries.
  It explicitly says the hash function is not final and motivates binary trees
  on proof size, proving friendliness, and post-quantum considerations.
- EIP-8297: the newer draft Partitioned Binary Tree. It keeps the single-tree
  direction, partitions state into zones for account headers, code, and storage,
  removes the per-account `storage_root` concept, and says post-fork MPT proof
  consumers must adopt the new proof format.
- EIP-8347: a draft migration plan from MPT to PBT via an offline conversion,
  verifiable snapshot, BAL replay, shadow-root period, and a single activation
  fork. This is notable for light clients because its rationale avoids a hybrid
  verifier period: before activation, proofs are MPT; after activation, proofs
  are PBT.

This suggests a clean verifier architecture: support `mpt-v1` now; later add
`pbt-v1` keyed by activation fork/block. Avoid a middle "Verkle-first" proof
pipeline unless Ethereum actually reverses course and schedules Verkle.

## Timing and dependency risk

Do not treat PBT as available protocol yet. As of 2026-09-23:

- EIP-8297 is Draft and has no Forkcast fork relationship.
- EIP-8347 is Draft and has no Forkcast fork relationship.
- EIP-7864 is Draft and has no Forkcast fork relationship.
- EIP-6800, the unified Verkle tree proposal, is Stagnant and has no scheduled
  fork relationship.
- Glamsterdam is upcoming and includes Block-Level Access Lists work, which
  EIP-8347 wants to reuse for PBT catch-up, but Glamsterdam itself is not the
  PBT state-tree migration.

That means it is safe to design your abstractions around a future binary/PBT
state accumulator, but unsafe to freeze a PBT wire format, hash function, or
activation behavior as a hard dependency. EIP-8297 even says its hash function
is not fixed. Treat current PBT implementations/test vectors as research or
compatibility prototypes until the EIP is at least Scheduled for Inclusion for a
named fork and client devnets have converged.

## Practical recommendation

Commit the external proof API to an envelope, not a single permanent tree:

```text
chain_id
block_hash
block_number
state_root
finality_status
accumulator_kind = mpt | pbt
proof_payload
account
storage_slot
value
```

For now, `accumulator_kind = mpt` is the only mainnet-valid production format.
The payload should contain the RLP-encoded MPT account proof and RLP-encoded MPT
storage proof returned by `eth_getProof`, plus enough metadata to bind it to the
verified block header.

For the future, reserve `accumulator_kind = pbt`, but do not finalize its exact
serialization until EIP-8297/EIP-8347 or successors are scheduled. Your internal
interfaces should already avoid assuming `storageRoot` exists forever, because
PBT removes that structure. Model verification as "prove key/value membership
under this block's state accumulator" rather than "prove account then prove
storageRoot forever."

Bottom line: ship MPT proofs today, make the next backend binary/PBT, and avoid
Verkle as the thing you are betting the company proof pipeline on.

## Sources checked

- EIP-1186, `eth_getProof`: https://eips.ethereum.org/EIPS/eip-1186
- Ethereum Execution APIs, `eth_getProof`: https://ethereum.github.io/execution-apis/api/methods/eth_getProof/
- EIP-6800, unified Verkle tree, Stagnant: https://eips.ethereum.org/EIPS/eip-6800
- EIP-7864, unified binary tree, Draft: https://eips.ethereum.org/EIPS/eip-7864
- EIP-8297, Partitioned Binary Tree, Draft: https://eips.ethereum.org/EIPS/eip-8297
- EIP-8347, Offline State Migration to the PBT, Draft: https://eips.ethereum.org/EIPS/eip-8347
- Forkcast API records for EIPs 6800, 7864, 8297, 8347, and upgrades, checked
  2026-09-23: https://forkcast.org/llms.txt
