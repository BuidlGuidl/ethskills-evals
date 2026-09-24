# Recommendation: build for MPT today, design toward binary-tree state proofs, do not bet the verifier on Verkle

Use a versioned state-proof interface with two layers:

1. **Production path now:** verify Ethereum's current hexary Merkle Patricia Trie proof, anchored in the execution payload `stateRoot`.
2. **Future path:** keep the verifier/proof API ready for Ethereum's proposed **unified binary state tree** direction, but treat it as an adapter to add later, not a dependency you need for launch.

Do **not** build the system around Verkle proofs as the long-term committed format. Verkle was the previous main statelessness design, and there are still public roadmap pages and old EIPs describing it, but current protocol planning has moved away from taking Verkle as the obvious next state tree.

## Why

### What Ethereum uses today

Ethereum mainnet state is still committed through the execution header's `stateRoot`, using the existing Merkle Patricia Trie structure: an account trie, and for contracts a separate storage trie rooted at the account's `storageRoot`.

For your current product, the canonical proof for "storage slot X of contract C at recent block B" is:

- obtain a trusted block/header root through an Ethereum light-client path, ideally a beacon-chain light client finalized or optimistic header flow;
- fetch an untrusted `eth_getProof`-style account/storage proof from one or more RPC providers;
- verify the account proof against the block's execution `stateRoot`;
- verify the storage slot proof against the account's `storageRoot`;
- return the slot value plus the proof metadata.

This is the only state-proof format you can rely on for mainnet today. It is not glamorous, and the proofs are larger and more awkward than future designs, but it is live consensus reality.

Status: **Live**.

### Where the state layer is heading

The better future-facing target is **hash-based unified binary state trees**, represented by **EIP-7864: Ethereum state using a unified binary tree**.

The important properties for your use case are:

- account data, contract code, and storage are embedded into one logical key-value state tree;
- proofs are ordinary Merkle-style binary proofs rather than Verkle vector-commitment proofs;
- the design is intended to be friendlier to validity proving and future stateless verification;
- the final hash choice is explicitly not settled. The current EIP text says BLAKE3 is used to reduce experimentation friction, but the final hash function is still TBD, with other candidates under consideration.

That is the direction I would align your abstractions with: a versioned "state key -> value under state root" proof model where the concrete backend can be `mpt-keccak-rlp` today and `unified-binary-tree` later.

Status: **No fork relationship** as of September 23, 2026. EIP-7864 is Draft and Forkcast lists no scheduled/considered fork relationship for it.

### Why not Verkle

Verkle trees were the older answer to Ethereum statelessness. The core Verkle EIP, **EIP-6800: Ethereum state using a unified verkle tree**, is marked **Stagnant** in the EIP repository, and Forkcast shows no current fork relationship for it. The overlay/migration work around Verkle is not a safe protocol dependency either: **EIP-7612** is also Stagnant, and **EIP-7748** remains Draft.

More importantly, the Ethereum Foundation's 2026 protocol priorities describe state scaling as "repricing and history expiry in the short term, and a move to binary trees and statelessness in the long term." That is the clearest strategic signal: Verkle is no longer the design I would wire a new proof system around.

Status: **No fork relationship / Stagnant**, not SFI.

### Timing and dependency risk

You should not wait for binary trees. You also should not expose a product API that assumes binary-tree proof details are finalized.

Near-term scheduled state-related work is different:

- **Glamsterdam** is the next upcoming upgrade in Forkcast, projected for late 2026 as a planning estimate, not an announced mainnet date.
- **EIP-7928: Block-Level Access Lists** is scheduled for Glamsterdam and is relevant to stateless/proving infrastructure, but it does not replace the state tree.
- **EIP-8037: State Creation Gas Cost Increase** is also scheduled for Glamsterdam and is about controlling state growth, not changing your proof format.
- **EIP-8025: Optional Execution Proofs** is proposed for Hegota, but it concerns optional zk execution proofs and stateless guest/witness infrastructure, not a canonical per-slot state proof format that your dApp can depend on today.

So the timing conclusion is:

- **MPT proofs:** hard dependency is safe because they are live.
- **Binary tree proofs:** align your architecture, but do not make them load-bearing until an EIP is scheduled for a named fork and client implementations converge.
- **Verkle proofs:** do not choose as the strategic format.

## Concrete design recommendation

Define your external proof object around a stable semantic claim, not around today's trie nodes:

```text
claim:
  chain_id
  block_hash / block_number
  state_root
  contract_address
  storage_slot
  storage_value
  finality_status

proof:
  proof_type
  proof_bytes_or_nodes
  proof_version
  execution_header_or_header_proof
```

Then implement:

- `proof_type = "eth-mpt-keccak-rlp-v1"` now;
- a future `proof_type = "eth-unified-binary-tree-v1"` only after the binary-tree spec is fork-scheduled and hash/keying rules are final;
- no `verkle` proof path unless you need to interoperate with a specific experimental devnet.

Internally, keep the MPT verifier isolated behind an interface such as:

```text
verify_state_claim(header, state_proof, claim) -> verified_value
```

Avoid leaking raw MPT node structure into your application contract ABI, SDK API, storage model, or long-term database schema. Store enough to re-verify historical proofs, but make the application-facing object a versioned claim plus proof, not "a list of RLP trie nodes" as your permanent product abstraction.

## Sources checked

- Forkcast API, EIP-7864: Draft, no fork relationships: https://forkcast.org/api/eips/7864.json
- Forkcast API, EIP-6800: Stagnant, no fork relationships: https://forkcast.org/api/eips/6800.json
- Forkcast API, upgrades: Glamsterdam upcoming, Hegota planning: https://forkcast.org/api/upgrades.json
- Forkcast API, EIP-7928 scheduled for Glamsterdam: https://forkcast.org/api/eips/7928.json
- Forkcast API, EIP-8037 scheduled for Glamsterdam: https://forkcast.org/api/eips/8037.json
- Forkcast API, EIP-8025 proposed for Hegota: https://forkcast.org/api/eips/8025.json
- EIP-7864 specification: https://eips.ethereum.org/EIPS/eip-7864
- EIP-6800 specification: https://eips.ethereum.org/EIPS/eip-6800
- Ethereum Foundation 2026 protocol priorities: https://blog.ethereum.org/2026/02/18/protocol-priorities-update-2026
