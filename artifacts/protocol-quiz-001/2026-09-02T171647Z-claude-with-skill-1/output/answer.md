# State-proof format for a trust-minimized L1 light client

**Date of research: 2026-09-02. All fork-status claims below were verified against
forkcast, the EIP repo (raw meta EIPs), and ACD call issues on the day — re-check
before you freeze the design, because two of the numbers here are moving.**

## Recommendation in one line

Build the verifier around **today's live format: Keccak-hashed hexary Merkle-Patricia
Trie (MPT) proofs (`eth_getProof`-shaped: RLP account proof + per-slot storage proof),
anchored to a state root you obtain from a beacon-chain light client rather than from
the RPC provider.** Put the proof backend behind an interface so a future
**binary-tree** state format can be dropped in — but take **no hard dependency** on it,
and do **not** build on Verkle.

## Where the state layer actually stands (verified)

| Thing | Status | Evidence |
|---|---|---|
| Hexary MPT + Keccak, `eth_getProof` | **Live on mainnet.** The only state commitment that exists. | Current chain; last mainnet fork Fusaka activated 2025-12-03 |
| **Verkle** trees (EIP-6800, EIP-7612) | **Stagnant. No fork relationship. Effectively abandoned.** EIP-4762 / EIP-7748 remain `Draft` but are orphaned pieces of the Verkle transition. | `status: Stagnant` in eip-6800.md / eip-7612.md; absent from both live meta EIPs |
| **Unified binary tree** (EIP-7864) | **`Draft` spec maturity, no fork relationship.** Not in Glamsterdam. Not in Hegotá — not even in Hegotá's 52-entry *Proposed for Inclusion* list. Its own hash function is still undecided (BLAKE3 used for experimentation; Keccak and Poseidon2 are candidates — the EIP explicitly says "do not assume BLAKE3 is a final decision"). | eip-7864.md; EIP-7773 (Glamsterdam meta, `Review`); EIP-8081 (Hegotá meta, `Draft`) |
| **Glamsterdam** | 18 EIPs SFI. Public testnet *Plataberget* forked 2026-08-20; devnet-8 and repricing benchmarks were still open at ACDE #242 (2026-07-30). Mainnet targeted H2 2026, realistically Q4. **Contains nothing that changes the state trie.** | EIP-7773; ACDE #242 notes |
| **Hegotá** | Meta EIP `Draft`. SFI: only **EIP-7805 (FOCIL)** and **EIP-8141 (Frame Transaction)**. Timing explicitly dependent on Glamsterdam; press coverage points at late 2026–2027. | EIP-8081 |

**So: the direction of travel is real, but it is a research direction, not a schedule.**
Ethereum's state layer is genuinely heading toward a *SNARK-friendly binary tree that
unifies accounts, storage and code under uniform 32-byte keys* — that is the successor
to Verkle, and it is what the stateless/proving roadmap now assumes. But as of today it
is not scheduled for any named fork, its hash function is not chosen, and the fork that
would even *consider* it is at least one fork beyond the one still in testnet. Anyone
telling you to build for Verkle is working from 2024 material; anyone giving binary tree
a ship date is inventing one.

## What to build

**1. Trust anchor — this is where the real trust-minimization lives, not the trie.**
Verify a beacon block header yourself via the Altair sync-committee light-client
protocol (live since 2021, supported by all CL clients), then walk
beacon header → execution payload header → `stateRoot`. The state root must never come
from the same RPC you are asking for proofs. A correct MPT proof against an
attacker-supplied root proves nothing.

Helpful here: **EIP-7688 (Forward compatible consensus data structures)** is **SFI in
Glamsterdam** — it stabilizes SSZ container layouts so your generalized indices into
beacon structures stop breaking every fork. That is a direct, scheduled win for your
proof paths.

**2. Proof format — MPT today.** Account proof (RLP-encoded nodes down to the account
leaf: nonce, balance, storageRoot, codeHash) plus a storage proof per slot against
`storageRoot`. Verify Keccak-256 node hashing and hexary path traversal yourself. Handle
exclusion proofs. This works on mainnet right now, is served by every client and
provider, and requires no protocol change.

**3. Isolate the format behind an interface.** Concretely:

- `StateCommitment { blockNumber, blockHash, stateRoot }` — produced by the
  light-client anchor, independent of trie shape.
- `StateProofBackend.verify(commitment, address, slot) -> Option<Value>` — with an
  `MptKeccakBackend` today. A `BinaryTreeBackend` later is a new implementation, not a
  rewrite.
