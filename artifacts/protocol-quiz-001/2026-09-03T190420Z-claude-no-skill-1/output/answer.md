# State-proof format for a trust-minimized L1 light client

**Date of analysis: 2026-09-03.** Sources at the bottom; where a claim rests on
secondary reporting rather than a spec or a core-dev call, I say so.

---

## Recommendation, in one paragraph

Build the verifier around **keccak256 hexary Merkle-Patricia-Trie (MPT) proofs as
returned by `eth_getProof` (EIP-1186)** — a two-stage account-proof + storage-proof
verification against the execution header's `stateRoot`. That is not a compromise
pick: it is the *only* format the protocol actually commits to today, and it will
remain canonical on mainnet for years. But **do not let the MPT leak into your
verifier's public API.** Put the proof format behind a fork-gated, versioned
interface whose next implementation is the **EIP-7864 unified binary tree**, which
is where the state layer is genuinely heading. Explicitly do **not** build around
**Verkle trees** — that design has been abandoned in practice. And treat the binary
tree as a *soft* dependency only: it is still Draft, its hash function was
unsettled as of last month, and it is not scheduled into any named fork.

The one place I'd push back on the framing of the question: for a light client,
the tree shape is the *less* volatile half of your stack. The genuinely
load-bearing, genuinely-moving dependency is your **trust anchor** — how you obtain
an authenticated recent `stateRoot` without an RPC provider. See §5.

---

## 1. Where the state layer actually stands today

Unchanged since Frontier in its essentials:

- State is a **hexary Merkle Patricia Trie** over `keccak256`, in **two levels**.
  The account trie is keyed by `keccak256(address)` (64 nibbles); each account leaf
  is `RLP([nonce, balance, storageRoot, codeHash])`; each contract has its own
  storage trie keyed by `keccak256(slot)`.
- Verifying one storage slot therefore means verifying **two independent paths**:
  `stateRoot → account leaf`, then extract `storageRoot` from that leaf, then
  `storageRoot → slot leaf`. Both must be checked; skipping the binding between them
  is the classic light-client soundness bug.
- **EIP-1186 / `eth_getProof`** is the interface, is Final, and is universally
  supported (it is a hard requirement of Helios, for example).
- Cost: branch nodes are 17-item RLP lists (~532 bytes each), so a single slot proof
  is typically **~4–10 KB** across both tries. On-chain verification of a two-level
  proof runs in the low hundreds of thousands of gas. Off-chain in a browser it is
  trivially cheap.

Practical notes that will cost you a week if you skip them: RLP node decoding with
the extension/branch/leaf node-type distinction; the `< 32 byte node is inlined`
rule; and **exclusion proofs** — proving a slot is zero or an account does not
exist is a distinct code path and is where most hand-rolled verifiers are unsound.

## 2. Where it is genuinely going

**Verkle trees are dead.** They were the plan from roughly 2021 through 2024
(EIP-6800 et al., Verkle Gen Devnets), and were a leading candidate for a 2026 fork.
Two things killed them: the IPA/Pedersen commitments over Bandersnatch are **not
post-quantum secure**, and SNARK proving over plain hashes got fast enough that a
hash-only tree captures most of the benefit with none of the exotic cryptography.
No client completed a mainnet migration; the effort was wound down.

⚠️ **`ethereum.org/roadmap/verkle-trees` is stale** — as of today it still presents
Verkle as an active initiative and does not mention binary trees at all. If someone
on your team cites that page as evidence, that is a documentation lag, not a signal.
Trust EIP status, ACD call notes, and eth-magicians over the marketing site here.

**The successor is EIP-7864, "Ethereum state using a unified binary tree":**

- **Arity 2** (binary), chosen because witness size is minimized at k=2.
- **One unified tree.** Account headers, contract code, and storage collapse into a
  single 32-byte-key / 32-byte-value space. Keys are `1-byte storage-type prefix ||
  31 bytes derived from the hashed address || 1-byte subindex`. Related data for an
  account is co-located under a `StemNode` holding 256 leaves.
- **The two-level account-trie/storage-trie structure disappears.** For you this is
  the single biggest change: one path, not two, and no `storageRoot` indirection.
- **Merkleization is hash-only** — no trusted setup, no elliptic curves, natively
  post-quantum. Branches are roughly **4× shorter** than today's hexary paths.
- **The hash function is explicitly not final.** The draft implements BLAKE3 for
  experimentation, with Keccak and Poseidon2 as candidates.

That last point moved recently and matters to you: on **2026-08-13** the Ethereum
Foundation (Justin Drake) publicly moved away from **Poseidon** for base-layer use,
citing advances in binary-field proof systems (Binius, Flock) that erased Poseidon's
proving advantage, in favor of **SHA-256 / BLAKE3**. Poseidon is not broken and no
fork has shipped — but the SNARK-friendly-hash assumption that a lot of third-party
tooling was built on just changed. *(This is per press coverage of Drake's
announcement; confirm against the primary post before acting on it.)*

