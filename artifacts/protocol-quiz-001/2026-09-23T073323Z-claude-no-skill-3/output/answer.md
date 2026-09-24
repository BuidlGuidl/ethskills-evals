# State-proof format for a trust-minimized L1 light client

**Recommendation in one line:** build the verifier around **EIP-1186 hexary Merkle–Patricia Trie (MPT) proofs, anchored to a beacon-chain light-client header** — and put the tree verification behind a *versioned, fork-indexed* interface so it can be swapped for the **EIP-7864 unified binary tree** when that ships. **Do not build around Verkle.**

---

## 1. Where Ethereum's state layer actually stands today

The mainnet execution state is still what it has been since Frontier:

- A **hexary Merkle–Patricia Trie**, keccak256-hashed, RLP-encoded nodes.
- **Two-level**: one account trie keyed by `keccak(address)`, and a *separate* storage trie per contract keyed by `keccak(slot)`, rooted at `account.storageRoot`. Code is referenced by `codeHash`, outside the trie.
- Proofs are exposed by **`eth_getProof` (EIP-1186)**: an `accountProof` (list of RLP node bytes from the state root down to the account leaf) plus one `storageProof` per requested slot, against that account's `storageRoot`.
- Typical cost: ~7–8 nodes per trie level, ~**3.5–4 KB** per (account + slot) pair. That is the number to budget for.

Nothing in Glamsterdam changes this. Glamsterdam's execution headliner is **EIP-7928 Block-Level Access Lists**, plus gas/state-cost repricings (e.g. EIP-8037). BALs change what a block *declares* it touched; they do not change the commitment structure or the proof format. The consensus headliner is **EIP-7732 (ePBS)**, which also leaves the execution `stateRoot` semantics intact.

So: **today, and through the next hard fork, MPT is the only format that exists on mainnet.** Any design that isn't MPT-capable simply cannot verify current blocks.

## 2. Where it is genuinely going

The important strategic fact for you: **Verkle is off the roadmap.**

For roughly 2021–2024, the stateless-Ethereum plan was Verkle trees (EIP-6800 and friends): a 256-ary tree with Banderwagon/IPA vector commitments, giving very small witnesses. That plan was abandoned during 2025 in favour of a **binary Merkle tree with a fast, proof-friendly hash**. Two reasons drove the reversal, and both are durable:

1. **Post-quantum.** Verkle's IPA commitments rest on the discrete-log assumption. A hash-based tree is PQ-safe by construction, which aligns with the broader "lean Ethereum" push toward hash-based cryptography. This is the dominant argument and it is not going to be re-litigated.
2. **ZK-proving progress.** STARK proving over hash-based trees improved fast enough that the witness-size advantage of Verkle stopped justifying a bespoke, non-PQ curve-based dependency across the whole client stack.

The successor design is **EIP-7864, "Ethereum state using a unified binary tree"** (Draft, by Guillaume Ballet et al., with Vitalik pushing it as part of a two-part EL overhaul). Its shape matters a lot to you, because it is *not* a drop-in re-encoding of the MPT:

- **One unified tree.** Account headers, contract code chunks, and storage all live in a single tree. The per-contract storage trie and `account.storageRoot` **disappear**. Your "walk the account proof, then walk the storage proof" two-phase verifier has no analogue.
- **Flat 32-byte key space** with a "stem" structure: 1 byte type discriminator (header / code / storage), then an address-or-position hash, then a 1-byte sub-index — so 256 values sharing a 31-byte stem are co-located. An account's basic data, its first 64 storage slots and first 128 code chunks land in one stem, so proving several nearby slots costs barely more than proving one.
- **Binary branching** → ~24 sibling hashes for a 2^32-element tree, ≈**768 bytes** per proof versus ≈3.8 KB today. Roughly a 4–5× witness reduction, which is material for a light client.
- **Hash function is still TBD.** The reference implementation currently uses BLAKE3; Keccak and Poseidon2 are the live alternatives, with the EF still doing security assessment on Poseidon2. Treat the hash as an *unbound parameter*.

Migration is specified separately: the MPT is frozen while new writes go to the binary tree, and **EIP-7748** covers converting the legacy state over. That implies a transition window in which both structures are live.

## 3. Timing — and how hard a dependency you can take

This is where you must be disciplined:

- **EIP-7864 is Draft and is not in Glamsterdam** (mainnet target Nov 4 2026; Sepolia Sep 21 2026, Hoodi Oct 5 2026). It is also not the headliner of **Hegotá**, the fork after Glamsterdam — that's FOCIL on the consensus side.
- Its hash function is unchosen, so its *wire format is not frozen*. Anyone writing a 7864 verifier today is writing against a moving spec.
- Realistically the binary tree lands **no earlier than the fork after Hegotá**, i.e. 2027–2028, and it is a state migration of unprecedented size — the kind of change that historically slips.
- **The MPT never fully goes away for you.** Every pre-transition block is committed under MPT forever. If your service ever answers "as of block N" for a historical N, you need the MPT verifier permanently, not transitionally.

