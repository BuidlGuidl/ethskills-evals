# State-proof format for a trust-minimized L1 light client

*Written 2026-09-23. Protocol status verified against EIP specs and Ethereum Foundation
Protocol posts dated 2026-09-07; sources at the bottom. Re-check before you freeze the
format — this is the fastest-moving part of the roadmap.*

## Recommendation in one line

**Build on today's hexary Merkle-Patricia proofs (EIP-1186 `eth_getProof`) verified against a
state root obtained from the beacon-chain light client sync protocol — but put the commitment
scheme behind a versioned interface, because Ethereum's state layer is genuinely moving to a
hash-based *binary* tree (EIP-8297 + EIP-8347), not to Verkle.**

Do not build around Verkle. Do not take a hard dependency on binary-tree timing either.

## Where the state layer actually stands today

**Live on mainnet:** the state is still the hexary Keccak Merkle-Patricia Trie, with a
per-account `storage_root` and a separate storage trie per contract. Proofs are the two-level
EIP-1186 shape: an account proof against the state root, then a storage proof against that
account's `storage_root`. Nothing in Glamsterdam changes this.

**Verkle is dead as the target.** EIP-6800 (Verkle trees) is marked **Stagnant**, untouched
since 2023. It was the leading statelessness candidate for years and lost that position on two
grounds: its polynomial commitments are elliptic-curve based, so they are not post-quantum safe
(the EF has since committed to a quantum-resistant L1 by **December 2029**), and they are
awkward inside SNARKs compared to a plain hash tree. Any tutorial, diagram, or vendor pitch
still pointing you at Verkle is stale. If you wire your verifier to IPA/KZG openings you will be
rebuilding it, and on the wrong side of the PQ deadline.

**Binary tree is the real direction, and it has converged on a concrete spec.** The lineage runs
EIP-7864 (unified binary tree, Draft since Jan 2025) → **EIP-8297, "Partitioned Binary Tree"
(PBT)**, Draft from June 2026, authored by twelve people including Buterin, Ballet and Feist.
PBT merges accounts, code and storage into a *single* tree with variable-length prefix-free keys
grouped into zones (`0x00` account headers, `0x01` code, `0xFF` storage). **EIP-8347** specifies
the migration: offline conversion at a finalized anchor block, then a clean swap of the
canonical commitment at `PBT_ACTIVATION_FORK` — no Verkle-style overlay/dual-root period.
Differential devnets exist (Geth-based PBT devnets, Erigon tracking issue), so this is real
engineering, not a forum post.

**But it is not scheduled anywhere.** Glamsterdam (targeting Q4 2026; Devnet-11 passed
2026-09-16, Sepolia 2026-10-06) is ePBS (EIP-7732) + block-level access lists (EIP-7928) — no
state-tree change. Hegotá's must-ship set, per the EF Protocol tier list of 2026-09-07, is
EIP-7805 (FOCIL) and EIP-8141 (Frame Transactions), with Hegotá itself being scoped for ~2027;
EIP-8297/8347 do not appear in that tier list at all, and adjacent EIPs are explicitly parked
"pending the I\* trie-migration design." The priorities post says the state arc's "largest
design and migration work is expected to begin in **I\***, and continues beyond it." At the
stated cadence of roughly 7–12 months per fork, **I\* is realistically 2028**, and "begins in
I\*" is not the same as "activates in I\*."

## What this means for your verifier

Today's proofs are the only thing you can actually ship against, and they will keep working for
years. The binary tree is where to point your *architecture*, not your *dependencies*.

**1. Verify against a root you didn't get from an RPC.** The proof format is the easy half; the
trust-minimization lives in where the state root comes from. Use the beacon-chain light client
sync protocol (sync-committee signatures → beacon block → `execution_payload.state_root`), the
Helios model. Note the freshness/trust tradeoff explicitly: the *finalized* header is ~2 epochs
(~13 min) behind, while the *optimistic* head is only sync-committee-attested, not finalized. If
"recent block" for your dApp means the head, you are trusting 512 validators against a
non-slashable-in-all-cases assumption — decide that deliberately and document it.

**2. Treat the commitment scheme as a versioned, swappable module.** Concretely, the things
EIP-8297/8347 break that people typically hardcode:

- **`storage_root` disappears.** There is no per-account storage trie. The two-call, two-level
  account-proof-then-storage-proof pipeline collapses into one proof in one tree. Design your
  API as `prove(address, slot) -> Proof` and your verifier as
  `verify(stateRoot, proof) -> value`, with the internal structure opaque. Do not let
  `storage_root` leak into your interfaces, your cache keys, or your on-chain calldata layout.
