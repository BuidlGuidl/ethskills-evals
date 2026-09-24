# Recommendation

Build the production verifier around today's Ethereum state proof format: the
execution-layer hexary Merkle-Patricia Trie (MPT) account proof plus storage
proof, anchored to a block header `stateRoot` that your service verifies through
an Ethereum consensus light client.

But do not make Verkle commitments your long-term abstraction. If you are
designing the internal witness interface now, make it versioned and keep the
tree-specific verifier behind a narrow adapter. The direction Ethereum's state
layer is actually moving toward is a unified, hash-based binary state tree
(EIP-7864), not the older Verkle transition design.

In short:

1. Ship `mpt-v1` now.
2. Design the abstraction so `binary-tree-v1` can be added later.
3. Do not hardwire your product to Verkle/KZG/Bandersnatch witnesses.

## Where Ethereum State Stands Today

Ethereum mainnet state is still committed with the execution header's
`stateRoot`, which is the root of the existing Merkle-Patricia Trie structure.
For a contract storage slot, the proof you can verify today is:

- an account proof from `stateRoot` to the contract account, keyed by
  `keccak256(address)`;
- the account leaf containing `[nonce, balance, storageRoot, codeHash]`;
- a storage proof from that account's `storageRoot` to the slot value, keyed by
  `keccak256(slot)`;
- RLP-encoded trie nodes and Keccak hashing.

This is what `eth_getProof` exposes. The RPC provider is only a proof/data
source; it is not trusted if your verifier checks the proof against a trusted
or light-client-verified block header. For your "recent block, no archive node"
use case, this is the only mainnet-compatible state proof format you can safely
depend on today.

Operationally, treat proof availability separately from proof validity. You can
ask untrusted RPCs for `eth_getProof`, or run a non-archive node for current /
recent state, but your verifier should reject anything that does not verify
against the light-client-authenticated header. If you need older historical
state, availability becomes a bigger problem and you will need an archive data
source or a proof market/indexer; the proof format alone does not solve that.

## Where The State Roadmap Is Going

Older roadmap material said "Verkle trees are next." That is no longer the best
signal to build around.

The current long-term direction is a unified binary state tree:

- EIP-7864, "Ethereum state using a unified binary tree," is the active draft
  proposal for replacing the current hexary Patricia structure.
- It merges account data, contract code chunks, and storage into one logical
  key/value tree.
- It removes RLP from the state tree.
- It uses arity 2, because binary Merkle proofs minimize branch witness size
  for ordinary Merkle openings.
- It is hash-based, which is more compatible with post-quantum conservatism and
  with modern SNARK/STARK proving work than Verkle's elliptic-curve commitment
  stack.
- Its own rationale explicitly says the proposal is intended to be the final
  state tree, whereas Verkle would likely need another replacement later for
  post-quantum reasons.

By contrast, the Verkle state EIPs are not the direction I would bind a new
verifier to:

- EIP-6800, the unified Verkle tree proposal, is marked `Stagnant`.
- EIP-7612, the Verkle overlay transition proposal, is also marked `Stagnant`.
- The current ethereum.org research overview says earlier work assumed Verkle,
  but the current proposal is the unified binary tree.

So the architectural bet should be "MPT now, binary tree later," not "Verkle
now/later."

## Timing And Dependency Risk

Do not take a hard runtime dependency on EIP-7864 yet.

As of 2026-09-23, EIP-7864 is still a Draft Core EIP. It is not a live mainnet
format, and it is not something your dApp can request from Ethereum mainnet
today. The draft also leaves important parameters unsettled, especially the
final hash function. The text currently discusses BLAKE3, Keccak, and Poseidon2,
and warns not to assume BLAKE3 is final.

Glamsterdam's near-term state work is mainly about scaling and sustainability:
block-level access lists, access-list exchange, state creation repricing, and
state access repricing. Those changes help execution, parallelism, sync, and
future statelessness, but they do not mean the state trie has already switched
to the binary tree.

Therefore:

- For a verifier that must work on mainnet now, implement and harden MPT proofs.
- For a verifier that should survive Ethereum's roadmap, keep the proof envelope
  versioned and tree-agnostic.
- Add an experimental EIP-7864 verifier only behind a feature flag or testnet
  path until the EIP is scheduled for a concrete fork and client devnets have
  converged.
- Avoid investing in Verkle-specific proof serialization, polynomial/vector
  commitment verification, or Bandersnatch/KZG assumptions unless you have a
  separate non-mainnet reason to support them.

## Suggested Proof Envelope

Use a small versioned envelope rather than one "forever" witness type:

```text
StateProof {
  chain_id
  block_number
  block_hash
  state_root
  proof_type: "mpt-v1" | "binary-tree-v1"
  address
  storage_slot
  value
  proof
}
```

For `mpt-v1`, `proof` should contain the account proof nodes and storage proof
nodes exactly as needed to rederive the account/storage roots. For
`binary-tree-v1`, do not freeze the wire format until EIP-7864's hash function,
node encoding, and fork-transition details are no longer draft-level.

## Bottom Line

Commit your working verifier to MPT state proofs today, but commit your product
architecture to a future hash-based binary-tree proof path. That matches
Ethereum mainnet reality and the protocol's current direction, while avoiding a
Verkle dependency that the roadmap has largely moved away from.

Sources checked:

- EIP-1186, `eth_getProof`: https://eips.ethereum.org/EIPS/eip-1186
- EIP-7864, unified binary state tree: https://eips.ethereum.org/EIPS/eip-7864
- EIP-6800, unified Verkle tree, marked Stagnant:
  https://eips.ethereum.org/EIPS/eip-6800
- EIP-7612, Verkle overlay transition, marked Stagnant:
  https://eips.ethereum.org/EIPS/eip-7612
- Ethereum.org active research overview, state growth/statelessness section:
  https://ethereum.org/community/research/
- Ethereum Foundation protocol priorities for 2026:
  https://blog.ethereum.org/2026/02/18/protocol-priorities-update-2026
