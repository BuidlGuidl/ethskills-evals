# Recommendation: what to build our state-proof verifier around

## TL;DR

Build the verifier around **today's keccak/RLP Merkle Patricia Trie (MPT) witnesses** —
the EIP-1186 `eth_getProof` format (account proof + storage proof checked against the
`stateRoot` of a trustlessly-obtained block header) — but architect it as a **pluggable
proof backend**, with the committed second backend being the **hash-based binary tree**
that Ethereum's state layer has actually converged on (EIP-7864, now refined into
EIP-8297, the "Partitioned Binary Tree").

**Do not build anything on Verkle trees (EIP-6800).** Verkle was the plan for years, but
the protocol's stateless workstream pivoted away from it in 2025, and by 2026 the
roadmap has converged on the binary tree. Wiring our pipeline to Verkle would be wiring
it to a design Ethereum is moving away from — exactly what we want to avoid.

## Where Ethereum's state layer stands today (Sept 2026)

- Mainnet state is still the **hexary keccak MPT**. Every block header commits to the
  account trie root; each contract account commits to its storage trie root. The only
  production witness format that exists today is the MPT branch proof served by
  `eth_getProof` (EIP-1186).
- **Fusaka** went live Dec 3, 2025 (PeerDAS + BLOb scaling). **Glamsterdam** is next,
  expected on mainnet Q4 2026 (Sepolia fork Oct 6). Glamsterdam is big — ePBS
  (EIP-7732), Block-Level Access Lists (EIP-7928), state-creation gas repricing
  (EIP-8037), gas-limit schedule (EIP-8261) — but it contains **no state tree change**.
  Notably, BALs and the gas repricing are *groundwork* for statelessness (witness-cost
  accounting, parallel execution, and — per the migration spec — replayable state
  updates), not the tree swap itself.
- Weak statelessness and state expiry remain in the research phase. ethereum.org's own
  statelessness page (updated June 2026) still describes them as "several years away."
  There is no protocol-native witness service our dApp could consume today even if we
  wanted to; our service fills that gap and will keep filling it for years.

## Where the state layer is genuinely going

The trajectory is well documented and consistent across primary sources:

1. **2019–2024: Verkle was the plan.** EIP-6800 (unified Verkle tree), EIP-4762 (witness
   gas), EIP-7612/7748 (overlay tree + state conversion), years of Verkle devnets
   (Kaustinen et al.). The entire "Verge" roadmap item was originally synonymous with
   Verkle.

2. **2025: the pivot away from Verkle.** Two things broke Verkle's case:
   - **Post-quantum exposure.** Verkle proofs rest on elliptic-curve vector
     commitments (Bandersnatch/Banderwagon + IPA). Quantum estimates moved left
     (NIST advised sunsetting ECC by 2030), so deploying Verkle meant committing to a
     *second* full tree migration later.
   - **Provers got fast.** SNARK/STARK proving throughput improved ~an order of
     magnitude, eroding Verkle's core advantage (small, cheaply-verifiable witnesses).
     Vitalik's "The Verge" post (Oct 2024) already framed "STARKed binary hash trees"
     as the natural alternative, and by 2025 the stateless working-group calls
     concluded Verkle had "a low chance of being used"; further devnets were announced
     as binary, not Verkle.

3. **2026: convergence on the binary tree.** A March 2026 ethresear.ch post states it
   plainly: the L1 roadmap "has converged on binary state trees (EIP-7864) as the
     long-term state commitment mechanism, with a path toward O(1) SNARK verification
   of state proofs." The concrete 2026 artifacts:
   - **EIP-7864** (unified binary tree, Jan 2025 draft): single tree, no RLP, code
     chunkified into the tree, unified account+storage key space, hash-based (BLAKE3
     reference implementation; Keccak and Poseidon2 candidates pending EF security
     analysis).
   - **EIP-8297 — Partitioned Binary Tree** (June 2026, draft): the successor to
     7864. Zones for account headers / code / storage, content-addressed code, ~1 KB
     branch proofs (vs ~4–6 KB MPT branches today), designed to be verifiable both as
     plain Merkle branches and inside SNARK/STARK circuits.
   - **EIP-8347** (July 2026): offline state migration to the PBT — state is converted
     off the consensus path at a finalized anchor block, distributed as a verifiable
     snapshot, caught up by **replaying Glamsterdam's Block-Level Access Lists**, and
     made canonical at a single future hard fork (`SWAP_FORK`). A full mainnet
     conversion has already been benchmarked end-to-end (Erigon, BLAKE3), and geth has
     an open implementation PR for EIP-8297 — including an adapted `eth_getProof`.

