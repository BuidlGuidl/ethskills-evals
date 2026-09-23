# Recommendation: build on MPT proofs (EIP-1186) today, behind an abstraction, and plan for the binary tree — not Verkle

## TL;DR

Build your verifier's v1 state-proof path around **EIP-1186 Merkle Patricia Trie (MPT)
witnesses** (`eth_getProof`-style proofs of an account and storage slot, verified
against the `stateRoot` of a header you trust via a consensus light client). Design
the witness/verification layer so a **binary tree proof backend can be added
later**. Do **not** wire anything to Verkle trees — that is the design the protocol
is moving away from.

The direction Ethereum's state layer is genuinely heading is a **hash-based binary
Merkle tree** (EIP-7864, evolved into EIP-8297 "Partitioned Binary Tree", with
EIP-8347 as the current migration proposal). But it is **not scheduled into any
fork**, its hash function is not final, and no realistic mainnet activation happens
before ~2027 at the earliest. That's far too soft a dependency to build a product
pipeline around today — while MPT is the live, only, and durable format.

## Where Ethereum's state layer stands today (Sep 2026)

- Mainnet state commitment is still the **hexary Keccak Merkle Patricia Trie** —
  accounts trie + per-contract storage tries, RLP-encoded. This has been true since
  genesis and is unchanged through Fusaka; **Glamsterdam (next fork, mainnet
  targeted ~Q4 2026) contains no state-tree change**. Its scope is ePBS (EIP-7732),
  Block-level Access Lists (EIP-7928), gas repricing (EIP-8037/8038), and
  networking (eth/70, eth/71).
- The only witness format you can actually obtain and verify on mainnet today is
  the **EIP-1186 proof** served by every EL client's `eth_getProof`: an MPT
  membership/non-membership proof for an account and its storage trie. Anyone can
  generate it (any full node or RPC provider), and your verifier checks it against
  the `stateRoot` — which is exactly your trust-minimization requirement: **witness
  generation is untrusted; only the header anchor matters.**
- Near-term protocol work is still investing in the MPT-witness world: e.g., code
  chunking (EIP-2926) was championed by client teams for Glamsterdam specifically
  to shrink MPT code witnesses and remove ZK-prover hazards. The protocol is not
  treating the MPT as dead in the interim.

## What the protocol is genuinely moving toward — and what it abandoned

**Verkle trees (EIP-6800) are the trap.** For years ("The Verge", 2021–2024)
Verkle was *the* statelessness plan. That changed:

- **EIP-6800 is marked Stagnant** in the EIPs repository. On the Stateless
  Consensus call, the authors themselves now say Verkle has "a low chance of being
  used," and participants agreed binary trees have the better shot at being the
  state-tree switch.
- Two reasons drove the pivot: (1) Verkle's KZG/pairing cryptography is **not
  post-quantum secure** (NIST recommends dropping ECC by 2030), so shipping Verkle
  would mean *another* full tree conversion later; (2) Verkle proving performance
  remained tight on commodity hardware, while hash-based trees pair naturally with
  modern STARK-style proving systems.

**The binary tree line is real and active:**

- **EIP-7864** (Jan 2025, authored largely by the former Verkle team — Vitalik,
  gballet, dankrad, jsign, et al.): unified binary tree, single key:value space,
  no RLP, chunked code, account data co-located in 256-value stems — the
  witness-format *ideas* carry over from Verkle, but rebuilt on plain hash
  functions (quantum-safe, no new crypto stack).
- It has already evolved: **EIP-8297 "Partitioned Binary Tree" (PBT)** (June 2026)
  refines the tree layout into zones, and **EIP-8347** (July 2026) specifies the
  migration: convert full state offline at an anchor block, distribute a
  verifiable PBT snapshot, **catch up to tip by replaying Block-Level Access Lists**
  (EIP-7928 — a Glamsterdam headliner), and swap at a single `SWAP_FORK` with both
  trees maintained through a transition window.