**The migration mechanism is already specified** and is target-tree-agnostic:
**EIP-7612** freezes the MPT and lays a new tree "over" it so new writes go to the
new tree; **EIP-7748** then converts a fixed number of key-values per block until the
old tree is drained. This was written for Verkle and carries over unchanged, because
nothing in it depends on the shape of the target tree.

**Separately — and more relevant to a light client than the tree change itself —**
the 2026 L1-zkEVM roadmap's first workstream is *"Execution Witness & Guest Program
Standardization"*: defining a canonical `ExecutionWitness` structure in
`execution-specs`, **plus RPC endpoints to serve it**. If a standardized
stateless-witness format lands, that — not `eth_getProof` — becomes the format the
protocol actually specifies. Track it.

## 3. Timing: how hard a dependency you can safely take

| Milestone | Status as of 2026-09-03 | State-tree impact |
|---|---|---|
| **Glamsterdam** (ePBS EIP-7732, Block-Level Access Lists EIP-7928) | Feature set locked, final devnet phase; mainnet slipped **twice**, now targeting **Q4 2026**; early 2027 realistic | **None** |
| **Hegotá** | FOCIL (EIP-7805) as headliner; PFI list finalized ~end of Aug 2026; **2027** | Binary tree is **not** the headliner |
| **EIP-7864 binary tree** | **Draft** since 2025-01-20. Hash TBD. No fork assignment. | The change — but unscheduled |
| **EIP-7612 + EIP-7748 conversion** | Specified, not scheduled | Multi-month *live* conversion once started |
| **Enshrined zkEVM proofs** | Real-time proving demonstrated (SP1 Hypercube: 99.7% of L1 blocks <12s on 16 GPUs); CL integration has **no date** | N/A yet |

Read that as: **the binary tree will not touch mainnet before 2028 at the earliest**,
and the shape it lands in is not yet frozen. Concretely, before it can ship it needs
(a) a final hash function, (b) a fork slot behind at least two upgrades that have
themselves slipped, (c) the preimage-distribution problem solved for conversion, and
(d) a months-long live state conversion. Any one of those slipping a quarter slips
the whole thing.

**So: soft dependency only.** Design *toward* it, ship *on* the MPT. Do not build a
binary-tree verifier now — you'd be implementing against an unfixed hash.

**The one hard-timing trap** most teams miss: during the EIP-7612/7748 overlay
window, the state is in **two trees at once**. A single logical read may require a
proof in the new tree *plus* an exclusion proof there *plus* a proof in the frozen
MPT. Your `StateProof` type must be able to represent a **composite, dual-format**
proof from day one, or you will be rewriting the verifier core under time pressure
during a live migration. Model the proof as a list of per-tree segments now, even
though today that list always has length one.

## 4. What to build

```
BlockRef ──> HeaderOracle ──> (blockHash, stateRoot, forkId)   // §5 — the volatile part
                                        │
StateProof { version, forkId, segments: [ProofSegment] }
                                        │
                          verify(stateRoot, address, slot) -> Option<U256>
                                        │
              ┌─────────────────────────┴──────────────────────────┐
        MptSegment (keccak, 2-level)                 BinarySegment (EIP-7864)  [later]
```

Rules that make this cheap to hold:

1. **Version and fork-tag every proof at rest.** A proof is only meaningful relative
   to a `stateRoot` *and* the fork rules in effect at that block. If you cache or
   forward proofs, an untagged blob becomes unverifiable after a tree change.
2. **The public API returns `(value, blockRef)` — never trie nodes.** Any consumer
   that has to know what a branch node is, is a consumer you'll have to migrate.
3. **Keep depending on `eth_getProof`**, and plan for the *response schema* to
   change under the same method name (or for a sibling witness endpoint to appear
   per the L1-zkEVM roadmap). The endpoint is a much safer bet than its payload.
4. **Get exclusion proofs right now**, in the MPT implementation, with tests. Both
   trees have this case and it is the main soundness risk in the whole system.
5. **Fuzz against a real node.** Differential-test your verifier against reth/geth
   `eth_getProof` on mainnet blocks. This is worth more than any amount of spec
   reading.

**If witness bandwidth is your actual bottleneck** (say you're verifying on-chain on
another chain and 10 KB of calldata is the cost driver): wrap your own MPT
verification in a SNARK and ship a ~few-hundred-byte proof. That is a *you*
decision, entirely inside your trust boundary, requiring zero protocol change — and
it is strictly better than waiting for the binary tree. Do not confuse it with
depending on enshrined L1 proving, which has no timeline.

## 5. The dependency you're probably underweighting

Your spec says "without trusting an RPC provider." MPT proofs get you *integrity
relative to a `stateRoot`* — they say nothing about whether that `stateRoot` is
canonical. The trust anchor is the whole ballgame, and **that** is the piece of the
protocol currently in motion.

- **Today** you'd use the **Altair light-client sync protocol**: a 512-validator
  sync committee rotating every ~27 hours signs headers; you follow
  `LightClientUpdate`/`FinalityUpdate` from a weak-subjectivity checkpoint to a
  beacon block, then read `ExecutionPayloadHeader.state_root`. This is what Helios
  does, and it is the right thing to do now.
