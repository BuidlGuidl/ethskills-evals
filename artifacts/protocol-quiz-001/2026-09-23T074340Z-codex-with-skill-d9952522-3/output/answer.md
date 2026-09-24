# Recommendation: build for hash-based binary state proofs, but ship today with MPT proofs behind a versioned proof interface

For a mainnet service that needs to verify a contract storage slot at a recent block, the only proof format you can safely depend on today is the current Ethereum execution state proof: Merkle-Patricia-Trie account and storage proofs against the `stateRoot` in the execution block header. In practice, that means verifying an `eth_getProof`-style proof: first prove the account in the global state trie, then prove the storage slot in that account's storage trie.

However, if the question is which future state-proof/witness shape to orient the verifier around, do **not** build a Verkle-first verifier. Ethereum's state layer is now pointing more toward a **unified hash-based binary tree** design, represented by EIP-7864, than toward the older Verkle-tree transition represented by EIP-6800.

My concrete recommendation is:

1. Implement current MPT storage proofs for production now.
2. Put them behind a versioned interface such as `StateProofV1MPT`.
3. Design the next proof backend around a unified binary Merkle tree abstraction: one logical state tree, account fields/code/storage embedded as typed leaves, Merkle branches over hashes, and no dependency on Verkle/KZG/Bandersnatch commitments.
4. Do not make EIP-7864 a hard dependency yet. Track it, prototype against it, but gate any production commitment on fork inclusion.

## Where Ethereum stands today

Ethereum mainnet state is still committed through the existing hexary Merkle Patricia Trie structure. Storage proofs for a slot in a contract are MPT proofs rooted in the execution header's `stateRoot`.

That means the trust-minimized path today is:

- obtain or verify the recent canonical block header, preferably via a beacon light client path rather than trusting the RPC server;
- verify the execution payload/header state root for that block;
- verify the account proof under that state root;
- extract the account `storageRoot`;
- verify the slot proof under that storage root.

An RPC provider can supply the bytes, but it should not be trusted for truth. The verifier accepts only proofs that reconstruct the authenticated roots from the canonical header.

## Where the state layer is actually going

The old direction was Verkle. EIP-6800 proposes adding a Verkle state tree alongside the existing MPT and then moving execution state there. It was designed to shrink witnesses for stateless validation.

But as of September 23, 2026, that is not a safe direction to build around:

- Forkcast lists EIP-6800 as **Stagnant**.
- EIP-6800 has **no tracked fork relationship**.
- Its own spec is still the older Verkle-tree transition design.

The newer direction to watch is EIP-7864, "Ethereum state using a unified binary tree." Its design is closer to what a long-lived verifier should want:

- a single logical state tree instead of separate account and storage tries;
- account header fields, contract code, and storage represented in one tree;
- regular Merkle proofs over a binary tree;
- a hash-based construction rather than elliptic-curve Verkle commitments;
- explicit motivation around both small regular Merkle proofs for applications and future validity-proving/stateless needs.

EIP-7864 also says the final hash function is not settled. The current draft discusses BLAKE3, Keccak, and Poseidon2, and explicitly warns not to assume BLAKE3 is final. So your abstraction should be "binary Merkle proof over a protocol-selected hash," not "BLAKE3 proof."

## Timing and dependency risk

This is the important planning caveat: EIP-7864 is **Draft** and Forkcast currently shows **no fork relationship** for it. It is not SFI, not CFI, and not scheduled for Glamsterdam or Hegotá in the Forkcast data I checked.

Forkcast lists Glamsterdam as upcoming, with a projected activation date of December 2, 2026, but its scope is not "binary state tree migration." It lists Hegotá as planning for 2027, but EIP-7864 is not currently tracked there either. Recent All Core Devs notes do mention binary trie / PBT migration as live protocol discussion, but not as a committed fork item.

So: treat the binary tree as the direction of travel, not as a shipping dependency.

## What not to do

Do not commit your core verifier to a Verkle witness format. That would couple you to a stagnant proposal and a cryptographic stack the protocol may avoid for post-quantum and proving-system reasons.

Do not replace production MPT verification with a binary-tree proof format until Ethereum actually changes the canonical state commitment. A binary proof today would need an extra equivalence proof or trusted sidecar proving that the binary tree corresponds to canonical MPT state. Without that, it is not a proof of Ethereum L1 state.

## Architecture I would build

Use a small, explicit proof-version layer:

- `MPTAccountStorageProof`: current production format; verifies account and slot proofs against `stateRoot`.
- `BinaryStateProof`: experimental/future format; verifies typed leaves in a unified binary state tree once that tree becomes canonical or is accompanied by a sound equivalence proof to canonical state.
- `HeaderTrustRoot`: separate module that verifies the recent block/header root via Ethereum consensus/light-client data.

Keep the application API stable:

```text
verifyStorageSlot(chainId, blockHashOrNumber, contractAddress, slotKey, expectedValue, proofBundle) -> result
```

The proof bundle should declare its state-proof version. That lets you support today's MPT without painting yourself into the wrong future format.

## Bottom line

Build the verifier's long-term proof model around **hash-based unified binary state proofs**, not Verkle. But for mainnet correctness today, ship **MPT storage proof verification** and keep the binary-tree backend experimental until EIP-7864 or a successor is actually scheduled/included in a fork.

Sources checked:

- Forkcast EIP-6800: https://forkcast.org/api/eips/6800.json
- Forkcast EIP-7864: https://forkcast.org/api/eips/7864.json
- Forkcast upgrades: https://forkcast.org/api/upgrades.json
- EIP-6800: https://eips.ethereum.org/EIPS/eip-6800
- EIP-7864: https://eips.ethereum.org/EIPS/eip-7864
- EIP-1186 / `eth_getProof`: https://eips.ethereum.org/EIPS/eip-1186
- Ethereum execution API `eth_getProof`: https://ethereum.github.io/execution-apis/api/methods/eth_getProof/
