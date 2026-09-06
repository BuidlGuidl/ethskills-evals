# State-proof format for a trust-minimized L1 light client

**Date of research: 2026-09-02.** Every status claim below was checked against live
sources (listed at the bottom), not from memory. Protocol status changes; re-verify
before you freeze the wire format.

---

## Recommendation (short version)

**Build the verifier around today's hexary Merkle-Patricia Trie (MPT) proofs —
`eth_getProof`-shaped account + storage proofs — verified against a state root you
obtain from a consensus-layer light client, not from an RPC provider.**

**Do not build around Verkle trees.** That is precisely the design the protocol is
moving *away* from — it has been dropped from the roadmap.

**Do not take a hard dependency on the binary state tree (EIP-7864) either.** It is the
genuine direction of travel, but it is a Draft EIP with *no fork relationship at all*,
and its hash function — and therefore its entire proof wire format — is explicitly not
final. You cannot write a correct verifier for it today.

So: implement MPT now, and put the state-commitment scheme behind a **versioned,
swappable proof backend** so that adding a binary-tree verifier later is a new module,
not a rewrite. Concretely, the "future-proofing" work you do now should go into the
*abstraction boundary*, not into speculative binary-tree code.

---

## Where Ethereum's state layer actually stands today

**Live on mainnet:** the most recent upgrade is **Fusaka**, activated 2025-12-03. The
state layer under Fusaka is unchanged from what it has always been: a **hexary,
Keccak-256, RLP-encoded Merkle-Patricia Trie**, with a two-layer structure (account
trie → per-account storage trie). `eth_getProof` returns exactly this. There is no
Verkle, no binary tree, and no in-protocol witness format on mainnet.

