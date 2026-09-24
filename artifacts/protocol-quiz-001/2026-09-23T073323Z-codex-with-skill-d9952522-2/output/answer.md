# Recommendation

Build the production verifier around **Ethereum's live Merkle Patricia Trie (MPT) account-and-storage proofs today**, but make the proof layer explicitly versioned so it can add **hash-based binary / Partitioned Binary Tree (PBT) proofs** later. Do **not** build a new pipeline around Verkle witnesses.

If you need to verify a storage slot of a mainnet contract as of a recent block in 2026, the only canonical state commitment you can verify against is still the execution block header's `stateRoot`, which is the root of the current hexary MPT state. The practical format is the existing `eth_getProof` shape: an account proof from `stateRoot` to the account, then a storage proof from that account's `storageHash` to the slot. The RPC provider can be untrusted as long as your service verifies the proof against a block header/root obtained through an independent trusted-header path, such as a beacon light client/finality path, and rejects bad trie proofs locally.

The important caveat is architectural: treat MPT proof handling as `proof_version = mpt`, not as your permanent data model. Your internal verifier API should look like:

```text
trusted block/header -> canonical state root -> state scheme -> key derivation -> proof nodes/witness -> decoded value
```

That lets you keep the user-facing primitive stable: "prove storage slot X of contract A at block B", while swapping the state commitment backend when Ethereum actually does.

# Protocol Status

**Live: MPT state proofs.** Ethereum mainnet state is still committed through the MPT. EIP-1186 describes the `eth_getProof` account/storage proof RPC and says the proof is verified with a `stateRoot` from the block header. This is the only proof family you can safely depend on for mainnet state today.

**SFI / scheduled near term: Block-Level Access Lists, not a replacement state proof format.** EIP-7928 is scheduled for Glamsterdam according to Forkcast, and Glamsterdam is upcoming with a working projected activation of 2026-12-02. EIP-7928 records addresses/storage locations touched during block execution and post-execution values; it enables parallel execution, state reconstruction/executionless updates, and later migration machinery. It is not an arbitrary "prove this storage slot at this block" format. Also, EIP-7928 says historical BAL data may be pruned and is required to be retained for the weak-subjectivity period, which matters for your "recent block" service design.

**No fork relationship: Verkle.** EIP-6800, the unified Verkle tree proposal, is marked Stagnant and has no Forkcast fork relationship. The Verkle transition proposals around overlay/state conversion are likewise not scheduled as the committed mainnet path. Verkle was a serious historical direction, but it is the wrong thing to hard-code around now.

**No fork relationship yet, but the real direction: hash-based binary/PBT state.** EIP-7864 introduced a unified binary tree direction, and the newer EIP-8297 defines a Partitioned Binary Tree. EIP-8347 defines an offline migration from MPT to PBT, with BAL replay used to catch the converted state up to chain head before a single coordinated hard fork. These EIPs are Draft and have no Forkcast fork relationship today, so they are not safe as a hard dependency. But this is where the current state-tree work is pointing: a hash-based binary tree, one logical key/value state commitment, code/storage/header data in the tree, smaller regular Merkle proofs, simpler proving, and better post-quantum posture than curve-based Verkle commitments.

# Why PBT/Binary Over Verkle

The reason to avoid Verkle is not that smaller witnesses stopped mattering. They matter a lot. The reason is that Ethereum's design constraints changed: future state proofs need to be friendly to validity proving and post-quantum planning, not only small in today's cryptographic stack.

EIP-8297's PBT design is explicitly aimed at replacing hexary Patricia tries with a binary tree whose account headers, storage, and code are all in one state commitment. Storage is keyed into zones/buckets, contract code is chunked/content-addressed, zero values collapse to absence, and proof branches are binary. Its rationale says binary branching minimizes ordinary Merkle branch size, and its hash-only construction avoids the elliptic-curve dependency that makes Verkle unattractive under post-quantum planning.

EIP-8347 also matters for light clients: it argues for an offline migration that avoids long-lived hybrid proof verifiers. Before the activation fork, the canonical state root is MPT; after it, the canonical state root is PBT. That is much nicer for your verifier than an extended overlay period where proving a key might require both a new-tree proof and an old frozen-MPT proof.

# Practical Build Plan

Ship `mpt` first:

- Verify account/storage MPT proofs locally from untrusted providers.
- Get block headers/finality independently; do not trust the same RPC for both the value and root of trust.
- Limit the product to recent blocks unless you have reliable proof providers for older historical state.

Prepare for `pbt` without depending on it:

- Keep proof serialization versioned: `mpt`, later `pbt`.
- Keep key derivation isolated per state scheme.
- Model a proven value as `(scheme, block_root, address, slot, value, proof)`, not as an `eth_getProof` JSON object.
- Watch EIP-8297/EIP-8347 for SFI/CFI movement and hash-function finalization before committing to a wire format.

Bottom line: **do not choose Verkle**. For production today, choose **MPT proofs with a clean abstraction boundary**. For the future target, align your abstractions with **hash-based binary/PBT proofs**, but do not make PBT a hard dependency until it is scheduled for a named fork.

# Sources Checked

- Forkcast [`/api/eips/7928.json`](https://forkcast.org/api/eips/7928.json): EIP-7928 scheduled for Glamsterdam.
- Forkcast [`/api/eips/6800.json`](https://forkcast.org/api/eips/6800.json), [`/api/eips/7612.json`](https://forkcast.org/api/eips/7612.json), [`/api/eips/7748.json`](https://forkcast.org/api/eips/7748.json): Verkle-related proposals are not scheduled; EIP-6800/EIP-7612 are Stagnant.
- Forkcast [`/api/eips/7864.json`](https://forkcast.org/api/eips/7864.json), [`/api/eips/8297.json`](https://forkcast.org/api/eips/8297.json), [`/api/eips/8347.json`](https://forkcast.org/api/eips/8347.json): binary/PBT proposals are Draft and have no fork relationship.
- Forkcast [`/api/upgrades.json`](https://forkcast.org/api/upgrades.json): Glamsterdam upcoming, projected activation 2026-12-02; Hegota planning for 2027.
- [EIP-1186](https://eips.ethereum.org/EIPS/eip-1186): `eth_getProof` account/storage proofs against a block `stateRoot`.
- [EIP-7928](https://eips.ethereum.org/EIPS/eip-7928): BAL contents, Engine API retention, and pruning semantics.
- [EIP-8297](https://eips.ethereum.org/EIPS/eip-8297) and [EIP-8347](https://eips.ethereum.org/EIPS/eip-8347): PBT structure and offline MPT-to-PBT migration design.
- [Ethereum Foundation Protocol priorities, 2026-09-07](https://blog.ethereum.org/2026/09/07/protocol-priorities): the state arc includes migration to a new trie, with the largest design/migration work expected to begin in I* and continue beyond it.