- Execution-specs landed binary-trie plumbing in July–Aug 2026 (a per-fork
  `StateCommitment` enum: MPT/BINARY), and the forkcast-indexed fork pipeline
  (Glamsterdam → Hegotá/Heka-Bogotá) shows the groundwork being laid.

That BAL replay is the mechanism PBT catch-up depends on is strong evidence the
binary tree is the planned destination, not a side experiment. But note the hash
function is **still TBD** — BLAKE3 is the current placeholder for implementation
friction; Keccak and Poseidon2 (pending security analysis) are candidates. A
witness format isn't frozen until that decision is.

## Timing: why you can't take a hard dependency on the binary tree yet

- **Nothing is scheduled.** EIP-7864/8297/8347 have no CFI or SFI relationship with
  any fork. Glamsterdam (~Q4 2026) has no tree change. Hegotá (Heka/Bogotá, the
  post-Glamsterdam fork, projected ~2027) is in early planning, and its PFI queue
  contains things like ML-DSA precompiles and system-call improvements — not a
  tree transition. Realistic mainnet activation: **2027+, likely later**, given the
  fork pipeline and that the spec is still churning (7864 → 8297 → 8347 within a
  year).
- **The design itself keeps MPT valid for a long time.** Every migration variant
  proposed (EIP-7748, now EIP-8347) freezes the MPT, maintains both trees through a
  transition window, and preserves historical roots. MPT proofs against historical
  block headers remain verifiable indefinitely; a state transition does not strand
  your verifier — it just eventually requires a second proof backend.
- **Ignore stale press.** Some 2026 articles still claim "Verkle moved to Hegotá."
  EIP-6800 is Stagnant and the active engineering (devnets, execution-specs, the
  EIP-8297/8347 line) is binary-tree. This is exactly the "old blog post vs.
  current fork scope" trap.

## What to build, concretely

1. **Anchor:** a consensus-layer light client (sync-committee based, Helios-style)
   gives you recent/finalized execution headers without trusting an RPC provider.
   This piece is **tree-agnostic** — the header `stateRoot` is your trust anchor
   regardless of which tree backs it.
2. **Proof backend v1 (build now):** EIP-1186 MPT proof fetch + local
   verification (Keccak-256 MPT membership proofs for the account trie, then the
   storage trie; check storageRoot → slot value). Mature reference implementations
   exist across ecosystems; small, auditable code.
3. **Architecture:** make the backend pluggable — a `StateProof` interface
   (`verify(header.stateRoot, address, slot) -> value`) with a versioned witness
   envelope at your service boundary. The Glamsterdam→PBT era then becomes "add
   backend #2," not "rewrite the pipeline."
4. **Trigger list for adding the PBT backend** (track on forkcast.org / ACD):
   - EIP-8297 + EIP-8347 reach **CFI, then SFI**, for a named fork;
   - the merkleization hash function is **final** (Poseidon2 security verdict or
     BLAKE3/Keccak decision) — don't implement against a placeholder hash;
   - multi-client devnet matrices show working, interoperable witnesses.
5. **Plan for a dual-format window:** per EIP-8347 both trees are live through
   `SWAP_FORK` finality, so during migration your service must select the backend
   by fork/epoch. Budget for that now via the versioned witness envelope.

## Bottom line

- **Verkle = the design the protocol is moving away from.** Do not build on it.
- **Binary tree (PBT) = where Ethereum's state layer is genuinely going.** Commit
  to *compatibility plans* for it, but its Draft status, unresolved hash function,
  and unscheduled fork mean it can only be a soft, abstracted dependency today.
- **MPT/EIP-1186 = the only live format, and a safe one**: it stays the mainnet
  commitment through at least Glamsterdam and Hegotá, remains verifiable for
  historical blocks even after any future swap, and satisfies your trust-minimized
  requirement right now. Build v1 on it, behind an interface that makes the PBT the
  drop-in successor.
