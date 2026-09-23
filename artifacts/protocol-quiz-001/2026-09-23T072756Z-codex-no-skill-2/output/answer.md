# Recommendation

Build the production verifier around **today's canonical Ethereum Merkle-Patricia Trie (MPT) account/storage proof format**, anchored to an independently verified recent execution block header, and keep the verifier boundary explicitly versioned so it can add a **unified binary-tree proof backend** when that protocol change actually ships.

Do **not** make Verkle proofs the hard dependency for this system. Verkle was the major statelessness plan for years, but Ethereum's current research direction has moved away from Verkle as the likely end-state state commitment. The direction now is a **unified binary hash tree** for state, with statelessness built on top of that.

## What to ship now

For Ethereum mainnet as it exists today, a proof that a contract storage slot had value `v` at block `B` should be:

1. A trusted or light-client-verified execution block header for `B`, containing `stateRoot`.
2. An MPT account proof from `stateRoot` to the contract account leaf.
3. The account fields decoded from that leaf, especially `storageRoot`.
4. An MPT storage proof from `storageRoot` to `keccak256(slot)`.
5. Verification that the decoded storage leaf equals the claimed value.

This is the format exposed by `eth_getProof`: it returns account fields, an `accountProof`, and a `storageProof` made of RLP-serialized Merkle trie nodes. EIP-1186 itself is stagnant, but the method and format are widely implemented because they match Ethereum's current execution-layer state commitment.

The trust boundary should be: the RPC/proof server is only a data source. It can lie or omit data, but it cannot make a bad MPT proof verify against a real block header's `stateRoot`. To avoid trusting an RPC provider for the block header, use a consensus light-client path, finalized/safe headers, or another independently verified header source. The proof service can fetch witnesses from one or many execution providers; the verifier should only accept the cryptographic proof against the verified header.

Operationally, avoid depending on arbitrary old historical proofs unless you pay for infrastructure that retains trie nodes. Recent-state proofs are much easier. Geth's current archive documentation says historical `eth_getProof` support requires retaining historical trie nodes with `--history.trienode=N`; path-based archive state alone is not enough for historical Merkle proofs. So define a freshness window you can actually serve.

## Where Ethereum is going

Ethereum is not currently on a clean path to "Verkle everywhere, soon." The more current direction is:

- **Today:** Ethereum execution state is committed with hexary Merkle-Patricia tries. Account state points to per-account storage tries. This is what mainnet block headers commit to today.
- **Earlier roadmap:** Verkle trees were the favored way to shrink witnesses for stateless clients. They remain documented as an important statelessness stepping stone in older roadmap material, and EIP-6800 specifies a unified Verkle tree.
- **Current research direction:** Ethereum's research page now says the longer-term plan is to replace the hexary MPT with a **binary tree** that produces smaller proofs, and that "earlier work in this area assumed Verkle trees" while "the current proposal is a unified binary tree." The 2026 EF protocol priorities likewise describe state scaling as repricing/history-expiry in the short term and "a move to binary trees and statelessness" in the long term.

The concrete proposal to watch is **EIP-7864, "Ethereum state using a unified binary tree."** It replaces the current tree-of-tries model with a single logical binary state tree containing account header data, code, and storage. Its rationale is exactly relevant to your use case: smaller regular Merkle proofs for small pieces of state, cleaner state layout, better proving friendliness, and avoiding Verkle's elliptic-curve commitment dependency in a post-quantum roadmap.

But EIP-7864 is still **Draft**. It explicitly says the hash function is not final; the draft currently uses BLAKE3 for experimentation, while Keccak and Poseidon2 are also discussed. That is a big timing signal: you should track the binary-tree design, but you should not freeze a production verifier to the draft witness bytes yet.

As of September 23, 2026, this should be treated as a roadmap target rather than a dependency you can safely pin production bytes to. EF Reads lists the "verifiable binary trie" effort as aimed at an execution-layer node running a binary trie equivalent to mainnet, but also says the work has been paused since Q3 2026 pending re-scoping. That makes the direction important, but the exact proof format and availability timeline unsafe to assume.

## What not to do

Do not build your verifier around Verkle commitments as the future-proof choice. That would optimize for a roadmap branch Ethereum appears to be moving away from.

Also do not wait for binary-tree proofs before shipping. Your dApp needs to verify recent L1 storage now, and mainnet will continue to use MPT proofs until a hard fork changes the execution state commitment. A binary-tree verifier cannot verify today's canonical `stateRoot` unless it is using a sidecar/equivalence system, which would introduce extra assumptions outside current consensus.

## Interface shape

Commit to a **versioned state-witness envelope**, not one permanent proof encoding:

```text
StateWitness {
  chain_id
  block_number
  block_hash
  state_root
  commitment_scheme: "eth-mpt-keccak-rlp" | "eth-unified-binary-vX"
  address
  storage_slot
  value
  account_proof
  storage_proof
}
```

For v1, implement `eth-mpt-keccak-rlp`. Make the proof verifier own all parsing and hashing rules; do not treat `eth_getProof` JSON as the canonical internal format. Normalize it into your own envelope so that a future `eth-unified-binary-*` backend can share the same top-level API.

When the binary tree becomes a scheduled hard-fork feature with final constants, add a second verifier keyed by fork/block number. At that point the same user-facing query, "prove storage slot X at block B," can dispatch to MPT before the fork and binary-tree proofs after the fork.

## Bottom line

Use **MPT storage proofs now**, because they are the only proofs Ethereum mainnet block headers actually commit to today. Design the abstraction around **Ethereum state commitments**, not around `eth_getProof` as an RPC artifact. For future compatibility, aim toward **unified binary-tree witnesses**, not Verkle witnesses, but treat that as a roadmap target until EIP-7864 or its successor is finalized and scheduled.

Sources:

- Ethereum research, "State growth and statelessness": https://ethereum.org/community/research/
- Ethereum Foundation, "Protocol Priorities Update for 2026": https://blog.ethereum.org/2026/02/18/protocol-priorities-update-2026
- EIP-7864, unified binary tree: https://eips.ethereum.org/EIPS/eip-7864
- EF Reads roadmap, verifiable binary trie status: https://reads.ethereum.foundation/roadmap/
- EIP-6800, unified Verkle tree: https://eips.ethereum.org/EIPS/eip-6800
- EIP-1186, `eth_getProof`: https://eips.ethereum.org/EIPS/eip-1186
- Geth archive/proof retention notes: https://geth.ethereum.org/docs/fundamentals/archive
