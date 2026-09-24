# Recommendation: build production support for MPT proofs now, but make the protocol-facing witness layer versioned for EIP-7864-style binary state, not Verkle

For a dApp that needs to verify one Ethereum L1 storage slot at a recent mainnet block, the production proof format should still be the canonical Merkle-Patricia Trie proof: the `eth_getProof` shape of an account proof plus a storage proof, with RLP-encoded trie nodes, Keccak paths, and verification against the `stateRoot` in the execution block header. Treat the RPC or proof server as untrusted: it can supply the proof bytes, but your verifier should independently check the account path, the account's `storageRoot`, the storage-key path, and the value against a block header whose authenticity comes from your beacon/light-client path.

However, do not make that MPT encoding your permanent application contract. Put it behind a versioned witness envelope, for example `state_proof_type = mpt_keccak_rlp`, with room for a future `binary_trie_eip7864` proof type. If you want to align with where Ethereum's state layer is genuinely heading, design the abstraction around a generic commitment/proof verifier and the unified-state model: account fields, code, and storage represented as leaves in one logical state tree. The current forward-looking protocol proposal is EIP-7864, "Ethereum state using a unified binary tree", not the older Verkle transition.

I would specifically avoid building a hard dependency on Verkle proofs or Verkle polynomial commitments. Verkle was the major statelessness plan for several years, and ethereum.org still has roadmap pages describing it as a step toward stateless clients. But the Verkle EIP itself, EIP-6800, is now marked **Stagnant**, while EIP-7864 is the live draft for a unified binary tree. EIP-7864 says the new binary tree is intended to replace the current hexary Patricia trees, calls out the current MPT design as unfriendly to validity proofs, and explicitly says the binary-tree proposal will probably be the final protocol state tree compared with Verkle, which would eventually need replacement for post-quantum security.

The timing caveat is important. EIP-7864 is still **Draft**, and even its hash function is not final: the draft currently uses BLAKE3 for experimentation, while Keccak and Poseidon2 remain candidates. The EF "Reads" roadmap also lists verifiable binary-trie work for wallets/light clients, but notes that the Geth sidecar, Ethrex binary trie, shadow-chain sync, zkVM proving, and binary-trie retrieval work are paused pending rescoping. So binary state is the direction to architect toward, not something you can safely require for your mainnet product today.

Practical architecture:

- Ship `mpt_keccak_rlp` verification first. This is the only format anchored in today's mainnet execution `stateRoot`.
- Keep the trusted input as `block_hash/block_number + execution_state_root + consensus proof of the header`, not "RPC said this value".
- Let untrusted providers return proof bytes. Availability of proof data can be delegated; correctness cannot.
- Store proofs in a versioned envelope with explicit fields for tree scheme, hash/commitment function, path encoding, node encoding, root, account address, storage slot, and value.
- Keep the verifier interface tree-agnostic: `verify(root, key, proof) -> value_or_absence`, plus Ethereum-specific adapters for "storage slot under account" today and "unified state key" later.
- Do not expose Verkle as your promised external format unless you have a separate compatibility reason. If you experiment with it, mark it as experimental/legacy-roadmap, not the canonical future.

Bottom line: build the live service around canonical MPT storage proofs, because that is what Ethereum mainnet commits to today. Future-proof the product around a versioned witness interface whose next serious target is EIP-7864 unified binary-tree proofs. That gives you a verifier that works now, avoids committing to a state format Ethereum appears to be moving away from, and leaves room for the protocol's still-unsettled binary-tree details to finalize.

Sources:

- EIP-1186, `eth_getProof`: https://eips.ethereum.org/EIPS/eip-1186
- EIP-6800, unified Verkle tree, status Stagnant: https://eips.ethereum.org/EIPS/eip-6800
- EIP-7864, unified binary tree, status Draft: https://eips.ethereum.org/EIPS/eip-7864
- Ethereum.org Verkle roadmap page, last updated June 24, 2026: https://ethereum.org/roadmap/verkle-trees
- Ethereum.org statelessness page, last updated September 22, 2026: https://ethereum.org/roadmap/statelessness/
- Ethereum Foundation Reads roadmap, verifiable binary trie section: https://reads.ethereum.foundation/roadmap/
