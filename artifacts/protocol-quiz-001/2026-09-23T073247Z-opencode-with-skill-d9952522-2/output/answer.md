# Recommendation: build your verifier around Merkle Patricia Trie (MPT) proofs against a light-client-verified state root — with a swappable proof-format abstraction

## Bottom line

Build your state proofs around the **existing hexary MPT proof format** (the `eth_getProof` account/storage proof), verified against the block header's `stateRoot`, where that header is itself anchored by the **consensus-layer light client protocol** (sync committee, live since Altair). This is the only state-proof approach that is actually live on mainnet today, and nothing in the scheduled fork pipeline (Glamsterdam, Hegotá) changes the state tree.

Do **not** build around Verkle trees, and do **not** take a hard dependency on the binary state tree (EIP-7864). The binary tree is the direction the protocol is genuinely heading, but it is a Draft EIP with **no fork relationship** — not scheduled, not even CFI'd for any fork — and its core cryptographic parameter (the hash function) is explicitly undecided. Wire your pipeline so the proof format is a replaceable backend, not an assumption baked into the verifier.

## Where Ethereum's state layer stands today (verified 2026-09-23)

**Live on mainnet:**
- State is committed in the hexary Merkle Patricia Trie. A storage slot is proven by an MPT proof (account proof + storage proof) checked against the `stateRoot` in the execution header.
- Trust-minimized access to that header is available via the consensus light client sync protocol: beacon block body → execution payload header → `stateRoot`, all SSZ Merkle proofs under a sync-committee-signed header. This is what Helios-style clients do today.
- The `eth_getProof` RPC response format is de-facto standard across clients and is exactly the MPT proof you verify locally — you fetch it from any untrusted provider and verify it yourself.

**Scheduled forks (checked on forkcast.org):**
- **Glamsterdam** (testing on public testnets; forkcast's planning *estimate* for mainnet is 2026-12-02 — an estimate, not an announced date): headliners are Block-level Access Lists (EIP-7928) and ePBS, plus gas repricing (EIP-8037/8038) and state-growth metering. No state-tree change.
- **Hegotá** (early planning; forkcast estimate 2027-06-16, again only an estimate): the only SFI'd (Scheduled) items are the two headliners — FOCIL (EIP-7805) and Frame Transactions (EIP-8141). No state-tree change. EIP-7862 (delayed state root) was **DFI'd** for Hegotá on ACDE #245 (2026-09-10), with a note it "may [be] revisit[ed] post-Glamsterdam or alongside binary trie work" — i.e., binary-trie work is acknowledged as future work but is not on any fork's scope.

**Proposals with no fork relationship (not scheduled anywhere):**
- **EIP-7864 — unified binary state tree.** Status: **Draft**. `forkRelationships: []` on forkcast — zero fork tracking. This is the heir apparent to the state layer: it replaces the MPT with a single binary tree covering accounts, code, and storage, explicitly motivated by (a) much smaller Merkle proofs (arity-2 minimizes sibling count), (b) ZK-proving friendliness (no RLP, no extension nodes, code chunkified into the tree), and (c) post-quantum security (hash-only construction). The EIP itself states the binary tree will "probably be the final state tree used in the protocol."
- **EIP-6800 — Verkle trees.** Status: **Stagnant**, no fork relationship. Verkle was the previous state-tree plan and has been superseded in practice by the binary-tree direction (Verkle's elliptic-curve commitments are not post-quantum secure, and proving-system progress eroded its proof-size advantage). Do not build on Verkle.

## Why not build around the future format now

1. **EIP-7864 is not scheduled.** It has never been CFI'd, let alone SFI'd, for any fork. A "Draft" EIP status describes spec maturity, not fork inclusion. Under Ethereum's process it cannot reach mainnet before the fork after Hegotá at the absolute earliest — realistically 2028 or later, and it could change shape or stall entirely.
2. **The spec is explicitly unstable.** The EIP warns the hash function "is not final": the reference implementation uses BLAKE3 as a placeholder, with Keccak and Poseidon2 as candidates — and recent PQ breakout calls (PQTS #14, 2026-09-02) show the ecosystem moving *away* from Poseidon toward Blake/SHA-family hashes. Committing to a proof format whose hash function is undecided would be committing to a moving target.
3. **The witness/execution-proof formats are also unsettled.** `debug_executionWitness` and the "execution witness" spec are still being standardized (L1-zkEVM breakouts; RPC Standards #34, 2026-09-07: spec stalled, clients return divergent formats). EIP-8025 (optional execution proofs) is only Proposed for Hegotá. None of this is consensus-committed data you can rely on today.

## Why MPT proofs are safe to build on — with one architectural caveat

- The MPT is the live, consensus-committed format and remains so through both scheduled forks. You are not depending on a proposal; you're depending on the current protocol, which gives you the strongest possible stability guarantee available.
- MPT proofs are bigger and uglier than binary-tree proofs (an MPT branch proof for a 2^32 tree is ~4 KB vs ~0.8 KB for binary), but for a single storage slot against a recent block this is entirely workable.
- **Caveat — build the proof format behind an interface.** EIP-7864's own backwards-compatibility section states that when the tree changes, "in-EVM proofs of historical state no longer work" — i.e., when the binary tree eventually ships, the proof format for current state changes, and your verifier will need a new backend. The EIP's design (new tree starts empty, MPT frozen per EIP-7612, migration later per EIP-7748) means old state stays provable against frozen MPT roots during the transition, but you should assume a format migration happens on a multi-year horizon and keep the verifier's proof-verification layer pluggable (proof type, hash function, and node encoding behind one interface, with the consensus-anchored header verification unchanged).

## Timing guidance — how hard a dependency you can take

| Dependency | Status | Safe to hard-depend on? |
|---|---|---|
| MPT proofs via `eth_getProof` + sync-committee light client for the header | **Live** | Yes — this is your build target |
| Binary state tree (EIP-7864) | **Draft, no fork relationship**, hash function TBD | No — track it, design for it, don't wire to it |
| Verkle (EIP-6800) | **Stagnant**, no fork relationship | No — direction abandoned in practice |
| Execution-witness standard (debug_executionWitness / EIP-8025) | Unstandardized / Proposed | No |

Practical triggers to revisit: EIP-7864 gaining a fork relationship (CFI for a named fork) on forkcast, and a final decision on its hash function. Until both happen, your MPT-based pipeline is aligned with where the protocol *is*, and a pluggable proof backend keeps you aligned with where it's *going*.

## Sources checked (2026-09-23)

- forkcast.org `/api/eips/7864.json` — EIP-7864: Draft, empty `forkRelationships`
- forkcast.org `/api/eips/6800.json` — EIP-6800 (Verkle): Stagnant, empty `forkRelationships`
- forkcast.org `/api/eips.json` and `/api/eip-stage-changes.json` — Hegotá scope: only EIP-7805 (FOCIL) and EIP-8141 (Frame Transactions) Scheduled/headliners; EIP-7862 DFI'd 2026-09-10
- forkcast.org `/api/upgrades.json` — Fusaka live (Dec 3, 2025); Glamsterdam upcoming (projected 2026-12-02, estimate); Hegotá planning (projected 2027-06-16, estimate)
- forkcast.org call summaries — ACDE #245 (2026-09-10): EIP-7862 DFI'd, "may revisit … alongside binary trie work"; PQTS #14 (2026-09-02): hash-function direction moving from Poseidon toward Blake/SHA; RPC Standards #34 (2026-09-07): execution-witness spec stalled
- eips.ethereum.org/EIPS/eip-7864 — spec text, including "hash function not final" and backwards-compatibility notes