- **But** — **EIP-8390** (Draft, ~2026-08-25) proposes **removing the sync committee
  and the Altair light-client interfaces entirely**, replacing them with a
  zero-knowledge proof of Casper FFG finality over the full validator set. The
  motivation is legitimate: sync-committee messages have **no slashing condition**,
  so a corrupted committee can sign a header for a nonexistent chain at zero cost.
  The draft currently has **no replacement API, no migration plan, and no prover
  incentive design**. *(Draft status; verify current state before planning around
  it.)*

That is the actual "design the protocol may be moving away from" in your stack — and
unlike the tree change, it would break a deployed light client outright rather than
just changing a proof encoding. Mitigations:

- Put the header oracle behind an interface (`BlockRef → authenticated (blockHash,
  stateRoot)`) that is at least as strictly separated as the proof-format interface.
- Support **more than one anchor** from the start. If verification happens on-chain,
  **EIP-4788** gives you beacon block roots directly in the EVM, and **EIP-2935**
  (shipped in Pectra) gives you historical block hashes in state — both are anchors
  that don't route through the sync committee at all.
- Keep the weak-subjectivity checkpoint an explicit, operator-visible config value,
  not a constant. It is your actual root of trust; treat it like one.

## 6. Watch list

- **EIP-7864** — status change out of Draft, and the **final hash function** choice.
- **Hegotá PFI/CFI/SFI** movement for any state-tree EIP (ACD call notes, EIPsInsight).
- **`ExecutionWitness` standardization** in `execution-specs` + its RPC endpoint.
- **EIP-8390** — any sign of it gaining a champion or a replacement light-client API.
- The follow-on to Drake's **2026-08-13** hash announcement, since EIP-7864's hash
  choice is downstream of it.

## 7. Confidence

High on: Verkle is abandoned; the MPT is what mainnet runs and will run for years;
binary tree is the intended successor; nothing state-tree-related is in Glamsterdam
or is Hegotá's headliner. **Medium** on precise fork dates (Glamsterdam has slipped
twice already) and on the Poseidon and EIP-8390 items, which come from August 2026
reporting I read secondhand — confirm those two against primary sources before they
influence a schedule.

None of this changes the recommendation. The MPT is right regardless, because it's
the only thing that exists; the value of the analysis is in knowing to keep the
format swappable, to model composite proofs before the overlay window, and to
harden the trust anchor rather than the tree.

---

### Sources

- [EIP-7864: Ethereum state using a unified binary tree](https://eips.ethereum.org/EIPS/eip-7864)
- [EIP-1186: RPC-Method to get Merkle Proofs - eth_getProof](https://eips.ethereum.org/EIPS/eip-1186)
- [EIP-7748: State Conversion](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-7748.md)
- [EIP-7612: Verkle state transition via an overlay tree](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-7612.md)
- [EIP-8390 (remove sync committee / Altair LC interfaces)](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-8390.md)
- [Altair Light Client — Sync Protocol](https://ethereum.github.io/consensus-specs/specs/altair/light-client/sync-protocol/)
- [Ethereum stateless book — Binary Tree](https://stateless.fyi/trees/binary-tree.html)
- [L1-zkEVM Roadmap 2026 (Fellowship of Ethereum Magicians)](https://ethereum-magicians.org/t/l1-zkevm-roadmap-2026-integrating-zkevm-proofs-into-ethereums-core-protocol/27595)
- [EIP-7864 discussion thread](https://ethereum-magicians.org/t/eip-7864-ethereum-state-using-a-unified-binary-tree/22611)
- [Glamsterdam | ethereum.org](https://ethereum.org/roadmap/glamsterdam/)
- [Glamsterdam enters final devnet phase (The Defiant)](https://thedefiant.io/news/blockchains/ethereum-glamsterdam-final-devnet-200m-gas-limit-target)
- [Glamsterdam slips to late 2026 (CryptoSlate)](https://cryptoslate.com/ethereums-next-major-upgrade-just-slipped-to-late-2026-forcing-a-two-week-scramble-to-save-its-2027-roadmap/)
- [Hegotá headliner proposal: FOCIL, EIP-7805](https://ethereum-magicians.org/t/hegota-headliner-proposal-focil-eip-7805/27604)
- [Ethereum drops Poseidon for SHA-256/BLAKE3 (CryptoSlate)](https://cryptoslate.com/ethereum-abandons-its-8-year-cryptography-bet-after-proof-systems-flip-the-tradeoff/)
- [EIP-8390 coverage (CryptoSlate)](https://cryptoslate.com/ethereum-proposal-would-cut-33800-eth-issuance-and-break-every-deployed-altair-light-client/)
- [SP1 Hypercube real-time proving](https://blog.succinct.xyz/real-time-proving-16-gpus/)
- [Verkle trees | ethereum.org](https://ethereum.org/roadmap/verkle-trees) — *cited as an example of stale documentation*