So the endgame format is: **hash-based, post-quantum-safe binary-tree branches,
optionally STARK-compressed at block scale**. Verkle is off the path.

## Why this is good news for our specific product

We prove **one storage slot as of a recent block** — not worst-case block witnesses.
That changes which part of the design matters:

- For small proofs, plain Merkle branches are the right tool in *both* the current and
  the future design (Vitalik makes this point explicitly in "The Verge": for proofs
  covering a few state objects, use Merkle branches directly — STARK compression only
  pays off at block scale). Our verifier never needs a STARK.
- The binary tree keeps single-key proofs as Merkle branches (~32 sibling hashes ≈
  ~1 KB). So the post-migration change for us is a **format swap, not a redesign**:
  same architecture (trusted `stateRoot` → inclusion proof → value), different
  encoding/hash. This is exactly why modularity is the right commitment now.

## What to build

1. **Header trust:** a beacon-chain light client (sync-committee based) to obtain a
   recent finalized/most-recent header without trusting any RPC. The header gives us
   `stateRoot`.
2. **Witness backend #1 (ship now):** EIP-1186 `eth_getProof`-style MPT witnesses —
   account proof to the header `stateRoot`, then storage proof to the account's storage
   root. Verify keccak/RLP MPT inclusion ourselves; the RPC provider (any full node
   with recent state, no archive node needed) can only serve us bad proofs that fail
   verification. Cross-check multiple independent providers if we want availability,
   not trust.
3. **Backend interface:** abstract `verify(stateRoot, address, slot, value, witness,
   format)` so the MPT backend is one implementation.
4. **Backend #2 (design now, implement when the spec stabilizes):** binary-tree branch
   proofs per EIP-8297. Note geth's PBT work already extends `eth_getProof` to the new
   tree, so the serving interface we integrate against today is likely the same one
   we'll use post-fork.
5. **Explicitly version** the proof payloads we pass to the dApp (bind block hash,
   state commitment, proof format/hash suite) so a future format change is a clean
   version bump, not a silent break.

## What NOT to take a dependency on, and why

- **Verkle (EIP-6800) / Bandersnatch-IPA proof verification.** Off the roadmap for L1
  for the reasons above. Any investment here (the EC verification stack in
  Solidity/Rust is genuinely hairy) is stranded cost.
- **A hard dependency on EIP-8297's exact byte format today.** It is a *Draft*; the
  binary-tree spec already churned once this year (7864 → 8297), and the merkelization
  hash is explicitly still open (BLAKE3 reference; Keccak and Poseidon2 under
  consideration, with Poseidon2 gated on the EF's ongoing formal security assessment).
  Commit to the *architecture* (binary Merkle branches over a unified hash tree);
  implement against concrete encodings only once the EIP moves toward "Scheduled for
  Inclusion."
- **A hard fork date for the tree swap.** No `SWAP_FORK` is scheduled; Glamsterdam
  (Q4 2026) doesn't include it, so mainnet PBT activation is realistically **2027 at
  the earliest**, plausibly later. Our MPT backend has a multi-year service life.
- **State expiry / "weak statelessness" as an alternative.** Still research-phase; also
  note that even after any future tree swap, MPT proofs remain valid against
  pre-fork `stateRoot`s, and EIP-8347 specifies a dual-tree transition window — so a
  verified MPT pipeline degrades gracefully rather than breaking.

## Timing flags, summarized

| Milestone | Status (Sept 2026) | Impact on us |
|---|---|---|
| MPT / `eth_getProof` witnesses | Live, stable | Build on it now |
| Glamsterdam (ePBS, BALs, gas repricing) | Q4 2026, no tree change | None on proof format |
| Binary tree (EIP-7864 → EIP-8297 PBT) | Draft; client prototypes + full mainnet conversion benchmark exist | Design backend #2 now; implement when hash + encoding freeze |
| Tree swap hard fork (`SWAP_FORK`, EIP-8347) | Unscheduled; 2027+ earliest | MPT backend's minimum service life |
| STARK-compressed state proofs (O(1) verify) | Research/no standardized format | Ignore; irrelevant at single-slot scale |

## Bottom line

Commit to **MPT witnesses (EIP-1186) as the shipping format, behind a versioned,
pluggable proof-verification interface, with the binary tree (EIP-8297) as the planned
and architecturally reserved second backend**. This aligns with where Ethereum's state
layer is *actually* heading — a post-quantum hash-based binary tree with Merkle-branch
proofs for small use cases like ours — while keeping us off the two things that would
hurt: Verkle tooling the protocol has abandoned, and draft-spec byte formats that
are still churning.