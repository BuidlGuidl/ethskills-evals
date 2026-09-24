# State-proof format for a trust-minimized L1 light client

**Date of research: 2026-09-23.** All fork-status claims below were checked against
primary sources (the hardfork meta EIPs in `ethereum/EIPs`, the EIP headers themselves,
forkcast/ACD material) on that date. Re-verify before committing engineering budget.

---

## Recommendation (short version)

**Build the verifier around Merkle-Patricia Trie (MPT) account + storage proofs as served
by `eth_getProof` (EIP-1186), rooted in the execution `stateRoot` you obtain from a
consensus-layer sync-committee light client.** That is the only state-proof format that
exists on mainnet today, and it will remain the only one for years.

**Do not build around Verkle.** Verkle is the design Ethereum is moving *away* from.

**Do design a narrow "state commitment backend" seam** so that a binary-tree
(EIP-7864) verifier can be added later as a second backend. Treat that as forward
compatibility work, *not* as a dependency — EIP-7864 currently has **no fork
relationship at all**, and taking a hard dependency on it would be a scheduling mistake.

---

## Where the state layer actually stands

### Live on mainnet today
- **Hexary Merkle-Patricia Trie.** Separate account trie and per-account storage tries,
  RLP-encoded nodes, Keccak-256. Account proof + storage proof, verified against the
  `stateRoot` in the block header. This is consensus-defined, so verification logic is
  stable regardless of which client or RPC serves the proof.
- **`eth_getProof` (EIP-1186)** — the standard RPC that returns those proofs. Note its
  EIP status is **Stagnant**, but that reflects spec-document maturity, not deployment:
  it is implemented by all major execution clients and is the de facto interface. The
  risk here is low because the thing you actually verify (MPT structure against
  `stateRoot`) is fixed by consensus; the RPC is only transport. Still, treat the
  request/response shape as something you should pin and test against multiple clients.
- **Consensus-layer light client (Altair sync committee).** This is what makes the
  design trust-minimized: you follow the beacon chain with sync-committee signatures,
  read the execution payload header, extract `stateRoot`, and only then verify the MPT
  proof against it. The RPC provider becomes an untrusted data source rather than a
  trusted oracle. This is the Helios architecture and it works today.

### Dead / moving away from
- **Verkle trees.** EIP-6800 (unified Verkle state tree) is **Stagnant**. EIP-7545
  (Verkle proof verification precompile) is **Stagnant**. Verkle is not scheduled or
  considered for any upcoming fork. The ecosystem moved off the polynomial-commitment
  approach in favour of a binary Merkle tree, driven by SNARK-proving friendliness and
  post-quantum concerns about pairing-based commitments. If you find a design doc or
  blog post telling you to build for Verkle, it is out of date. (Some secondary crypto
  press still lists "Verkle trees" as a Hegotá feature — that is wrong; the Hegotá meta
  EIP does not contain any Verkle EIP.)

### The genuine direction — but unscheduled
- **EIP-7864: Ethereum state using a unified binary tree.** Status: **Draft**. It merges
  account, storage, and code into one binary tree, drops RLP, chunks contract code into
  the tree, and co-locates account data into 256-key stems. Proofs get much smaller and
  much cheaper to prove in a circuit. This is unambiguously where the state layer is
  headed.
- **Fork relationship: none.** It is not Scheduled, not Considered, and not even
  *Proposed* for inclusion in either upcoming fork:
  - **Glamsterdam** (meta: EIP-7773) — SFI list includes ePBS (7732), Block-Level Access
    Lists (7928), state-access/state-creation gas repricings (8037, 8038), BALs, etc.
    **EIP-7864 is absent.** Glamsterdam is activating on Sepolia at
    2026-10-06 13:53:36 UTC; **Hoodi and mainnet activation rows are still blank**.
  - **Hegotá** (meta: EIP-8081, status Draft) — only EIP-7805 (FOCIL) and EIP-8141
    (Frame Transaction) are SFI; ~35 EIPs sit at Proposed for Inclusion.
    **EIP-7864 does not appear anywhere in that document either.**
- **Its internals are not frozen.** The EIP explicitly says the hash function is **not
  final** — BLAKE3 is a placeholder for client experimentation, with Keccak and Poseidon2
  still live candidates, and Poseidon2 pending an EF cryptography security assessment.
  If Poseidon2 wins, additional specs are still needed for field selection and byte→field
  encoding. **A verifier written against today's draft would need its hashing and leaf
  encoding rewritten.** This alone rules out building the proof pipeline around it now.
- Related statelessness gas work (**EIP-4762**) is also Draft with no fork relationship.

