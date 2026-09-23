# State-proof format for a trust-minimized L1 light client

**Date of analysis: 2026-09-23.** Status claims below are checked against EIP status
fields, fork scope, and ethereum.org/forkcast as of this date. Protocol scope changes;
re-verify before locking anything in.

---

## Recommendation in one paragraph

Build the verifier against **today's hexary Merkle-Patricia Trie (keccak256, RLP nodes,
`eth_getProof`-shaped witnesses)**, anchored to a **consensus-layer light-client-verified
beacon header → execution payload header → `stateRoot`**. Do *not* build around **Verkle**
— that is the design Ethereum moved away from. Structure the code so the *tree* verifier
is a swappable backend behind an `(address, slot) @ stateRoot → value` interface, because
the state layer is genuinely heading toward a **unified binary tree (EIP-7864 lineage)**.
But treat that as a future backend, not a dependency: it is not scheduled for any fork,
its hash function is undecided, and a long dual-tree migration sits between here and there.

---

## Where the state layer actually stands today

**Live on mainnet:** hexary MPT, keccak256, RLP-encoded nodes, separate account trie and
per-account storage tries. A storage-slot proof is two chained Merkle proofs:
`stateRoot → account RLP (key = keccak(address))`, then
`account.storageRoot → slot value (key = keccak(slot))`. Roughly ~3 KB of witness for a
single slot at current state size. This is what every client serves and it is the *only*
format that will verify mainnet state for at least the next couple of years.

**Verkle is not the future.** EIP-6800 ("Ethereum state using a unified verkle tree") is
marked **Stagnant** in the EIPs repo. Verkle was the leading statelessness candidate from
roughly 2021–2024, then lost core-dev support over two things: it is hostile to SNARK
proving (IPA/banderwagon openings are expensive to prove inside a circuit, and L1 is
committed to real-time proving of blocks), and its elliptic-curve commitments are not
post-quantum. If you wire your pipeline to Verkle witnesses you are building against a
design the protocol abandoned — this is the single most expensive mistake available here.

**The direction of travel is a binary hash tree.** EIP-7864, "Ethereum state using a
unified binary tree" (Draft, created Jan 2025), merges account headers, contract code and
storage into one logical tree with byte-based keys and 32-byte values, arity 2, and
stem/suffix grouping (31-byte stem, 256 co-located suffixes). Merkelization uses a plain
hash function, so proofs are ordinary Merkle branches — no pairings, no polynomial
commitments, no trusted setup, and post-quantum-safe as long as the hash is. Witnesses get
substantially smaller: the EIP cites ~768 bytes vs ~2,880 bytes for a hexary proof over a
2^24-element tree. A sibling draft, **EIP-8297 ("Partitioned Binary Tree", Draft, created
June 2026)**, proposes a variant of the same family — merged tries, content-addressed code,
byte-zone partitioning — which tells you the *family* is settled but the *specific encoding
is still being argued*.

---

## Timing — the part that constrains how hard a dependency you can take

Four independent reasons the binary tree is not something to depend on:

1. **No fork scope.** EIP-7864 is `Draft` and is not SFI or CFI for **Glamsterdam**
   (headliners EIP-7732 ePBS + EIP-7928 BALs; ~19 EIPs SFI as of Aug 2026; target
   Q4 2026, date unconfirmed), nor for **Hegotá** (headliner FOCIL/EIP-7805, plus
   EIP-8141 frame transactions; scope open; ethereum.org shows "Q2 2027, not confirmed").
   Per the skill's own guidance: no fork relationship means *not currently planned*, however
   loudly the roadmap talks about it.
2. **The hash function is undecided.** EIP-7864's reference implementation uses BLAKE3
   "to reduce friction for EL clients experimenting" and explicitly marks the final choice
   TBD, with Keccak and Poseidon2 as candidates. The SNARK-friendly option (Poseidon2) is
   gated on the **Poseidon Cryptanalysis Initiative**, whose Phase 2 concludes **December
   2026**. Until that lands there is no responsible way to freeze a node-hashing rule.
3. **The encoding is contested.** EIP-7864 vs EIP-8297 differ in key derivation and code
   handling — exactly the parts a verifier hardcodes.
4. **Migration is long and dual-rooted.** The EIP-7748-style conversion (written for VKT,
   the same mechanism applies to a binary tree) migrates state *gradually*, a fixed number
   of conversion units per block, with an **overlay tree** bridging old and new. For the
   whole conversion window — months, not blocks — a slot may live in either structure, and
   a correct verifier must try both. EIP-7864 puts it plainly: the new tree starts empty,
   "the MPT continues to exist but is frozen."