- **Key derivation changes.** Not `keccak(address)` nibbles + `keccak(slot)` nibbles, but
  zone + hashed-address position + subindex, with prefix-free variable-length keys. Keep key
  derivation in one function.
- **The hash function is not decided.** EIP-7864 ships BLAKE3 today "to reduce friction," with
  Keccak and Poseidon2 still live candidates and Poseidon2 under EF security review. Make the
  hash a parameter, never a compile-time constant. This is the single most likely thing to
  change under you.
- **The switch is a hard fork boundary, not a gradual overlay.** EIP-8347 gives a clean swap:
  MPT root canonical before, PBT root canonical after. Your verifier must dispatch on
  block number / fork and support both formats across the boundary. If any part of verification
  lives on-chain, it needs an upgrade path or a fork-activation parameter *now* — an immutable
  MPT verifier contract is a liability with a shelf life. EIP-8347 says this in as many words:
  "bridges, light-client verifiers, `eth_getProof` consumers require coordinated upgrades."

**3. The migration is a one-time, pre-announced event — plan the runbook, not a hedge.** Because
there is no dual-root period, you don't need to run both schemes in parallel indefinitely; you
need a dated cutover with both code paths tested on devnets/testnets first. Budget it as a
release, not as an architecture.

**4. Historical proofs will still be MPT.** Anything you prove about pre-activation blocks stays
hexary MPT forever. Keep the old verifier; don't delete it at cutover.

## Timing risks to state plainly to whoever is funding this

- Binary tree is **Draft**, in devnets, **not CFI or SFI for any fork**. Under EIP-7723 status
  language, that is two full steps short of "it's in."
- Earliest plausible activation is I\* (post-Hegotá), where work is only expected to *begin*.
  2028 is optimistic; 2029 is plausible. The PQ deadline (Dec 2029) is the strongest forcing
  function that it happens at all — a hash-based state tree is a prerequisite for the
  post-quantum and zkEVM arcs, which is exactly why it beat Verkle.
- Its *shape* can still change. EIP-7864 → EIP-8297 already reshaped the key layout once in
  eighteen months, and the hash function is openly TBD. Anything you build against PBT specifics
  today is against a moving spec.
- Conversely, the risk of building on MPT proofs now is bounded and known: one migration, one
  coordinated upgrade, announced fork in advance, historical proofs unaffected.

## The bad options, and why

- **Verkle (EIP-6800 / EIP-4762 lineage):** Stagnant, not post-quantum, SNARK-hostile. Wiring to
  it means wiring to a design the protocol has already left.
- **Building the pipeline against EIP-8297 today:** the spec moves, the hash is undecided, no
  fork has scoped it, and you'd have no mainnet state to prove against for ~2 years.
- **zk proof of state (prove an MPT/PBT opening in a SNARK):** legitimate for compressing
  verification cost, but it is a layer *on top of* the commitment choice, not a substitute for
  it. It inherits the same tree-shape dependency, so it doesn't let you skip this decision.
- **Trusting an RPC's `eth_getProof` root:** defeats the premise. The proof only means something
  relative to a root you independently verified.

## Bottom line

Ship EIP-1186 MPT proofs against a sync-committee-verified state root. Keep the hash function,
the key derivation, and the tree traversal behind one swappable module with a format version on
the wire, and make any on-chain verifier upgradeable. Track EIP-8297, EIP-8347 and the I\* fork
scoping on forkcast.org; the trigger to start the port is when 8297 reaches **CFI for a named
fork**, not before.

## Sources

- [EIP-6800 (Verkle) — Stagnant](https://eips.ethereum.org/EIPS/eip-6800)
- [EIP-7864: Ethereum state using a unified binary tree](https://eips.ethereum.org/EIPS/eip-7864)
- [EIP-8297: Partitioned Binary Tree](https://eips.ethereum.org/EIPS/eip-8297)
- [EIP-8347: Offline state migration to PBT](https://eips.ethereum.org/EIPS/eip-8347)
- [EF Protocol: The Hegotá EIP Opinion Post and Tier List (2026-09-07)](https://blog.ethereum.org/en/2026/09/07/protocol-hegota-eips)
- [EF Protocol: Current and Emerging Priorities (2026-09-07)](https://blog.ethereum.org/2026/09/07/protocol-priorities)
- [Forkcast — Glamsterdam](https://forkcast.org/upgrade/glamsterdam/) (live fork scope tracker)
- [EIP-8081: Hegotá meta thread](https://ethereum-magicians.org/t/eip-8081-hegota-network-upgrade-meta-thread/26876)
