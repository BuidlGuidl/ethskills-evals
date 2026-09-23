# Recommendation: Build your state-proof verifier on MPT proofs (EIP-1186 `eth_getProof`), with a pluggable proof-format layer

## TL;DR

Build your verifier around **the proof format that is consensus-valid today: hexary Merkle Patricia Trie (MPT) proofs, as returned by `eth_getProof` (EIP-1186), verified against the execution `stateRoot` of a sync-committee-verified block header.** Do not build on Verkle (EIP-6800) — that path is effectively dead. Do not take a hard dependency on the binary tree (EIP-8297, successor to EIP-7864) — it is the genuine direction of the protocol, but it is a draft, unscheduled, and its hash function is still undecided. Architect so the trie verifier is a swappable, versioned component, and track the binary-tree EIPs so you can add that verifier when the format actually lands.

---

## Where Ethereum's state layer stands today (Sept 2026)

1. **Mainnet state is committed via the hexary MPT, Keccak, RLP.** Every block header's `stateRoot` is the root of this tree. Storage-slot proofs are two-level MPT proofs (account proof against `stateRoot`, then storage proof against the account's `storageRoot`), served by every major client via `eth_getProof`. This is the only state-proof format that verifies against a mainnet block today, and it is what every working trust-minimized light client (Helios, sp1-helios, Lodestar-based tooling) actually verifies.

2. **Verkle trees (EIP-6800) are dead as the state-layer plan.** The EF/stateless-ecosystem has abandoned the curve-based vector-commitment tree: it is not quantum-safe (NIST guidance calls for retiring ECC by ~2030), and the EIP-6800 specs were recently *removed from the consensus-specs repo* as "stagnant and unlikely to be included in an upgrade anytime soon." Wiring your pipeline to Verkle would be wiring it to a design the protocol has explicitly walked away from.

3. **The actual destination is a hash-based binary tree.** The lineage is:
   - **EIP-7864** (Jan 2025, Draft): unified binary tree — single tree merging accounts/storage/code, no RLP, arity-2 so proofs shrink roughly 4–5x vs MPT, hash-only so post-quantum-safe.
   - **EIP-8297** (Jun 2026, Draft): *Partitioned Binary Tree (PBT)*, the successor to 7864 — same core idea plus "zones" separating headers/code/storage and content-addressed code.
   - **EIP-8347** (Jul 2026, Draft): the migration plan — offline conversion at a finalized anchor block, catch-up via Block-Level Access List replay, a shadow-commitment period, then a single hard fork (`PBT_ACTIVATION_FORK`) that swaps what the `stateRoot` header field commits to. Both trees are maintained until the swap fork finalizes.

   The motivation is precisely your use case: the MPT is hostile to light clients and ZK proving (RLP encoding, Keccak, "tree of trees", ~3.8KB+ proofs); a binary tree with a circuit-friendly hash shrinks proofs (~770 bytes) and proving cost dramatically.

## The timing problem — why you can't hard-depend on the binary tree yet

- **Not scheduled.** Glamsterdam (Q4 2026) is scoped and does *not* include the state-tree change. The Sept 2026 roadmap discussion explicitly says Hegota (the fork after Glamsterdam) should prepare the ground (BALs via EIP-7928, state gas via EIP-8037) and that **the PBT migration is expected in "fork I*" — the fork after Hegota.** Realistically that is 2028+ at the earliest, and the state roadmap has slipped repeatedly before (Verkle was "two years out" for half a decade).
- **The spec is not final.** EIP-8297/8347 are Drafts. The merkelization hash function is explicitly TBD — BLAKE3 is a placeholder, Poseidon2 is the favored candidate for ZK-friendliness but still under security analysis, Keccak is a fallback. If you baked in a proof verifier for the current draft, the final fork could invalidate it.
- **The wire format doesn't exist yet.** There is no RPC surface serving PBT proofs on mainnet, because mainnet doesn't have a PBT. `eth_getProof` only becomes a PBT-proof source after the activation fork.

Conversely, the MPT is not going anywhere on the timeline you need to ship:

- Every block between genesis and the PBT activation fork has an MPT `stateRoot`, forever. **Even after the swap, historical-state verification requires MPT proofs** — the EIPs themselves call out that the tree change "breaks in-EVM verification of MPT state proofs" only for post-fork roots. If your dApp ever needs to verify state "as of a recent block" from before the swap, MPT support is permanent.
- The transition window keeps the MPT alive alongside the PBT until the swap fork finalizes.

## What to actually build

1. **Trust anchor:** consensus light-client sync (sync-committee finality updates, per the Altair light-client protocol) → finalized execution payload header → `stateRoot`. This is the part that is stable regardless of the state tree: EIP-8347 keeps `stateRoot` as the same header field; the CL treats it as opaque bytes. Your header-verification layer will survive the tree swap unchanged.
2. **Proof layer:** MPT/Keccak/RLP proof verification of `accountProof` + `storageProof` from `eth_getProof`, bound to a specific block hash (never `"latest"` — bind proof, block hash, and state root together).
3. **Abstraction:** version your proof payload and hide the trie verifier behind an interface (`verify(root, key, value, proof, format_version)`), so adding a "PBT binary-tree proof" implementation later is an addition, not a rewrite. This also matches what the ecosystem expects: `eth_getProof` is expected to survive the migration but with a changed, likely versioned, proof payload.
4. **Tracking:** watch EIP-8297 (tree), EIP-8347 (migration/activation), and the hash-function decision (BLAKE3 vs Poseidon2 vs Keccak). Once a devnet and a fork meta-EIP schedule the activation fork, start building the binary-tree verifier — you'll get smaller proofs and, if Poseidon2 wins, dramatically cheaper ZK proving as a free upgrade.

## Bottom line

The direction you should *align* with is the hash-based binary tree (EIP-8297), not Verkle. But the format you should *build on* now is the MPT/`eth_getProof` proof verified against a light-client-authenticated `stateRoot` — it is the only format with consensus validity today, it remains required for all pre-swap history forever, and the earliest realistic swap is two-plus hard forks (≈2028) away with an unfinalized spec. Take the dependency on MPT; keep the binary-tree verifier behind an abstraction boundary so adopting it is a feature, not a rewrite.
