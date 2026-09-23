# Recommendation: build around MPT witnesses (eth_getProof), anchored to a consensus-verified header — and keep the proof format behind an interface

## TL;DR

Build your verifier around **Merkle Patricia Tree (MPT) storage proofs** — the
`eth_getProof`-style witness format — anchored to a block header you verify via a
consensus-layer light client (sync committees). It is the only state-proof format
that is **live on mainnet today**, nothing Scheduled for the next two forks
changes it, and every one of the alternatives is either dead or unscheduled.

Do **not** build around Verkle proofs. Verkle is the design the protocol moved
away from. The genuine forward direction — zkVM/STARK-based statelessness over a
future hash-based tree — has no committed format, no EIP number for the tree, and
not even a settled hash function, so it is a watch-item, not a dependency.

---

## Where Ethereum's state layer actually stands (checked on forkcast.org, Sept 2026)

### What's live

- **MPT state root in the block header** is the live state commitment. `eth_getProof`
  (EIP-1186) storage proofs against that root are implemented by every major EL
  client and are the de facto standard for exactly your use case. (EIP-1186 itself
  sits at "Stagnant" as a *specification* — that's spec maturity, not deployment
  status; the RPC method is universally live.)
- **CL sync-committee light clients** (the Helios-style path) are live since Altair
  and give you trust-minimized header verification — the anchor your state proofs
  must hang off, otherwise you're back to trusting the RPC for the header itself.
- **Fusaka went live Dec 3, 2025.** EIP-2935 (live since Pectra) serves recent
  block hashes from state, which helps your pipeline anchor recent blocks on-chain.

### What's dead: Verkle

Forkcast shows the entire Verkle family with **no fork relationship to any upgrade**:

| EIP | Title | Spec status | Fork relationship |
|-----|-------|-------------|-------------------|
| 6800 | Unified Verkle state tree | Stagnant | none |
| 4762 | Statelessness gas cost changes | Draft | none |
| 7545 | Verkle proof verification precompile | Stagnant | none |
| 7612 | Verkle state transition via overlay tree | Stagnant | none |
| 7736 | Leaf-level state expiry in Verkle trees | Stagnant | none |
| 7748 | State conversion to Verkle tree | Draft | none |
| 4942 | Stateless block witnesses with Verkle proofs | Draft | none |

If you commit your pipeline to Verkle witnesses, you are wiring to a design the
protocol has explicitly deprioritized. This is the trap to avoid.

### What's genuinely next — and how mature it really is

The statelessness effort has pivoted to **ZK proving of execution** rather than a
new state tree:

