Written to `answer.md`. Summary:

**Build on MPT / keccak256 / RLP (`eth_getProof`-shaped proofs), anchored via the sync-committee light client.** That's what the state layer is today and through every scheduled fork.

**Where things actually stand (verified against forkcast data current to today, consensus-specs, and ethereum/pm):**

- **Verkle is dead.** EIP-6800, 7612, 7545, 7736 are all `Stagnant` with zero fork relationships. Any source saying "Verkle in 2026" is stale.
- **Binary tree is the real direction but is not scheduled.** EIP-7864 is `Draft`, `forkRelationships: []`. And a *second* binary-tree design — EIP-8297 "Partitioned Binary Tree", created 2026-06-11 by essentially the same authors — appeared six weeks ago with a different key layout. Both say the hash function is undecided (BLAKE3 as placeholder, Poseidon2/Keccak candidates). Direction settled; format not.
- **Earliest plausible mainnet: 2028.** Not in Glamsterdam (scoping done, devnet-7 running), not in Hegotá (FOCIL is the headliner; non-headliner deadline 2026-08-06, no tree EIP proposed). Prerequisites were pulled from Glamsterdam in Oct 2025 (EIP-6873 preimage retention, EIP-7667). Stateless Implementers calls went monthly and haven't met since #52 on June 1.
- **Skip SSZ execution proofs too** — Pureth (7919) stagnant, 6404/6466 declined for Glamsterdam, 7807 declined for Hegotá.

**The finding that should actually drive the architecture** — the thing that breaks first isn't the tree, it's the anchoring. In `specs/gloas/light-client/sync-protocol.md`, ePBS removes `execution` from `LightClientHeader`, leaving only `execution_block_hash`, proven against the *next* slot's bid. So post-Glamsterdam you must fetch the full RLP header and extract `stateRoot` yourself, and freshness degrades ~one slot. Also flagged: EIP-7862 (Delayed State Root, PFI'd for Hegotá) would make `header[N].stateRoot` the *pre*-state root, breaking the "state root of N = state after N" invariant.

Recommendation is to ship MPT now, put a versioned seam between anchor-acquisition and proof-verification (write it before Glamsterdam), keep the hash a parameter, and avoid an immutable on-chain verifier — with a watch list and trigger conditions at the end.
