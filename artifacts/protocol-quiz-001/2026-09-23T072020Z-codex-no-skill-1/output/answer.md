# Recommendation: use MPT proofs now, design the next verifier around binary state-tree witnesses, not Verkle

As of September 23, 2026, the only proof format you can safely build a production
Ethereum mainnet storage-slot verifier around is the current hexary
Merkle-Patricia Trie proof rooted in the block header's `stateRoot`.

Concretely, ship an EIP-1186-style verifier today:

- verify the execution block header/state root through your consensus/light-client
  path, not by trusting the RPC that returned the proof;
- verify the account proof from `stateRoot` to the account leaf keyed by
  `keccak256(address)`;
- extract the account's `storageRoot`;
- verify the storage proof from `storageRoot` to the storage slot leaf keyed by
  `keccak256(slot)`;
- treat absence as zero, with proper MPT non-inclusion verification.

That is the format Ethereum mainnet actually uses today. A future-facing system
should make this one implementation of a versioned `StateProof` interface rather
than baking MPT node/RLP assumptions through the whole product.

For the format Ethereum is genuinely heading toward, align the abstraction with
hash-based binary state trees, especially the current unified/partitioned binary
tree line of proposals, not Verkle. Do not make Verkle/KZG witnesses your long-term
core format.

The reason is that Ethereum's state roadmap has moved. Older documentation and
older EIPs describe Verkle trees as the statelessness path, and Verkle was the
dominant plan for years. But current Ethereum research now says the long-term plan
is to replace the hexary MPT with a binary tree that produces smaller proofs and
supports statelessness; it explicitly notes that earlier work assumed Verkle, while
the current proposal is a unified binary tree. The Ethereum Foundation's 2026
protocol priorities similarly describe state scaling as short-term repricing and
history expiry, and long-term movement to binary trees and statelessness.

The current binary-tree proposals are still moving targets:

- EIP-7864, "Ethereum state using a unified binary tree", is a Draft core EIP. It
  replaces the account/storage trie-of-tries with one binary key/value tree,
  includes account header data, code, and storage in the state commitment, removes
  RLP from the state tree, and is designed for smaller ordinary Merkle proofs and
  better proving-system compatibility. It also says the final hash function is not
  settled.
- EIP-8297, "Partitioned Binary Tree", is a newer Draft core EIP in the same
  direction. It keeps the design hash-based rather than elliptic-curve-based, which
  is important for post-quantum resilience and avoids one of the reasons Verkle has
  become less attractive.
- EIP-8347 proposes migrating existing MPT state into the PBT off the
  consensus-critical path and switching the canonical state commitment at a single
  hard fork. If that path wins, light clients and bridge verifiers get a clean
  boundary: MPT before the activation fork, PBT after it, rather than a long-lived
  hybrid proof format. But this is also Draft and has no activated fork block.

So the practical dependency decision is:

1. Hard dependency today: MPT/EIP-1186-compatible account and storage proofs.
2. Architectural direction: a versioned proof/witness layer that can add a binary
   tree backend.
3. Avoid hard dependency: Verkle-specific proof formats, KZG/vector-commitment
   witnesses, or Verkle overlay assumptions.
4. Avoid hard dependency for now: exact binary-tree constants, hash function, key
   layout, migration fork, or proof serialization. Those are not final enough yet.

For your use case, I would define the verifier boundary around "a proof of a
state key against a finalized execution block header", with an explicit proof type
and fork context:

```text
StateProof {
  chain_id
  block_hash / block_number
  state_root
  proof_type: mpt_hexary_v0 | binary_state_tree_vN
  account/address
  storage_slot
  claimed_value
  proof_bytes
}
```

Internally, keep MPT RLP decoding, trie path nibble handling, and account/storage
two-step verification isolated in the `mpt_hexary_v0` backend. In parallel, you can
prototype a binary-tree verifier behind a feature flag, but only pin it once the
relevant EIP is no longer draft and client teams have converged on the fork and
serialization details.

Bottom line: build the deployable verifier on today's MPT proofs, because that is
the only canonical Ethereum L1 state proof format at recent mainnet blocks. But if
you are choosing the future witness direction, choose binary hash-tree witnesses,
not Verkle. Ethereum is moving away from the Verkle-specific plan, and the binary
tree path is not yet stable enough to be your only production dependency.

Useful references:

- EIP-1186, `eth_getProof`: https://eips.ethereum.org/EIPS/eip-1186
- Ethereum research page, "State growth and statelessness": https://ethereum.org/community/research/
- Ethereum Foundation protocol priorities for 2026: https://blog.ethereum.org/2026/02/18/protocol-priorities-update-2026
- EIP-7864, unified binary tree: https://eips.ethereum.org/EIPS/eip-7864
- EIP-8297, partitioned binary tree: https://eips.ethereum.org/EIPS/eip-8297
- EIP-8347, offline migration to PBT: https://eips.ethereum.org/EIPS/eip-8347