- **EIP-8025 "Optional Execution Proofs"** — *Proposed* for Hegotá (presented
  ACDC #178, May 2026). Opt-in zkEVM proofs of block payloads; no consensus-rule
  changes; the EF's Hegota tier list scored it "A-ish" and client implementations
  exist. This is where the protocol's witness infrastructure energy now is: the
  stateless guest program, execution witness construction, and SSZ stateless
  input/output schema. But note it's **Proposed, not Scheduled** — and even if it
  ships, it's a *block validity* proof stream for attesters, not a per-storage-slot
  proof format for dApps.
- **EIP-8272 "Recent Roots for Frame Transactions"** — *Proposed* for Hegotá. Would
  let transactions reference verified recent roots, which is the dApp-relevant
  version of "prove against a recent root." Also just Proposed.
- **Longer term, a STARK-provable hash-based state tree** — this is research only:
  no EIP, no fork relationship, and the hash function is still in flux. A Poseidon2
  attack paper landed (Feb 2026), and per the PQTS call of Sept 2, 2026, Poseidon
  is being dropped in favor of Blake/SHA-based proving ("Flock" on binary fields).
  You cannot safely build against a tree whose hash isn't chosen yet.

### What's in the forks that are actually scheduled

- **Glamsterdam** (Forkcast's working *estimate* is Dec 2, 2026 — a planning
  assumption, not an announced date): the Scheduled set contains **no state-tree
  change**. EIP-7928 (Block-Level Access Lists) is witness-adjacent but concerns
  intrablock access ordering, not your cross-block proof format. EIP-7688
  (forward-compatible consensus data structures) is Scheduled — watch it if you
  parse CL SSZ for light-client sync.
- **Hegotá** (planning; *estimate* ~mid-2027): no state-tree EIP Scheduled either;
  the state-related items (8025, 8272, 7709) are Proposed.

**Bottom line on timing:** on current scope, MPT witnesses remain the valid format
at least through Glamsterdam and, on present scope, through Hegotá. There is no
scheduled date — let alone a committed one — for any successor format.

---

## What to build

1. **Verifier core: MPT storage proofs.** Fetch `eth_getProof` witnesses for the
   target account + slot, verify the MPT inclusion proofs against the block
   header's `stateRoot`. This is live, well-tooled, and is what every archive-RPC
   fallback path speaks natively.
2. **Trust-minimized anchor: a CL light client.** Verify the header (and hence the
   `stateRoot`) via sync-committee attestations rather than trusting the RPC. This
   is where your "trust-minimized" claim actually lives — the MPT proof is only as
   good as the root it's checked against.
3. **Abstraction seam: a `StateProofVerifier` interface** with one job —
   `verify(witness, header_commitment) -> value`. Behind it, keep pluggable
   backends. This costs you almost nothing now and is what lets the *next* format
   (a STARK proof against a future tree root, or an EIP-8272-style recent-root
   reference) slot in without rewriting your pipeline.
4. **Design witnesses as a short-lived artifact.** Your product verifies *recent*
   state, which is the right constraint anyway: recent-block witnesses stay cheap
   to serve, and history expiry (EIP-7642/eth/69, live since Fusaka) means old
   *history* is increasingly not served by default peers. Don't build anything
   that requires serving proofs against arbitrarily old state without an archive
   fallback you explicitly chose.

## What NOT to take a hard dependency on

- **Verkle anything** — Stagnant across the board, no fork relationship.
- **EIP-8025 execution proofs as your format** — even if it lands in Hegotá it's
  opt-in, about payload validation, and Proposed (not Scheduled) today. Track it,
  don't build on it. The piece of it *worth* tracking closely is the **stateless
   input/witness SSZ schema** the zkVM effort is standardizing — if a
  protocol-native witness format emerges, it will descend from that work.
- **Any future hash-based tree / STARK state proof** — no EIP, no fork
  relationship, hash function undecided (currently shifting from Poseidon toward
  Blake/SHA per PQTS Sept 2026). Revisit quarterly; commit to nothing.

## Timing caveats that affect how hard you can lean on this

- The **Dec 2026 / mid-2027** dates above are Forkcast's projected-activation
  *estimates*, not announced dates — plan against scope, not dates.
- **Proposed ≠ Scheduled.** Any of the Hegotá items (8025, 8272) can slip a fork
  or land changed. Nothing scheduled for the next two forks invalidates MPT
  witnesses, and when something eventually does, it will arrive with a migration
  window measured in seasons, not weeks — your abstraction seam plus the fact that
  you only prove *recent* state is the hedge.
- **One genuine near-term watch item:** EIP-7688 (Scheduled for Glamsterdam)
  changes CL data-structure definitions; if your light-client sync parses CL SSZ
  itself, budget for a client update at the Glamsterdam boundary.

## Sources checked (forkcast.org, Sept 2026)

- EIP records: 1186, 2935, 4762, 4942, 6800, 7545, 7612, 7736, 7748, 7688,
  7928, 8025, 8272 — fork-relationship status histories per EIP.
- `/api/upgrades.json` — Fusaka Live (Dec 3, 2025); Glamsterdam Upcoming
  (projected 2026-12-02, estimate); Hegotá Planning (projected 2027-06-16,
  estimate).
- Call summaries: zkEVM call #007 (Aug 2026, EIP-7709/stateless input status),
  #008 (Sept 2026, EF Hegota tier list); PQTS #014 (Sept 2026, Poseidon dropped
  for Blake/SHA; Hegotá strawmap update); ACDC #178 (May 2026, EIP-8025 proposed
  for Hegotá).