**Conclusion on dependency strength:** take *zero* hard runtime dependency on 7864. Take a *structural* dependency only — i.e. make sure your architecture can absorb it. Shipping an MPT-only verifier is correct; shipping an MPT-only *architecture* is the mistake.

## 4. What to actually build

**Layer 1 — the header anchor (this is where the trust-minimization really lives).**
Use the Altair beacon light-client protocol: sync-committee-signed `LightClientUpdate` / `FinalityUpdate`, from which you extract the execution payload header and its `stateRoot`. This is what makes the RPC untrusted — the provider supplies data, consensus supplies the root. Be honest in your threat model that the sync committee is a 512-validator, 2/3-signature assumption, weaker than full validation; if you need more, follow finalized updates only and accept the latency. Helios is the reference implementation of exactly this pattern and is worth reusing rather than reimplementing.

**Layer 2 — the state witness, behind an interface.**

```
verify_slot(state_root, address, slot, witness, fork_id) -> Option<U256>
```

Implementations: `MptWitness` today, `BinaryTreeWitness` later, dispatched by fork/block number — never globally. Critically, keep MPT-specific concepts *out* of the interface: no `storageRoot` in your public types, no nibble paths, no RLP, no "account proof then storage proof" two-step, no hardcoded keccak. All four of those vanish under 7864. Your cache keys and your API should address state as `(block, address, slot)`, not as a trie path.

**Layer 3 — provider access.** `eth_getProof` on a full node only serves the last ~128 blocks of state; "as of a recent block" is fine, but bound your freshness window explicitly or pay for archive access. Fetch from ≥2 independent providers — not for trust (the root handles that) but for liveness and censorship.

**Sizing note:** batch slot requests per account. Under MPT that amortizes the account proof; under 7864 the stem layout makes it dramatically better still, so the optimization survives the migration.

## 5. Alternatives considered

- **Verkle / IPA witnesses** — rejected. This is precisely the design the protocol is moving away from; the work would be written off, and the PQ argument means it isn't coming back.
- **SNARK/STARK-proved state reads** (prove the MPT inclusion inside a circuit, verify a ~KB proof) — attractive on witness size, and genuinely where the protocol is heading in spirit given the real-time block-proving effort. But today it substitutes RPC trust for *prover* trust/liveness and adds a soundness-critical circuit. Reasonable as a later optimization *behind the same Layer-2 interface*; wrong as the thing a small team commits to first.
- **Waiting for 7864** — not viable. It is Draft, unscheduled, and its hash function is unfixed.

## 6. Migration checklist for when 7864 lands

- Fork-boundary dispatch already in place (do this now).
- Retain the MPT verifier permanently for historical blocks.
- Expect a dual-tree window during EIP-7748 conversion: a slot may be provable under either structure. Test that path.
- Keep the hash function a configuration parameter, not a constant — BLAKE3 vs Keccak vs Poseidon2 is still open.
- Re-budget witness sizes downward (~4–5×) rather than assuming your MPT-era limits still bind.

---

### Sources

- [EIP-7864: Ethereum state using a unified binary tree](https://eips.ethereum.org/EIPS/eip-7864)
- [EIP-7864 discussion — Fellowship of Ethereum Magicians](https://ethereum-magicians.org/t/eip-7864-ethereum-state-using-a-unified-binary-tree/22611)
- [Vitalik Buterin lays out a two-part plan to overhaul Ethereum's execution layer — The Block](https://www.theblock.co/news/ecosystems/2026-03-01-vitalik-buterin-lays-out-a-two-part-plan-to-overhaul-ethereums-execution-layer-from-the-ground-up-391681)
- [Binary Tree — Ethereum stateless book](https://stateless.fyi/trees/binary-tree.html)
- [Towards Stateless Clients: Benchmarking Verkle Trees and Binary Merkle Trees with SNARKs](https://arxiv.org/pdf/2504.14069)
- [Glamsterdam — ethereum.org](https://ethereum.org/roadmap/glamsterdam/)
- [Checkpoint #9: Apr 2026 — Ethereum Foundation Blog](https://blog.ethereum.org/2026/04/10/checkpoint-9)
- [Building Helios: Fully trustless access to Ethereum — a16z crypto](https://a16zcrypto.com/posts/article/building-helios-ethereum-light-client/)
- [a16z/helios](https://github.com/a16z/helios)
