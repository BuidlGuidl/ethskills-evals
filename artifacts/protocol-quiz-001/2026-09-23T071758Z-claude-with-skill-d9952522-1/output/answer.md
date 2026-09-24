# State-proof format for a trust-minimized L1 light client

**Date of research: 2026-09-23.** All status claims below were checked against live sources
(listed at the bottom), not from memory.

## Short answer

**Build the verifier around today's Merkle-Patricia Trie (MPT) proofs — `eth_getProof` /
EIP-1186 account + storage proofs verified against the execution payload's `stateRoot` — and
get your trust-minimization from the *consensus layer* (sync-committee → beacon block →
execution payload header), not from the state-tree format.**

**Do not build around Verkle.** Verkle is the design the protocol is moving *away* from.

**Do design for the binary tree (EIP-7864) as the successor, but do not take a hard dependency
on it.** It is the genuine direction of travel for Ethereum's state layer, but as of today it is
a Draft EIP with **no fork relationship at all** — not scheduled, not even formally considered
for the next two upgrades — and one of its load-bearing parameters (the hash function) is still
explicitly undecided.

The practical shape: an MPT proof verifier behind a `StateProofVerifier` interface, with the
header-follow logic (the part that actually earns you "trust-minimized") kept strictly separate
and tree-agnostic.

---

## Where Ethereum's state layer actually stands today

**Live on mainnet:** a hexary Merkle-Patricia Trie keyed and hashed with keccak256, with a
separate storage trie per account. Proving a storage slot means two chained MPT proofs: account
proof from `stateRoot` to the account leaf, then storage proof from that account's `storageRoot`
to the slot. This is exactly what `eth_getProof` (EIP-1186) returns, it is served by every major
client, and it is the only state-proof format that exists on mainnet. Nothing has replaced it.

**Verkle: pivoted away from.** The Verkle family (EIP-6800 unified Verkle tree and friends)
never shipped. No client completed a mainnet migration, and during 2025–2026 research and core
dev attention moved off it toward a binary hash tree. The reasons are structural, not
scheduling: Verkle's vector commitments need a **trusted setup**, and they are **not
post-quantum secure**, whereas a plain binary hash tree needs neither. Note that some
documentation — including ethereum.org's own roadmap page — still describes Verkle as the
statelessness path. That page lags the actual core-dev direction; treat it as stale. If you wire
your pipeline to Verkle polynomial-commitment witnesses you will be building against a design
with no fork relationship and no constituency pushing it.

**Binary tree (EIP-7864): the real direction, but unscheduled.**
- **Status: Draft** (Standards Track: Core), created January 2025. Specification maturity only.
- **Fork relationship: none.** It is not SFI and not CFI for **Glamsterdam**, and it is not
  among the proposals on the **Hegotá** table either. Neither upgrade has a state-tree headliner.
- What it does: collapses accounts, storage, and code into a **single unified binary tree** with
  a uniform 32-byte key → 32-byte value layout. That removes the account-trie/storage-trie split
  entirely — a slot proof becomes one path in one tree, and proof branches get materially shorter
  than hexary MPT branches (secondary coverage cites roughly 3–4x fewer/shorter branch nodes;
  treat the exact number as unconfirmed).
- **The hash function is not decided.** The EIP text says so explicitly: the reference
  implementation currently uses BLAKE3, with Keccak and Poseidon2 both still live candidates,
  and warns "do not assume BLAKE3 is a final decision." Poseidon2 vs BLAKE3 is not a detail for
  you — it changes the hash primitive your verifier must implement, and if you ever want to SNARK
  your verification it changes the cost by orders of magnitude. **This parameter alone makes a
  hard dependency unsafe right now.**
- Migration is a separate unsolved piece: EIP-7864 references EIP-7612 (fork mechanics, new tree
  starts empty, old MPT frozen) and EIP-7748 (migrating existing state over). Even after the
  tree lands, there is an extended overlap period where state lives across two structures.

**Forks in flight, for timing context:**
- **Glamsterdam** — headliners EIP-7732 (enshrined PBS) and EIP-7928 (Block-Level Access Lists).
  Testnet path in progress: Sepolia proposed for Sep 28 2026, Hoodi Oct 26 2026, so mainnet
  realistically late 2026 into early 2027. No state-tree change.
- **Hegotá** — the fork after that. FOCIL (EIP-7805) is the confirmed headliner, targeting
  censorship resistance. Active EIP discussion through Sep–Oct 2026. No state-tree change.

So the state tree is **at least two forks away from changing**, and it has not yet been claimed
as a headliner for any named fork. Realistic earliest mainnet activation is 2027+, and that is an
inference from the fork cadence, not a commitment anyone has made.

---

## Why this leads to the recommendation

The decision that matters most for a trust-minimized light client is **not** the state-tree
format. It is *how you learn a trustworthy `stateRoot`*. That is the part that removes the RPC
provider from your trust set, and it is entirely independent of tree shape:

1. Follow the beacon chain via **sync committee** signatures (Altair, live since 2021) — a
   Helios-style light client. This gives you a finalized/optimistic beacon block header you
   verified cryptographically, not one an RPC told you about.
2. From that beacon header, walk the SSZ Merkle proof down to the **execution payload header**,
   giving you an authenticated execution-layer `stateRoot`.