- Never leak RLP node types, 16-way branch nodes, hex-nibble paths, or "storage root is
  a separate subtree" into your dApp-facing API or your on-chain/serialized witness
  types. The binary tree collapses accounts, code and storage into one tree with 32-byte
  keys — code that assumes two-level structure will not survive it.
- Version your witness envelope from day one (`proof_kind` tag + version). During any
  future migration both trees exist simultaneously (the MPT gets frozen and converted
  over many blocks), so your verifier will need to accept two proof kinds at once for a
  transition period.

**4. Do not hardwire a hash.** Keep the hash function a backend property. Betting on
Poseidon2 (or BLAKE3) today is betting on an open decision.

## Timing risk — how hard a dependency you can take

- **On MPT proofs: a hard dependency is safe.** They are live, and even in the most
  aggressive plausible timeline they remain the mainnet format through Glamsterdam and
  Hegotá. Any replacement arrives via a scheduled hard fork with client releases and
  months of testnet warning, plus a conversion period — you will not be surprised.
- **On binary-tree proofs: no dependency of any kind.** Not in a roadmap slide for
  investors, not in a scoped milestone, not in a contract you cannot upgrade. If a
  design decision only makes sense assuming the binary tree ships, defer it.
- **Practical planning number:** treat "mainnet state root is no longer a Keccak hexary
  MPT root" as **not before 2027, unscheduled, and quite possibly later** — with the
  caveat that an unscheduled feature has no date at all, and this one has an unresolved
  hash choice blocking it.

## Watch list (things that could touch your verifier before the trie changes)

These are all `Draft` / *Proposed for Inclusion* in Hegotá — not committed, but they hit
your assumptions more directly than the trie does, so track them on the ACD calls:

- **EIP-7862 (Delayed State Root)** — would make a block header's state root lag
  execution. This breaks a naive "state root in header N reflects block N" assumption.
  Keep the mapping from commitment to block explicit rather than implicit.
- **EIP-7807 (SSZ execution blocks)** — changes execution header structure and therefore
  how you extract `stateRoot` and prove header fields.
- **EIP-8025 (Optional Execution Proofs)** — the validity-proof direction; potentially a
  future alternative anchor, but nowhere near committed.
- **EIP-7928 (Block-Level Access Lists)** — **SFI in Glamsterdam**. Not a state proof,
  but it publishes per-block state-diff structure and may become a useful cheap
  freshness/consistency signal alongside your proofs.
- **State/history expiry** — repeatedly deferred. Don't assume your provider can serve
  proofs at arbitrarily old blocks; your "recent block" framing already protects you,
  so keep it.

## One thing the proof format does not solve

Proofs give you *correctness* without trusting the provider; they do not give you
*availability* or *liveness*. A provider can still withhold or stall. Query ≥2
independent sources, and make "no valid proof obtained" a distinct, explicit outcome in
your API rather than something that degrades into a stale or default value.

## Sources checked (2026-09-02)

- [forkcast.org](https://forkcast.org) — upgrade index (Glamsterdam, Hegotá)
- [EIP-7773: Hardfork Meta – Glamsterdam](https://eips.ethereum.org/EIPS/eip-7773) (`Review`; 18 EIPs SFI, no state-trie change)
- [EIP-8081: Hardfork Meta – Hegotá](https://eips.ethereum.org/EIPS/eip-8081) (`Draft`; SFI = EIP-7805, EIP-8141; EIP-7864 absent from all categories)
- [EIP-7864: Ethereum state using a unified binary tree](https://eips.ethereum.org/EIPS/eip-7864) (`Draft`, created 2025-01-20; hash function undecided)
- [EIP-6800: unified verkle tree](https://eips.ethereum.org/EIPS/eip-6800) (`Stagnant`), [EIP-7612: Verkle state transition via overlay tree](https://eips.ethereum.org/EIPS/eip-7612) (`Stagnant`)
- [ACDE #242, 2026-07-30](https://ethereum-magicians.org/t/all-core-devs-execution-acde-242-july-30-2026/29043) — Glamsterdam devnet-8 / Plataberget testnet status
- [EF Checkpoint #9, 2026-04-10](https://blog.ethereum.org/2026/04/10/checkpoint-9) — Glamsterdam blocked on ePBS; Hegotá timing dependent on it
- [Fusaka mainnet announcement](https://blog.ethereum.org/2025/11/06/fusaka-mainnet-announcement) — last mainnet fork, activated 2025-12-03
