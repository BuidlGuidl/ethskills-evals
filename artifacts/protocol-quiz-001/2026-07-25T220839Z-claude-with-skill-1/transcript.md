Written to `answer.md`. The short version:

**Build on MPT proofs (`eth_getProof` / EIP-1186), anchored to a state root from a sync-committee light client — not from an RPC.** Wrap it in a versioned interface so a binary-tree verifier drops in later.

Three findings that drive it:

**Verkle is dead.** EIP-6800 and EIP-7612 are both `Stagnant` in the EIPs repo; EIP-7748 (Verkle conversion) hasn't moved since 2024. The EF's Feb 2026 priorities post doesn't mention Verkle at all. Dropped for ZK-unfriendliness and lack of post-quantum security.

**Binary trees are the real direction, but unscheduled.** The live spec is now **EIP-8297 "Partitioned Binary Tree"** (created 2026-06-11, 12 authors incl. Buterin/Ballet/Feist plus client devs) — a consolidation of EIP-7864, with a PR two days ago dropping 7864's changes section. Both are `Draft`, neither is CFI or SFI for any fork. Glamsterdam's scope is locked (ePBS + BALs + repricings, devnet-7); Hegota's headliner went to FOCIL, and the EL headliner slot explicitly did *not* go to a state tree change. Earliest possible is the fork after Hegota — 2027+. The hash function isn't even chosen yet (BLAKE3 in the reference impl, Keccak and Poseidon2 still candidates).

**The MPT bet isn't a dead end**, because the migration is spec'd as gradual coexistence — the MPT gets frozen, not deleted, and conversion runs over many blocks.

**The timing risk you should actually plan for is not the trie — it's Glamsterdam's ePBS breaking your anchor.** From `specs/gloas/light-client/sync-protocol.md`: `LightClientHeader.execution` is removed. You no longer read `state_root` out of the verified header; you get a bare `execution_block_hash`, must fetch the RLP block header and check the keccak yourself. It points at the *parent* payload, so you anchor a slot behind. And EIP-7688 shifts the generalized indices (finalized root 169→735), so hardcoded gindices hard-stop at the fork epoch. That's near-term, scheduled work — roughly Q4 2026 on realistic timing.

One caveat on sourcing: forkcast.org is client-side rendered and wouldn't scrape, so I verified fork status against the EIPs repo status fields, ethereum/pm call agendas, and consensus-specs directly. The Glamsterdam mainnet target date is from secondary reporting and is soft.
