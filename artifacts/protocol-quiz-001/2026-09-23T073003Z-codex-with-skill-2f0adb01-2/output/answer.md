# Recommendation

Build the verifier around today's Ethereum Merkle Patricia Trie proofs, but put
them behind a versioned proof interface whose next target is a hash-based
unified binary-tree witness, not Verkle.

Concretely:

1. Ship `mpt-keccak-rlp` as the production proof format now.
2. Do not make Verkle/KZG commitments the foundation of your verifier.
3. Design the proof envelope so a future `binary-state-tree` witness can be
   added when Ethereum's binary-tree migration, whether EIP-7864 or a successor
   / partitioned variant, is actually scheduled and has stable test vectors.

For your stated use case, the live proof is still the standard two-step Ethereum
state proof:

- authenticate a recent execution block header and its `stateRoot` through a
  consensus light-client path;
- verify an account proof from `stateRoot` to the account leaf;
- decode the account's `storageRoot`;
- verify a storage proof from `storageRoot` to `keccak256(slot)`;
- return the storage value only if both proofs check out against the
  authenticated root.

This is the thing that works on mainnet today. `eth_getProof` exists specifically
to return account and storage Merkle proofs that can be checked offline against a
trusted block state root. The RPC provider remains untrusted: it can withhold a
proof or give you garbage, but it cannot make an invalid MPT proof verify against
the real block header.

# Why Not Verkle

Verkle was Ethereum's leading statelessness/state-witness candidate for years.
There are still docs and EIPs describing it, notably EIP-6800, which specifies a
unified Verkle tree layered next to the existing hexary Patricia tree. But that
is no longer the safest thing to build a long-lived verifier around.

The tell is the protocol direction in 2026:

- EIP-7612, the Verkle overlay transition proposal, is marked Stagnant.
- The Ethereum Foundation's 2026 protocol priorities describe "a move to binary
  trees and statelessness in the long term."
- EIP-7864 proposes "Ethereum state using a unified binary tree" and explicitly
  motivates the shift with SNARK friendliness and post-quantum security. Its
  rationale says Verkle would eventually need replacement by a post-quantum-safe
  alternative, while the binary-tree proposal depends only on hash functions.
- The September 2026 EF priorities say the state arc includes migrating to a new
  trie, sustainable state growth, and decentralized access to current and
  historical state, with the largest design and migration work expected to begin
  in I* and continue beyond it.

So: Verkle is useful historical context, and maybe useful for old experiments,
but I would not use it as the central commitment format for a new production
state-proof service.

# What Ethereum Is Actually Moving Toward

The direction is a hash-based binary state tree: EIP-7864's unified binary tree,
or a close successor/partitioned variant. The important properties are a new
state commitment structure for account data, storage, and code chunks, without
the current account-trie-plus-storage-trie nesting and without RLP as the node
encoding.

That direction matters for your architecture because it changes what should be
abstract in your verifier:

- key derivation should be per proof version;
- node encoding should be per proof version;
- hash/commitment verification should be per proof version;
- account/storage layout should be per proof version;
- the outer envelope should bind `chain_id`, block identifier, state root, proof
  kind, contract address, storage slot, claimed value, and witness bytes.

Do not bake in "Ethereum state proofs are always MPT account proof plus nested
storage proof" as an application-level invariant. That is true today, but the
future tree is intended to remove exactly that shape.

At the same time, do not hard-depend on binary witnesses being available on a
near schedule. EIP-7864 is still Draft, not a mainnet commitment. The current
fork work ahead of it is elsewhere: Glamsterdam has block-level access lists
and ePBS as major items, and Hegota is still in planning with FOCIL as the
headliner. The EF's own September 2026 framing puts the large state-tree
migration work in I* and beyond. Treat that as "real direction, unstable
interface."

# Role Of Block-Level Access Lists

Track EIP-7928, but do not confuse it with your state proof format.

Block-level access lists commit, in the block, to the addresses and storage keys
actually accessed during execution and to per-transaction state diffs. That is
very relevant to statelessness, prefetching, witness availability, and future
proof-serving infrastructure. It is not, by itself, the membership proof that an
arbitrary storage slot had a value under a block's state root.

For your service it may become useful metadata, especially for recent blocks and
touched slots. But your verifier still needs a cryptographic state membership
proof: MPT today; binary-tree witness later.

# Practical Build Plan

Use this shape:

```text
StateProofEnvelope {
  chain_id
  block_number
  block_hash
  state_root
  finalized_or_safe_policy
  proof_version        // mpt-keccak-rlp-v0, binary-tree-v1, ...
  address
  storage_slot
  claimed_value
  witness
}
```

For `mpt-keccak-rlp-v0`, `witness` contains the EIP-1186-style account proof and
storage proof. Verification is deterministic and local.

For the future binary-tree version, keep the envelope but swap in the eventual
canonical key mapping, node encoding, and hash function once the protocol
proposal reaches a firmer stage. Do not invent that final wire format now.

Set an explicit history window. Since you only need recent blocks, you can avoid
running an archive node by querying proof-serving nodes for recent state, then
verifying locally. If the product later needs arbitrary old block state, that is
a different availability problem: you will need an archive provider, a proof
network, your own retained state, or whatever decentralized historical-state
retrieval layer emerges.

# Bottom Line

The correct near-term commitment is MPT proofs, because that is Ethereum mainnet
today. The correct long-term commitment is not Verkle; it is a versioned verifier
that can adopt Ethereum's emerging hash-based binary-tree witnesses when they
become real protocol surface.

Build the production path on MPT, keep the proof API tree-agnostic, monitor
EIP-7864 or its successor, and wait for CFI/SFI plus client test vectors before
taking a hard dependency on the future binary witness format.

# Sources Checked

- EIP-1186, `eth_getProof`: https://eips.ethereum.org/EIPS/eip-1186
- Ethereum.org Merkle Patricia Trie docs: https://ethereum.org/developers/docs/data-structures-and-encoding/patricia-merkle-trie
- EIP-6800, unified Verkle tree: https://eips.ethereum.org/EIPS/eip-6800
- EIP-7612, Verkle overlay transition, Stagnant: https://eips.ethereum.org/EIPS/eip-7612
- EIP-7864, unified binary tree, Draft: https://eips.ethereum.org/EIPS/eip-7864
- EF Protocol Priorities Update for 2026: https://blog.ethereum.org/2026/02/18/protocol-priorities-update-2026
- EF Protocol Current and Emerging Priorities, September 2026: https://blog.ethereum.org/2026/09/07/protocol-priorities
- EIP-7928, block-level access lists: https://eips.ethereum.org/EIPS/eip-7928
- Forkcast EIP-7928 / Glamsterdam status: https://forkcast.org/eips/7928/
- Ethereum.org Hegota status: https://ethereum.org/roadmap/hegota/