**Also live and directly useful to you:** **EIP-2935** ("Serve historical block hashes
from state", status **Final**), activated in Pectra on 2025-05-07. A system contract at
`0x0000F90827F1C53a10cb7A02335B175320002935` keeps a ring buffer of the last **8191**
block hashes as storage slots, indexed `block.number - 1 % 8191`. At 12s slots that is
~27 hours of coverage. This matters a lot if any part of your verification happens
on-chain: it lets a contract authenticate a recent block hash without trusting a
relayer, for any block within that ~1-day window.

**The next fork, Glamsterdam, does not touch the state tree.** Its scope is frozen
(~18–26 SFI EIPs) and is headlined by **EIP-7732 (ePBS)**, **EIP-7928 (Block-Level
Access Lists)** and **EIP-7904 (gas repricing)**. Schedule per All Core Devs: Sepolia
2026-09-21, Hoodi 2026-10-05, **mainnet target 2026-11-04**. No state-tree, stateless,
or witness EIP is in scope.

> One Glamsterdam item *does* touch you, but on the header side, not the proof side:
> **EIP-7732 (ePBS)** decouples the execution payload from the beacon block. If your
> light client sources its execution `state_root` out of the beacon block, that
> structure and its confirmation timing change. Budget for it, and pin your
> implementation against the final Glamsterdam consensus spec rather than against
> current beacon-block field layouts.

---

## Where it is genuinely going

**Verkle trees are dead as an Ethereum L1 plan.** They were removed outright in the
2026 roadmap revision (alongside state expiry). The stated replacement is the
**unified binary tree**. The driver is post-quantum: Verkle's IPA/pairing-flavoured
polynomial commitments are not post-quantum, and the roadmap has moved
quantum-resistance up the priority list. Any 2023–2024 design doc telling you to build
witnesses around Verkle proofs is stale — this is the single biggest trap in your
question, because there is a large body of Verkle-based light-client literature that
reads as authoritative and is now obsolete.

**The successor is EIP-7864, "Ethereum state using a unified binary tree."** Status:

| | |
|---|---|
| EIP status | **Draft** (Standards Track: Core), created 2025-01-20 |
| Fork relationship | **None.** Not SFI/CFI in Glamsterdam; not in Hegotá's SFI or proposed-for-inclusion lists |
| Hash function | **Not final.** Draft uses BLAKE3 "to reduce friction for client experimentation"; the EIP says explicitly *"Do not assume BLAKE3 is a final decision"* |

What it changes, and why it is attractive for you: it collapses the two-layer
account/storage design into a single key-value tree, drops RLP, brings contract code
into the state tree in 31-byte chunks, and co-locates related data. The practical
effect for a light client is **Merkle branches roughly 4× shorter** than the hexary MPT
— less bandwidth, cheaper on-chain verification. Migration from the MPT is specified
separately in **EIP-7748** (also Draft), as a *gradual, block-by-block* conversion.

**The hash-function question got more unsettled, not less, three weeks ago.** On
2026-08-13 the Ethereum Foundation (Justin Drake) confirmed it is **abandoning Poseidon
for L1** after an eight-year research program, in favour of conventional hashes
(SHA-2 / BLAKE2s family). The reasons: round-skipping attacks eroded Poseidon's
security margin, binary-field SNARKs closed the in-circuit performance gap, and in a
post-quantum design where the hash is the only assumption, maturity beats optimization.
Poseidon2 was one of EIP-7864's candidate hashes, so this is a live input into a choice
that is still open. The related post-quantum execution work (leanVM) is pointed at
~2027 for a production implementation and ~2028 for deployment — a long horizon.

**Hegotá** (the fork after Glamsterdam) is still in scoping, targeting **2027**. Its
only agreed-for-inclusion items are **EIP-7805 (FOCIL)** and **EIP-8141 (Frame
Transaction)**. EIP-7864 is not among its proposed EIPs. **EIP-7709** ("Read BLOCKHASH
from Storage and Update Cost", Draft — the piece that makes `BLOCKHASH` read from the
EIP-2935 contract, needed for true statelessness) *is* in Hegotá's proposed-for-inclusion
list, but proposed is not committed.

---

## Timing: how hard a dependency you can safely take

Stated plainly, so nobody on the team over-reads the roadmap:

1. **The binary tree has no ship date, because it has no fork.** It is not merely
   "unscheduled for the next fork" — it has no fork relationship whatsoever. The
   earliest fork that could plausibly carry it is one *after* Hegotá, and Hegotá itself
   is a 2027 target in scoping. Treat "binary tree on mainnet" as **2027 at the
   absolute earliest, realistically later, and genuinely uncertain**.
2. **Its wire format does not exist yet.** With the hash function undecided (and the
   Poseidon decision having just reshuffled the candidates), the leaf/internal-node
   hashing — and hence every proof byte — is unpinned. There is nothing to implement
   against that is guaranteed to survive.
3. **Even the scheduled things slip.** Glamsterdam's 2026-11-04 mainnet target is ACD-
   confirmed but already slipped once from Q3 2026. Do not schedule a launch that
   *requires* a fork to land on a date.
4. **The migration is gradual, not atomic.** EIP-7748 converts state progressively over
   many blocks; during conversion both representations are in play. A verifier that can
   only speak one format breaks in the middle of the transition, not cleanly at a fork
   boundary.
5. **MPT support is never wasted.** Even after a hypothetical full conversion, proofs
   *for historical blocks* remain MPT-shaped. If you ever want to serve "as of block N"
   for an N before the switch, you keep the MPT verifier forever. This is the strongest
   practical argument for building it first and building it well.

---

## What to actually build

**Separate the two problems.** They have completely different risk profiles, and
conflating them is the main way teams get locked into a doomed format.

**(a) Getting an authenticated state root — the part that is stable.**
Use the **consensus-layer light client protocol** (Altair sync committees, via the
standard beacon `/eth/v1/beacon/light_client/*` endpoints). You verify sync-committee
signatures yourself and extract the execution `state_root` from the (header of the)
execution payload. This is *independent of the state tree format* — a binary-tree
transition does not touch it. It is also where your actual trust-minimization comes
from: without it, an MPT proof only tells you "consistent with a root the RPC gave
me," which is not a security property. Prioritize this; it survives every scenario.
The one thing that will perturb it is **ePBS in Glamsterdam** (see the note above).

**(b) Proving the storage slot against that root — the part that will change.**
Implement MPT verification now: account proof (`keccak(address)` path through the state
trie → RLP account record) then storage proof (`keccak(slot)` path through that
account's `storageRoot`). Verify both against the root from (a).

**Make the boundary between them a real interface.** Define your verifier as roughly:

```
verify(stateRoot, address, slot, proof_bytes, proof_format_id) -> value
```

with these rules:

- **Version the proof format explicitly.** A `proof_format_id` (or a self-describing
  envelope) on every witness, from day one. Adding `BINARY_V1` later must be an enum
  arm and a new module, never a wire-format renegotiation.
- **Treat `proof_bytes` as opaque** above the verifier. Nothing in your dApp-facing API,
  your caching layer, or your storage schema should assume the internal shape of an MPT
  node, the existence of a *separate* storage root, or the number of trie levels. The
  unified binary tree deletes the two-layer account/storage distinction, so any type or
  DB column named `storage_root` is a future migration.
- **Support two formats simultaneously, by construction.** Because EIP-7748 converts
  gradually and because historical blocks stay MPT forever, "one format at a time" is
  wrong even in the good scenario. Key the format off the block, not off a global config
  flag.
- **If any of this runs on-chain**, put the verifier behind a small registry contract
  keyed by format id, so a binary-tree verifier can be added by deployment rather than
  by migrating the whole pipeline. Combine with EIP-2935 for trustless recent block
  hashes inside the ~8191-block window.

**One alternative worth naming, since it's the other genuinely future-proof answer:**
wrap the MPT proof in a SNARK — your on-chain/edge verifier checks "slot S under
address A equals V in state root R" without knowing the tree shape at all. When the
tree changes, only the circuit changes; the verifier interface does not. That is
strictly more robust to the transition and gives you much smaller on-chain
verification. It also means running proving infrastructure and taking on circuit-audit
risk. **My recommendation: don't start here.** Build the MPT verifier behind the
versioned interface first; adopt the SNARK wrapper only if bandwidth or on-chain gas
costs actually force it. The interface discipline above is what buys you the option,
and it costs almost nothing.

---

## If the binary tree never ships

Nothing above breaks. You are running on the format that is live on mainnet today and
that will remain valid for historical blocks permanently, with a format-id field you
simply never add a second value to. That asymmetry — cheap to prepare for, safe if it
never arrives — is the whole reason to structure it this way rather than betting on a
Draft EIP with no fork.

---

## Sources checked (2026-09-02)

- [Forkcast](https://forkcast.org) — fork tracker (Glamsterdam, Hegotá)
- [EIP-7864: Ethereum state using a unified binary tree](https://eips.ethereum.org/EIPS/eip-7864) — Draft; hash function explicitly not final
- [EIP-7748 (state conversion)](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-7748.md)
- [EIP-2935: Serve historical block hashes from state](https://eips.ethereum.org/EIPS/eip-2935) — Final, live since Pectra
- [EIP-7709: Read BLOCKHASH from Storage and Update Cost](https://eips.ethereum.org/EIPS/eip-7709) — Draft
- [Fusaka mainnet announcement, Ethereum Foundation](https://blog.ethereum.org/2025/11/06/fusaka-mainnet-announcement) and [CoinDesk: Fusaka activated 2025-12-03](https://www.coindesk.com/tech/2025/12/03/ethereum-activates-fusaka-upgrade-aiming-to-cut-node-costs-speed-layer-2-settlements)
- [EIPsInsight: Glamsterdam](https://eipsinsight.com/upgrade/glamsterdam) and [Hegotá](https://eipsinsight.com/upgrade/hegota) — scope by status
- [Glamsterdam devnet progress and Hegotá roadmap shift](https://crypto.news/ethereum-details-glamsterdam-devnet-progress-and-hegota-roadmap-shift/) — testnet/mainnet dates
- [The Defiant: roadmap prioritizes quantum readiness; Verkle dropped](https://thedefiant.io/news/blockchains/vitalik-buterin-s-ethereum-roadmap-prioritizes-quantum-readiness-and-privacy)
- [crypto.news: Ethereum L1 drops Poseidon in post-quantum move](https://crypto.news/ethereum-l1-drops-poseidon-in-post-quantum-move/) (Justin Drake, 2026-08-13) and [zkm.io analysis](https://www.zkm.io/blog/why-ethereum-walked-away-from-poseidon)
- [Ethereum stateless book: binary tree](https://stateless.fyi/trees/binary-tree.html)
