Written to `answer.md`. The short version:

**Build on MPT proofs (`eth_getProof`-shaped, keccak/RLP/hexary), anchored by the beacon sync-committee light client — not on Verkle, and not yet on the binary tree.**

Where things actually stand (checked today against `all-forks.json`, the meta-EIPs, consensus-specs, and this month's ACD call artifacts):

- **Verkle is dead.** EIP-6800, 7736, 6873 are all `Stagnant`; EIP-7748 is an orphaned conversion spec for a dead target. Killed by post-quantum concerns (it needs elliptic curves) and ZK-unfriendliness.
- **The binary tree (EIP-7864) is genuinely where the state layer is heading** — actively maintained, last edited 2026-06-24 — **but it has zero fork commitment.** It's not in Glamsterdam's meta-EIP at all (not even in the declined list), and not among Hegotá's 28 proposed EIPs, whose submission deadline is Aug 6. Its hash function is still undecided (the EIP says in bold not to assume BLAKE3), and that choice is gated on an unresolved holistic post-quantum decision — ACDC #183 two days ago refused PFI to a PQ RANDAO change on exactly that reasoning. It also freezes the MPT and starts an *empty* tree, deferring migration to a later fork. Earliest plausible inclusion is the fork after Hegotá; a converted tree before 2028 would be fast.
- **The real near-term risk isn't the tree — it's the anchor plumbing.** ePBS (SFI, Glamsterdam) removes the `ExecutionPayloadHeader` from `LightClientHeader`, leaving only a block hash — and it's the *parent's* block hash, so your authenticated EL block lags a slot. EIP-7688 moves the sync-committee gindices. EIP-7862 (proposed for Hegotá) would redefine `header.state_root` as the *previous* block's post-state, adding a slot of latency; EIP-8341 is a competing version without that cost.

Strongest confirming signal: EIP-8268, written in May 2026 for the fork after next, specifies per-account **post-block storage trie roots** in RLP. The protocol is still investing in MPT-shaped machinery, and so is the L1-zkEVM effort (execution witnesses on today's MPT).

The doc includes a `StateProof` interface sketch with a tagged proof type, the specific "don't hardcode" list, and five trigger conditions to revisit. One thing worth flagging: exclusion proofs are where a tree swap will hurt most — MPT and binary-tree "slot is unset" reasoning differ structurally, so keep that out of your public API.