3. Verify a **state proof** of your storage slot against that `stateRoot`.

Steps 1 and 2 are stable across every state-layer proposal on the table — Verkle, binary tree,
or status quo. They are also where the actual trust-minimization lives. **Only step 3 changes**
when the state tree changes. Build the pipeline so that step 3 is the only replaceable part and a
future tree swap is a contained change, not a re-architecture.

A concrete note on the current tree that matters for step 3: MPT proofs let you prove a slot is
**absent** as well as present (exclusion proofs via the terminating node), and your verifier must
handle that case explicitly — a missing slot is a legitimate answer of `0`, not an error. Get this
right now; the binary tree has the same requirement in a different shape.

Also worth tracking, though it is not a state-proof format: **EIP-7928 Block-Level Access Lists**
is a Glamsterdam headliner and will publish per-block lists of accessed state. That is useful for
knowing *which* slots changed in a block without polling, but it does not replace a state proof —
it does not let you verify a value against a root. Don't confuse the two.

---

## Recommended build

**Now (do this):**
- Verifier consumes `eth_getProof` output: account proof → account RLP → `storageRoot` →
  storage proof → slot value. Verify both against the `stateRoot` from your consensus-layer
  follow, never against a `stateRoot` the RPC supplied.
- Put it behind an interface roughly like
  `verify(state_root, address, slot, proof) -> Option<U256>`, with the proof type opaque to
  callers. Callers should never see RLP nodes, node hashes, nibble paths, or a keccak call.
- Keep the hash function pluggable at the verifier boundary. Today it is keccak256 everywhere;
  EIP-7864 will not be keccak by default and might not be keccak at all.
- Keep the consensus-layer follow (sync committee + SSZ proof to the execution header) in its
  own module with zero knowledge of tree internals. Reuse an audited light-client implementation
  here rather than writing sync-committee verification yourself — it is the highest-consequence
  code in the system.
- Since you asked about a *recent* block: note sync-committee light clients track the optimistic
  head ahead of finality. Decide explicitly, and document, whether your dApp accepts optimistic
  (~1 slot, reorg-able) or requires finalized (~13 min) state. This is a bigger correctness
  question for you than the tree format is.

**Hedge (cheap, do it now):**
- Write a conformance test suite against the *interface*, not the MPT implementation, so a
  second backend can be validated against the same vectors.
- Do not persist MPT-shaped proof blobs in any long-lived store or public API schema. Version
  your witness envelope from day one with an explicit proof-type tag, so you can carry both
  formats during a migration overlap.
- Budget for the overlap period explicitly: under EIP-7612-style mechanics the new tree starts
  empty and the old MPT is frozen, so for a stretch of time a slot may be provable only in one
  of the two. A verifier that can only speak one format will be broken during that window even
  after the fork lands.

**Do not:**
- Do not build Verkle witness handling. It is the design being moved away from.
- Do not ship anything that assumes the binary tree's hash is BLAKE3. The EIP explicitly says
  that is unsettled.
- Do not promise a customer, roadmap, or investor a date tied to the binary tree landing. It has
  no fork relationship; anyone giving it a ship date is guessing.

**Re-check trigger:** revisit this when EIP-7864 is claimed as a headliner for a named fork
*and* the hash function is settled. Those two events, in that order, are the signal that it is
safe to promote the binary-tree backend from a hedge to a real dependency. Practically, check
forkcast's Hegotá and post-Hegotá pages plus ACDE call summaries once a quarter — the Hegotá
scope discussions running through Sep–Oct 2026 are the near-term place a state-tree claim would
first show up.

---

## Sources checked (2026-09-23)

- [EIP-7864: Ethereum state using a unified binary tree](https://eips.ethereum.org/EIPS/eip-7864) — Draft; hash function explicitly not final (BLAKE3 / Keccak / Poseidon2); references EIP-7612 and EIP-7748
- [EIP-6800: Ethereum state using a unified verkle tree](https://eips.ethereum.org/EIPS/eip-6800)
- [Forkcast — Ethereum upgrade tracker](https://forkcast.org) (Glamsterdam, Hegotá)
- [ACDE #244 agenda, Aug 27 2026](https://github.com/ethereum/pm/issues/2197) — Glamsterdam testnet dates; Hegotá EIP discussion schedule; no state-tree agenda item
- [EF Checkpoint #9, Apr 2026](https://blog.ethereum.org/2026/04/10/checkpoint-9) — Glamsterdam and Hegotá scope; no state-tree content
- [EF Protocol: The Hegotá EIP Opinion Post and Tier List, Sep 7 2026](https://blog.ethereum.org/2026/09/07/protocol-hegota-eips) — 62 EIPs tiered; EIP-7864 not among them
- [Hegotá Headliner Proposal: FOCIL, EIP-7805](https://ethereum-magicians.org/t/hegota-headliner-proposal-focil-eip-7805/27604)
- [EIP-7864 discussion thread, Fellowship of Ethereum Magicians](https://ethereum-magicians.org/t/eip-7864-ethereum-state-using-a-unified-binary-tree/22611)
- [Ethereum stateless book — Binary Tree](https://stateless.fyi/trees/binary-tree.html)
- [ethereum.org — Verkle trees](https://ethereum.org/roadmap/verkle-trees) — **still describes Verkle as the active path; this page lags core-dev direction**