Realistic read: earliest plausible mainnet binary tree is **a fork after Hegotá, i.e.
2028-ish at the earliest**, followed by a long migration. Anything you ship before then
verifies MPT proofs or it verifies nothing.

---

## What to build

**1. Separate the trust anchor from the proof format.** These change on completely
different schedules.

- Anchor: the consensus-layer light-client sync protocol (Altair sync committees) →
  finalized beacon header → `ExecutionPayloadHeader.state_root`. This is where the
  trust-minimization actually comes from, it is live today, and a state-tree change does
  not touch it. Helios is the reference implementation to model on.
- If any part of verification happens on-chain, EIP-4788 gives you the parent beacon block
  root inside the EVM as the anchor.
- Tree change ⇒ the `stateRoot` field keeps its meaning; only its *interpretation* changes.
  That is the whole reason this split pays off.

**2. Define the backend interface at the semantic level, not the structural level.**

```
verify(state_root, address, slot, witness) -> Option<U256>
```

Not `verify(root, path, nodes)`. The binary tree changes **key derivation**, not just node
hashing: today's key is `keccak(address)` into one trie plus `keccak(slot)` into another;
under EIP-7864 there is a single tree with a stem/suffix key computed from address and slot
together, and code lives in the same tree. A path-level interface leaks the two-trie shape
everywhere and will not survive the change. An `(address, slot)` interface will.

Parameterize the backend over: hash function, node/branch encoding, arity, key derivation,
and value encoding. Keep the MPT backend as `backend::mpt` from day one so adding
`backend::binary` later is an addition, not a refactor.

**3. Plan for the overlay period now, cheaply.** Allow the resolver to consult more than
one backend for a single `(state_root, address, slot)` query and to report "present in
new tree" vs "still in frozen MPT". You do not need to implement this yet — you need the
interface to not forbid it.

**4. Do not treat raw witnesses as durable evidence.** Store `(beacon block root, block
number, address, slot, value)` plus enough to re-prove, rather than archiving proof blobs
as your canonical record. Proof bytes are format-coupled; the tuple is not.

**5. Take the win that is actually shipping.** Glamsterdam's **EIP-7928 Block-Level Access
Lists** (SFI, ~Q4 2026 target) publish per-block lists of which accounts and slots a block
touched. For a client watching one specific slot, that lets you skip fetching a proof for
blocks that provably did not touch it — a real bandwidth reduction on a fork that is
genuinely scheduled, with no tree change required.

---

## What I would not do

- Build on Verkle-shaped witnesses (IPA openings, banderwagon commitments). Stagnant EIP,
  abandoned direction.
- Hardcode binary-tree key derivation or a specific hash now. The spec will move.
- Ship a design whose correctness requires the binary tree to land by a particular date.
- Sole-source state from one RPC provider's `eth_getProof` without the CL header anchor —
  that is where trust-minimization is won or lost, and it is independent of all of the above.

---

## Sources

- [EIP-7864: Ethereum state using a unified binary tree](https://eips.ethereum.org/EIPS/eip-7864) — Draft; BLAKE3 placeholder, hash TBD; MPT frozen, new tree starts empty
- [EIP-8297: Partitioned Binary Tree](https://eips.ethereum.org/EIPS/eip-8297) — Draft, created June 2026
- [EIP-6800: Verkle tree state](https://eips.ethereum.org/EIPS/eip-6800) — **Stagnant**
- [EIP-7748: State conversion](https://eips.ethereum.org/EIPS/eip-7748) — Draft; overlay tree, per-block conversion stride
- [Glamsterdam — ethereum.org](https://ethereum.org/roadmap/glamsterdam/) and [forkcast.org](https://forkcast.org) — ePBS (EIP-7732) + BALs (EIP-7928) headliners; no state-tree EIP in scope
- [Hegotá — ethereum.org](https://ethereum.org/roadmap/hegota) — FOCIL (EIP-7805) headliner, EIP-8141 scheduled; Q2 2027, unconfirmed; no state-tree EIP
- [Poseidon Cryptanalysis Initiative](https://www.poseidon-initiative.info/) — Phase 2 concludes December 2026
- [EIP-7864 discussion, Fellowship of Ethereum Magicians](https://ethereum-magicians.org/t/eip-7864-ethereum-state-using-a-unified-binary-tree/22611)
- [Ethereum stateless book — Binary Tree](https://stateless.fyi/trees/binary-tree.html) — rationale for binary over Verkle (SNARK-friendliness, PQ)

Fork scope and status above were checked via web sources on 2026-09-23; forkcast's
per-upgrade pages did not render for automated fetching, so scope was cross-checked against
ethereum.org roadmap pages and EIP status fields. Confirm SFI/CFI lists directly on
forkcast before treating any date as firm.