### Timing, stated honestly
Glamsterdam has not reached mainnet and does not yet have a mainnet activation time.
Hegotá is the fork after that and has barely begun scoping. EIP-7864 is not in either.
The earliest plausible fork for a binary-tree transition is therefore the fork *after*
Hegotá, and a state-tree migration is among the most invasive changes the protocol can
make — it needs a conversion/migration strategy that is not yet specified. **Any date
you have been given for binary trees on mainnet is speculation.** Plan as though MPT
proofs are your production format for the entire foreseeable life of v1, and treat a
binary-tree backend as an option you buy cheaply, not a milestone you schedule against.

---

## What this means for the build

1. **Ship v1 on MPT proofs.** Verify: sync-committee → beacon block → execution payload
   header → `stateRoot` → account proof → storage proof. Never trust an RPC's
   `eth_getStorageAt` answer directly.
2. **Isolate the commitment layer.** Put a single interface between "I have a trusted
   `stateRoot` and a claimed (address, slot, value)" and "verify it." One implementation
   today (MPT/Keccak/RLP); a second later (binary tree) if and when EIP-7864 ships. The
   *fork-detection* logic — which verifier to use for a given block — is the piece worth
   designing now, because a state-tree transition will be block-number/fork gated.
   Keep the seam thin; do not try to pre-abstract over a spec whose hash function is
   undecided. Abstracting the *call site* is cheap; abstracting the *internals* of an
   unfrozen design is waste.
3. **Don't over-fit to proof size.** MPT branches are fat (~3–4 KB for a single account
   branch, worse for code). If your product economics only work with binary-tree-sized
   proofs, you have a dependency on an unscheduled fork — fix the economics instead
   (batch slots, cache, amortize across blocks).
4. **Watch Glamsterdam's EIP-7928 (Block-Level Access Lists), which *is* SFI.** It puts
   a canonical per-block record of state locations touched and post-transaction state
   diffs into the block. Once Glamsterdam is on mainnet, that is a genuinely useful
   complementary source for tracking how a specific slot changed over a range of blocks,
   without needing a proof per block. It is additive — it does not replace your MPT
   proof — and it is still gated on a mainnet activation date that does not exist yet.
5. **Header/state-root semantics are stable near term.** EIP-7862 (Delayed State Root)
   and EIP-7807 (SSZ execution blocks) are both **Declined for Inclusion** in Hegotá, so
   the `stateRoot`-in-the-same-block-header assumption your verifier depends on is not
   about to change. EIP-7688 (forward-compatible consensus data structures) is SFI in
   Glamsterdam and is worth reading if you hard-code beacon-state generalized indices.
6. **Account for history expiry.** Partial history expiry is already in effect across
   execution clients (pre-Merge blocks/receipts dropped since May 2025), and full rolling
   expiry (EIP-4444, `HISTORY_PRUNE_EPOCHS` ≈ 1 year) is intended for a future fork. Your
   stated use case is "a recent block," so this is not a blocker — but if anyone later
   asks for historical proofs, note that archive access is becoming a
   specialized/out-of-protocol service, not something you get from a default node.

## Plan validity if EIP-7864 never ships
Everything in step 1, 4, 5, and 6 stands unchanged. The only wasted work would be the
backend seam in step 2, which is a day or two of interface design. That asymmetry is
exactly why the seam is worth having and the dependency is not.

---

## Sources checked (2026-09-23)

- [EIP-7773: Hardfork Meta — Glamsterdam](https://eips.ethereum.org/EIPS/eip-7773) (SFI list; Sepolia activation set, mainnet blank)
- [EIP-8081: Hardfork Meta — Hegotá](https://eips.ethereum.org/EIPS/eip-8081) (SFI: 7805, 8141; EIP-7864 absent)
- [EIP-7864: Ethereum state using a unified binary tree](https://eips.ethereum.org/EIPS/eip-7864) (Draft; hash function explicitly not final)
- [EIP-6800: unified verkle tree](https://eips.ethereum.org/EIPS/eip-6800) (Stagnant) and [EIP-7545: Verkle proof precompile](https://eips.ethereum.org/EIPS/eip-7545) (Stagnant)
- [EIP-4762: Statelessness gas cost changes](https://eips.ethereum.org/EIPS/eip-4762) (Draft, no fork relationship)
- [EIP-1186: eth_getProof](https://eips.ethereum.org/EIPS/eip-1186) (Stagnant spec, universally implemented)
- [EIP-7928: Block-Level Access Lists](https://eips.ethereum.org/EIPS/eip-7928) (Review; SFI for Glamsterdam)
- [forkcast.org](https://forkcast.org) — upgrade tracker
- [ACDE #245, 2026-09-10](https://github.com/ethereum/pm/issues/2211) and [ACDE #244, 2026-08-27](https://github.com/ethereum/pm/issues/2197)
- [EF Protocol: The Hegotá EIP Opinion Post and Tier List](https://blog.ethereum.org/2026/09/07/protocol-hegota-eips)
- [Partial history expiry announcement](https://blog.ethereum.org/2025/07/08/partial-history-exp)
